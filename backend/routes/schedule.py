import traceback
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import text

from models.scheduled_post import ScheduledPost
from models.setting import Setting
from utils.database import db
from utils.auth import jwt_required
from utils.crypto import decrypt_value
from services import claude_service
from services.wordpress_service import WordPressService

schedule_bp = Blueprint('schedule', __name__)


@schedule_bp.route('', methods=['GET'])
@jwt_required
def list_schedules():
    user = request.current_user
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    search = request.args.get('search', '').strip()
    status = request.args.get('status', '').strip()

    query = ScheduledPost.query.filter_by(user_id=user.id)

    if search:
        like_pattern = f'%{search}%'
        query = query.filter(
            db.or_(
                ScheduledPost.keyword.ilike(like_pattern),
                ScheduledPost.title.ilike(like_pattern),
            )
        )

    if status:
        query = query.filter_by(status=status)

    query = query.order_by(ScheduledPost.scheduled_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'items': [item.to_dict() for item in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    }


@schedule_bp.route('', methods=['POST'])
@jwt_required
def create_schedule():
    user = request.current_user
    data = request.get_json()

    if not data or not data.get('keyword'):
        return {'error': '請提供關鍵字'}, 400

    if not data.get('scheduled_at'):
        return {'error': '請提供排程時間'}, 400

    try:
        scheduled_at = datetime.fromisoformat(data['scheduled_at'])
        if scheduled_at.tzinfo is None:
            scheduled_at = scheduled_at.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return {'error': '排程時間格式錯誤，請使用 ISO 格式'}, 400

    if scheduled_at <= datetime.now(timezone.utc):
        return {'error': '排程時間必須是未來時間'}, 400

    post = ScheduledPost(
        user_id=user.id,
        keyword=data['keyword'],
        title=data.get('title'),
        direction=data.get('author_background') or data.get('direction'),
        material=data.get('article_instruction') or data.get('material'),
        scheduled_at=scheduled_at,
    )
    db.session.add(post)
    db.session.commit()

    return {'item': post.to_dict()}, 201


@schedule_bp.route('/<int:id>', methods=['GET'])
@jwt_required
def get_schedule(id):
    user = request.current_user
    post = ScheduledPost.query.filter_by(id=id, user_id=user.id).first()
    if not post:
        return {'error': '找不到此排程'}, 404
    return {'item': post.to_dict()}


@schedule_bp.route('/<int:id>', methods=['DELETE'])
@jwt_required
def delete_schedule(id):
    user = request.current_user
    post = ScheduledPost.query.filter_by(id=id, user_id=user.id).first()
    if not post:
        return {'error': '找不到此排程'}, 404

    if post.status not in ('pending', 'cancelled'):
        return {'error': '只能刪除 pending 或 cancelled 狀態的排程'}, 400

    db.session.delete(post)
    db.session.commit()
    return {'message': '排程已刪除'}


@schedule_bp.route('/<int:schedule_id>', methods=['PUT'])
@jwt_required
def update_schedule(schedule_id):
    user = request.current_user
    item = ScheduledPost.query.filter_by(id=schedule_id, user_id=user.id).first()
    if not item:
        return jsonify({'error': '找不到此排程'}), 404
    if item.status != 'pending':
        return jsonify({'error': '只能修改待執行中的排程'}), 400

    data = request.get_json() or {}

    if 'keyword' in data:
        keyword = (data.get('keyword') or '').strip()
        if not keyword:
            return jsonify({'error': '關鍵字不可為空'}), 400
        item.keyword = keyword

    if 'title' in data:
        item.title = (data.get('title') or '').strip() or None

    if 'author_background' in data or 'direction' in data:
        val = data.get('author_background') or data.get('direction') or ''
        item.direction = val.strip() or None

    if 'article_instruction' in data or 'material' in data:
        val = data.get('article_instruction') or data.get('material') or ''
        item.material = val.strip() or None

    if 'scheduled_at' in data:
        try:
            dt = datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00'))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            if dt <= now:
                return jsonify({'error': '排程時間必須是未來時間'}), 400
            item.scheduled_at = dt.astimezone(timezone.utc).replace(tzinfo=None)
        except (ValueError, AttributeError):
            return jsonify({'error': '無效的時間格式'}), 400

    item.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.session.commit()
    return jsonify({'item': item.to_dict()})


@schedule_bp.route('/trigger', methods=['POST'])
@jwt_required
def trigger():
    count, errors = run_due_scheduled_posts()
    return {
        'triggered': count,
        'errors': errors,
    }


def run_due_scheduled_posts():
    """Execute all due scheduled posts. Returns (count, errors)."""
    # Atomically claim pending posts that are due
    result = db.session.execute(text(
        "UPDATE scheduled_posts SET status='processing', updated_at=NOW() "
        "WHERE status='pending' AND scheduled_at <= NOW() "
        "RETURNING id"
    ))
    db.session.commit()
    ids = [row[0] for row in result]

    errors = []
    for post_id in ids:
        try:
            _execute_scheduled_post(post_id)
        except Exception as e:
            errors.append({'id': post_id, 'error': str(e)})

    return len(ids), errors


def _execute_scheduled_post(post_id):
    """Generate article and publish to WordPress for a single scheduled post."""
    post = ScheduledPost.query.get(post_id)
    if not post:
        return

    try:
        setting = Setting.query.filter_by(user_id=post.user_id).first()
        if not setting or not setting.anthropic_api_key_enc:
            raise ValueError('使用者未設定 Anthropic API Key')
        if not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
            raise ValueError('使用者未設定 WordPress 連線資訊')

        # Step 1: Generate article with Claude
        anthropic_key = decrypt_value(setting.anthropic_api_key_enc)
        article_data = claude_service.generate_article(
            api_key=anthropic_key,
            keyword=post.keyword,
            title=post.title,
            author_background=post.direction,
            article_instruction=post.material,
            custom_prompt=setting.custom_prompt,
        )

        # Step 2: Create WordPress post
        wp_password = decrypt_value(setting.wp_app_password_enc)
        wp_client = WordPressService(setting.wp_url, setting.wp_username, wp_password)

        seo = article_data.get('seo', {})
        if not seo.get('focus_keyword'):
            seo['focus_keyword'] = post.keyword

        wp_post = wp_client.create_post(
            title=article_data.get('title', post.keyword),
            content=article_data.get('content', ''),
            slug=article_data.get('slug'),
            excerpt=article_data.get('excerpt'),
            status='draft',
        )

        # Step 3: Set Rank Math SEO
        try:
            wp_client.update_seo_meta(post_id=wp_post['id'], seo=seo)
        except Exception:
            pass  # SEO failure is non-fatal

        # Mark completed
        post.status = 'completed'
        post.result = {
            'article_title': article_data.get('title', ''),
            'wp_post_id': wp_post['id'],
            'wp_link': wp_post.get('link', ''),
            'seo': seo,
        }
        post.updated_at = datetime.now(timezone.utc)
        db.session.commit()

    except Exception as e:
        post.status = 'failed'
        post.error_message = str(e)
        post.updated_at = datetime.now(timezone.utc)
        db.session.commit()
        raise

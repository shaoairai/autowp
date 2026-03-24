import base64
from datetime import datetime, timezone

import requests
from flask import Blueprint, request, jsonify

from models.setting import Setting
from models.task import Task
from models.keyword_pool import KeywordPool
from models.auto_publish_log import AutoPublishLog
from utils.database import db
from utils.auth import jwt_required
from utils.crypto import decrypt_value
from services.keyword_research_service import fetch_suggestions_for_topic, DEFAULT_TOPIC

keyword_pool_bp = Blueprint('keyword_pool', __name__)


@keyword_pool_bp.route('', methods=['GET'])
@jwt_required
def list_keywords():
    user = request.current_user
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    is_used_filter = request.args.get('is_used', None)

    query = KeywordPool.query.filter_by(user_id=user.id)
    if is_used_filter is not None:
        query = query.filter_by(is_used=(is_used_filter.lower() == 'true'))
    query = query.order_by(KeywordPool.is_used.asc(), KeywordPool.created_at.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    setting = Setting.query.filter_by(user_id=user.id).first()
    topic = (setting.website_topic if setting and setting.website_topic else DEFAULT_TOPIC)

    return jsonify({
        'items': [kw.to_dict() for kw in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'topic': topic,
    })


@keyword_pool_bp.route('/config', methods=['GET'])
@jwt_required
def get_config():
    user = request.current_user
    setting = Setting.query.filter_by(user_id=user.id).first()
    topic = (setting.website_topic if setting and setting.website_topic else DEFAULT_TOPIC)
    return jsonify({'topic': topic})


@keyword_pool_bp.route('/config', methods=['PUT'])
@jwt_required
def update_config():
    user = request.current_user
    data = request.get_json() or {}
    topic = (data.get('topic') or '').strip() or DEFAULT_TOPIC

    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting:
        setting = Setting(user_id=user.id)
        db.session.add(setting)
    setting.website_topic = topic
    db.session.commit()
    return jsonify({'topic': topic})


@keyword_pool_bp.route('/sync-wp', methods=['POST'])
@jwt_required
def sync_wp_keywords():
    """Fetch all WP post keywords and add unique ones to the pool."""
    user = request.current_user
    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting or not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
        return jsonify({'error': '請先設定 WordPress 連線資訊'}), 400

    wp_url = setting.wp_url.rstrip('/')
    wp_username = setting.wp_username
    wp_password = decrypt_value(setting.wp_app_password_enc)
    auth_string = base64.b64encode(f'{wp_username}:{wp_password}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth_string}'}

    # Fetch WP tags
    tag_id_to_name = {}
    tag_page = 1
    try:
        while True:
            tresp = requests.get(
                f'{wp_url}/wp-json/wp/v2/tags',
                params={'per_page': 100, 'page': tag_page, '_fields': 'id,name'},
                headers=headers, timeout=20,
            )
            if tresp.status_code in (400, 404):
                break
            tresp.raise_for_status()
            tags_data = tresp.json()
            if not tags_data:
                break
            for tag in tags_data:
                tag_id_to_name[tag['id']] = tag.get('name', '')
            tag_total = int(tresp.headers.get('X-WP-TotalPages', 1))
            if tag_page >= tag_total:
                break
            tag_page += 1
    except requests.RequestException as e:
        return jsonify({'error': f'無法連線 WordPress: {str(e)}'}), 502

    # Fetch all post keywords
    all_keywords = set()
    # From Task records
    tasks = Task.query.filter_by(user_id=user.id, status='completed').all()
    for task in tasks:
        kw = (task.keyword or '').strip()
        if kw:
            all_keywords.add(kw)

    # From WP post tags
    page = 1
    total_pages = 1
    try:
        while page <= total_pages:
            resp = requests.get(
                f'{wp_url}/wp-json/wp/v2/posts',
                params={
                    'per_page': 100, 'page': page,
                    '_fields': 'id,tags', 'status': 'publish,draft',
                },
                headers=headers, timeout=30,
            )
            if resp.status_code in (400, 404):
                break
            resp.raise_for_status()
            posts = resp.json()
            if not posts:
                break
            for post in posts:
                for tag_id in post.get('tags', []):
                    name = tag_id_to_name.get(tag_id, '').strip()
                    if name:
                        all_keywords.add(name)
            total_pages = int(resp.headers.get('X-WP-TotalPages', 1))
            page += 1
    except requests.RequestException as e:
        return jsonify({'error': f'無法連線 WordPress: {str(e)}'}), 502

    # Existing keywords in pool for this user
    existing = {kw.keyword for kw in KeywordPool.query.filter_by(user_id=user.id).all()}

    added = 0
    for kw in all_keywords:
        if kw not in existing:
            entry = KeywordPool(user_id=user.id, keyword=kw, source='wp')
            db.session.add(entry)
            added += 1

    db.session.commit()
    return jsonify({'added': added, 'skipped': len(all_keywords) - added, 'total_found': len(all_keywords)})


@keyword_pool_bp.route('/research', methods=['POST'])
@jwt_required
def research_keywords():
    """Research long-tail keywords based on website topic using Google Autocomplete."""
    user = request.current_user
    data = request.get_json() or {}

    setting = Setting.query.filter_by(user_id=user.id).first()
    topic = data.get('topic') or (setting.website_topic if setting and setting.website_topic else DEFAULT_TOPIC)
    topic = topic.strip()

    # Google Autocomplete with topic variants
    suggestions = fetch_suggestions_for_topic(topic)

    # Deduplicate and filter
    seen = set()
    filtered = []
    for kw in suggestions:
        kw = kw.strip()
        if not kw or kw in seen or len(kw) < 2 or len(kw) > 100 or kw == topic:
            continue
        seen.add(kw)
        filtered.append(kw)

    # Existing keywords in pool
    existing = {kw.keyword for kw in KeywordPool.query.filter_by(user_id=user.id).all()}

    added = 0
    new_keywords = []
    for kw in filtered:
        if kw not in existing:
            entry = KeywordPool(user_id=user.id, keyword=kw, source='research')
            db.session.add(entry)
            added += 1
            new_keywords.append(kw)
            existing.add(kw)

    db.session.commit()
    return jsonify({'added': added, 'keywords': new_keywords})


@keyword_pool_bp.route('/<int:kw_id>', methods=['DELETE'])
@jwt_required
def delete_keyword(kw_id):
    user = request.current_user
    kw = KeywordPool.query.filter_by(id=kw_id, user_id=user.id).first()
    if not kw:
        return jsonify({'error': '找不到此關鍵字'}), 404
    db.session.delete(kw)
    db.session.commit()
    return jsonify({'message': '已刪除'})


@keyword_pool_bp.route('/<int:kw_id>/toggle', methods=['PUT'])
@jwt_required
def toggle_keyword(kw_id):
    user = request.current_user
    kw = KeywordPool.query.filter_by(id=kw_id, user_id=user.id).first()
    if not kw:
        return jsonify({'error': '找不到此關鍵字'}), 404
    kw.is_used = not kw.is_used
    kw.used_at = datetime.now(timezone.utc) if kw.is_used else None
    db.session.commit()
    return jsonify({'item': kw.to_dict()})


@keyword_pool_bp.route('/auto-publish-logs', methods=['GET'])
@jwt_required
def auto_publish_logs():
    user = request.current_user
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    pagination = AutoPublishLog.query.filter_by(user_id=user.id)\
        .order_by(AutoPublishLog.created_at.desc())\
        .paginate(page=page, per_page=per_page, error_out=False)
    return jsonify({
        'items': [log.to_dict() for log in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    })



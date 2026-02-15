import json
import traceback

from flask import Blueprint, request, Response, stream_with_context

from models.task import Task
from models.setting import Setting
from utils.database import db
from utils.auth import jwt_required
from utils.crypto import decrypt_value
from services import claude_service
from services.wordpress_service import WordPressService
from services.email_service import send_notification, build_success_email, build_failure_email

generate_bp = Blueprint('generate', __name__)


def _sse_event(step, status, message, data=None):
    """Format a Server-Sent Event."""
    payload = {'step': step, 'status': status, 'message': message}
    if data:
        payload['data'] = data
    return f'data: {json.dumps(payload, ensure_ascii=False)}\n\n'


@generate_bp.route('', methods=['POST'])
@jwt_required
def generate():
    user = request.current_user
    req_data = request.get_json()

    if not req_data or not req_data.get('keyword'):
        return {'error': '請提供關鍵字'}, 400

    # Load user settings
    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting or not setting.anthropic_api_key_enc:
        return {'error': '請先設定 Anthropic API Key'}, 400
    if not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
        return {'error': '請先設定 WordPress 連線資訊'}, 400

    keyword = req_data['keyword']
    title = req_data.get('title')
    direction = req_data.get('direction')
    material = req_data.get('material')
    custom_prompt = req_data.get('custom_prompt')

    # Create task record
    task = Task(
        user_id=user.id,
        keyword=keyword,
        title=title,
        direction=direction,
        material=material,
        status='processing',
        current_step='ai_generating',
        steps_detail={},
    )
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    def event_stream():
        article_data = None
        wp_post = None

        try:
            # Step 1: AI generating
            yield _sse_event('ai_generating', 'processing', '正在使用 Claude 產生文章...')
            _update_task(task_id, 'processing', 'ai_generating')

            anthropic_key = decrypt_value(setting.anthropic_api_key_enc)
            article_data = claude_service.generate_article(
                api_key=anthropic_key,
                keyword=keyword,
                title=title,
                direction=direction,
                material=material,
                custom_prompt=custom_prompt or setting.custom_prompt,
            )

            # Save article content to task immediately (so it's preserved even if later steps fail)
            _update_task(task_id, 'processing', 'ai_generating', result={
                'article_title': article_data.get('title', ''),
                'article_content': article_data.get('content', ''),
                'seo': article_data.get('seo', {}),
                'slug': article_data.get('slug', ''),
                'excerpt': article_data.get('excerpt', ''),
            })

            yield _sse_event('ai_generating', 'completed', '文章產生完成',
                             {'title': article_data.get('title', ''),
                              'content': article_data.get('content', ''),
                              'seo': article_data.get('seo', {}),
                              'slug': article_data.get('slug', ''),
                              'excerpt': article_data.get('excerpt', '')})

            # Step 2: Create WordPress post
            yield _sse_event('wp_creating', 'processing', '正在建立 WordPress 草稿...')
            _update_task(task_id, 'processing', 'wp_creating')

            wp_password = decrypt_value(setting.wp_app_password_enc)
            wp_client = WordPressService(setting.wp_url, setting.wp_username, wp_password)

            # Normalize half-width commas to full-width
            content = _normalize_commas(article_data.get('content', ''))

            seo = article_data.get('seo', {})
            # Ensure focus_keyword has a value
            if not seo.get('focus_keyword'):
                seo['focus_keyword'] = keyword

            featured_media_id = None
            wp_post = wp_client.create_post(
                title=article_data.get('title', keyword),
                content=content,
                slug=article_data.get('slug'),
                excerpt=article_data.get('excerpt'),
                status='draft',
                featured_media_id=featured_media_id,
            )

            yield _sse_event('wp_creating', 'completed', 'WordPress 草稿建立完成',
                             {'post_id': wp_post['id'], 'link': wp_post['link']})

            # Step 5: Set Rank Math SEO meta via native API
            yield _sse_event('seo_setting', 'processing', '正在設定 Rank Math SEO...')
            _update_task(task_id, 'processing', 'seo_setting')

            try:
                wp_client.update_seo_meta(post_id=wp_post['id'], seo=seo)

                seo_details = []
                if seo.get('focus_keyword'):
                    seo_details.append(f'焦點關鍵字: {seo["focus_keyword"]}')
                if seo.get('secondary_keywords'):
                    seo_details.append(f'次要關鍵字: {seo["secondary_keywords"][:40]}')

                detail_str = '｜'.join(seo_details) if seo_details else ''
                yield _sse_event('seo_setting', 'completed',
                                 f'Rank Math SEO 設定完成（{detail_str}）')
            except Exception as e:
                yield _sse_event('seo_setting', 'warning', f'SEO 設定失敗（文章仍已建立）: {str(e)}')

            # Step 6: Send email notification
            yield _sse_event('email_sending', 'processing', '正在寄送通知信...')
            _update_task(task_id, 'processing', 'email_sending')

            try:
                if setting.resend_api_key_enc and setting.notify_email:
                    resend_key = decrypt_value(setting.resend_api_key_enc)
                    html_body = build_success_email(
                        title=article_data.get('title', keyword),
                        wp_link=wp_post.get('link', ''),
                        seo_info=seo,
                    )
                    quota = send_notification(
                        resend_api_key=resend_key,
                        from_email='AutoWP <onboarding@resend.dev>',
                        to_email=setting.notify_email,
                        subject=f'[AutoWP] 文章產生成功：{article_data.get("title", keyword)}',
                        html_body=html_body,
                    )
                    yield _sse_event('email_sending', 'completed',
                                     f'通知信已寄出（本月剩餘 {quota["monthly_remaining"]} 封｜今日剩餘 {quota["daily_remaining"]} 封）')
                else:
                    yield _sse_event('email_sending', 'skipped', '未設定 Resend API Key，跳過寄信')
            except Exception as e:
                yield _sse_event('email_sending', 'warning', f'寄信失敗: {str(e)}')

            # Completed
            result = {
                'article_title': article_data.get('title', ''),
                'wp_post_id': wp_post['id'] if wp_post else None,
                'wp_link': wp_post.get('link', '') if wp_post else '',
                'seo': seo,
            }
            _update_task(task_id, 'completed', 'completed', result=result)
            yield _sse_event('completed', 'completed', '所有步驟已完成', result)

        except Exception as e:
            error_msg = str(e)
            tb = traceback.format_exc()
            current_step = _get_current_step(task_id)
            _update_task(task_id, 'failed', current_step, error_message=error_msg)

            # Try to send failure email
            try:
                if setting.resend_api_key_enc and setting.notify_email:
                    resend_key = decrypt_value(setting.resend_api_key_enc)
                    html_body = build_failure_email(keyword, error_msg, current_step)
                    send_notification(
                        resend_api_key=resend_key,
                        from_email='AutoWP <onboarding@resend.dev>',
                        to_email=setting.notify_email,
                        subject=f'[AutoWP] 文章產生失敗：{keyword}',
                        html_body=html_body,
                    )
            except Exception:
                pass

            yield _sse_event('error', 'failed', f'產生過程發生錯誤: {error_msg}',
                             {'step': current_step})

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


@generate_bp.route('/upload', methods=['POST'])
@jwt_required
def direct_upload():
    """Upload pre-written content to WordPress.

    Skips only the Claude AI article generation step.
    All other steps (WP post, SEO, email) run identically to the full generation flow.
    """
    user = request.current_user
    req_data = request.get_json()

    if not req_data or not req_data.get('content'):
        return {'error': '請提供文章內容'}, 400

    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting or not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
        return {'error': '請先設定 WordPress 連線資訊'}, 400

    keyword = req_data.get('keyword', '直接上傳')
    title = req_data.get('title', '未命名文章')
    content = req_data['content']
    slug = req_data.get('slug')
    excerpt = req_data.get('excerpt')
    status = req_data.get('status', 'draft')
    seo = req_data.get('seo', {})

    task = Task(
        user_id=user.id,
        keyword=keyword,
        title=title,
        status='processing',
        current_step='wp_creating',
        steps_detail={},
    )
    db.session.add(task)
    db.session.commit()
    task_id = task.id

    # Save article content immediately
    _update_task(task_id, 'processing', 'wp_creating', result={
        'article_title': title,
        'article_content': content,
        'seo': seo,
        'slug': slug or '',
        'excerpt': excerpt or '',
    })

    def event_stream():
        wp_post = None

        try:
            # Step 1: Create WordPress post
            yield _sse_event('wp_creating', 'processing', '正在建立 WordPress 草稿...')
            _update_task(task_id, 'processing', 'wp_creating')

            wp_password = decrypt_value(setting.wp_app_password_enc)
            wp_client = WordPressService(setting.wp_url, setting.wp_username, wp_password)

            # Normalize half-width commas to full-width
            final_content = _normalize_commas(content)

            # Ensure focus_keyword has a value
            if not seo.get('focus_keyword'):
                seo['focus_keyword'] = keyword

            featured_media_id = None
            wp_post = wp_client.create_post(
                title=title,
                content=final_content,
                slug=slug,
                excerpt=excerpt,
                status=status,
                featured_media_id=featured_media_id,
            )

            yield _sse_event('wp_creating', 'completed', 'WordPress 草稿建立完成',
                             {'post_id': wp_post['id'], 'link': wp_post['link']})

            # Step 3: Set Rank Math SEO
            yield _sse_event('seo_setting', 'processing', '正在設定 Rank Math SEO...')
            _update_task(task_id, 'processing', 'seo_setting')

            try:
                wp_client.update_seo_meta(post_id=wp_post['id'], seo=seo)
                seo_details = []
                if seo.get('focus_keyword'):
                    seo_details.append(f'焦點關鍵字: {seo["focus_keyword"]}')
                detail_str = '｜'.join(seo_details) if seo_details else ''
                yield _sse_event('seo_setting', 'completed',
                                 f'Rank Math SEO 設定完成（{detail_str}）')
            except Exception as e:
                yield _sse_event('seo_setting', 'warning', f'SEO 設定失敗（文章仍已建立）: {str(e)}')

            # Step 4: Email notification
            yield _sse_event('email_sending', 'processing', '正在寄送通知信...')
            _update_task(task_id, 'processing', 'email_sending')

            try:
                if setting.resend_api_key_enc and setting.notify_email:
                    resend_key = decrypt_value(setting.resend_api_key_enc)
                    html_body = build_success_email(
                        title=title,
                        wp_link=wp_post.get('link', ''),
                        seo_info=seo,
                    )
                    quota = send_notification(
                        resend_api_key=resend_key,
                        from_email='AutoWP <onboarding@resend.dev>',
                        to_email=setting.notify_email,
                        subject=f'[AutoWP] 文章產生成功：{title}',
                        html_body=html_body,
                    )
                    yield _sse_event('email_sending', 'completed',
                                     f'通知信已寄出（本月剩餘 {quota["monthly_remaining"]} 封｜今日剩餘 {quota["daily_remaining"]} 封）')
                else:
                    yield _sse_event('email_sending', 'skipped', '未設定 Resend API Key，跳過寄信')
            except Exception as e:
                yield _sse_event('email_sending', 'warning', f'寄信失敗: {str(e)}')

            # Completed
            result = {
                'article_title': title,
                'article_content': content,
                'wp_post_id': wp_post['id'],
                'wp_link': wp_post.get('link', ''),
                'seo': seo,
            }
            _update_task(task_id, 'completed', 'completed', result=result)
            yield _sse_event('completed', 'completed', '所有步驟已完成', result)

        except Exception as e:
            error_msg = str(e)
            current_step = _get_current_step(task_id)
            _update_task(task_id, 'failed', current_step, error_message=error_msg)
            yield _sse_event('error', 'failed', f'上傳失敗: {error_msg}',
                             {'step': current_step})

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        },
    )


def _update_task(task_id, status, current_step, result=None, error_message=None):
    """Update task record in the database."""
    task = Task.query.get(task_id)
    if task:
        task.status = status
        task.current_step = current_step
        if result:
            task.result = result
        if error_message:
            task.error_message = error_message
        db.session.commit()


def _get_current_step(task_id):
    """Get current step of a task."""
    task = Task.query.get(task_id)
    return task.current_step if task else 'unknown'


def _normalize_commas(content):
    """Replace half-width commas with full-width commas in text content only.

    Skips commas inside HTML tags and Gutenberg block comments.
    """
    result = []
    i = 0
    while i < len(content):
        # Skip Gutenberg comments <!-- ... -->
        if content[i:i+4] == '<!--':
            end = content.find('-->', i + 4)
            if end == -1:
                result.append(content[i:])
                break
            result.append(content[i:end+3])
            i = end + 3
        # Skip HTML tags < ... >
        elif content[i] == '<':
            end = content.find('>', i + 1)
            if end == -1:
                result.append(content[i:])
                break
            result.append(content[i:end+1])
            i = end + 1
        # Text content: replace half-width comma
        elif content[i] == ',':
            result.append('，')
            i += 1
        else:
            result.append(content[i])
            i += 1
    return ''.join(result)

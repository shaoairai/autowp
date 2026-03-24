"""Daily auto-publish service: checks if any post was scheduled today (UTC+8),
if not, picks an unused keyword from pool and runs full generation flow."""
from datetime import datetime, timezone, timedelta

from models.setting import Setting
from models.task import Task
from models.keyword_pool import KeywordPool
from models.auto_publish_log import AutoPublishLog
from models.scheduled_post import ScheduledPost
from models.user import User
from utils.database import db
from utils.crypto import decrypt_value
from services import claude_service
from services.wordpress_service import WordPressService
from sqlalchemy.exc import IntegrityError
from services.keyword_research_service import fetch_suggestions_for_topic, DEFAULT_TOPIC

AUTO_PUBLISH_DEFAULT_AUTHOR_BG = (
    "我是一名專業網頁設計師，擁有10年以上的架設網站與網頁設計實務經驗。"
    "長期服務中小企業與個人品牌，協助客戶從零建立專業網站，涵蓋WordPress客製化、"
    "RWD響應式設計、網站速度優化與SEO基礎建置。"
    "{topic_mention}"
    "所有建議皆來自真實專案執行，不做空泛承諾。"
)

AUTO_PUBLISH_DEFAULT_ARTICLE_INST = (
    "1. 【數據真實性】所有統計數字需附上信譽來源連結，或明確標註為「常見情況」，禁止編造。\n"
    "2. 【可操作性】至少提供3個讀者能立即執行的步驟或決策檢核清單。\n"
    "3. 【常見誤解】包含一節「常見誤解」或「容易踩的坑」，增加實用價值。\n"
    "4. 【言辭審慎】避免絕對承諾，改用「通常可達成」、「多數情況下」等措辭。\n"
    "5. 【CTA相關性】結尾CTA必須直接對應文章核心，具體可行動。"
)


def get_today_utc8():
    """Return today's date string in UTC+8 timezone as 'YYYY-MM-DD'."""
    tz_utc8 = timezone(timedelta(hours=8))
    return datetime.now(tz_utc8).strftime('%Y-%m-%d')


def run_daily_auto_publish():
    """Run for all users: check if today has a scheduled post; if not, auto-generate."""
    today = get_today_utc8()

    users = User.query.all()
    for user in users:
        try:
            _process_user(user, today)
        except IntegrityError:
            # Another worker already wrote the log for today — safe to ignore
            db.session.rollback()
        except Exception as e:
            db.session.rollback()
            # Log error but continue for other users
            try:
                log = AutoPublishLog(
                    user_id=user.id,
                    check_date=today,
                    status='failed',
                    note=f'系統錯誤: {str(e)}',
                )
                db.session.add(log)
                db.session.commit()
            except IntegrityError:
                db.session.rollback()


def _auto_replenish_keywords(user_id, topic):
    """Research new keywords via Google Autocomplete and add unique ones to the pool.

    Returns the number of new keywords added.
    """
    suggestions = fetch_suggestions_for_topic(topic)

    seen = set()
    filtered = []
    for kw in suggestions:
        kw = kw.strip()
        if not kw or kw in seen or len(kw) < 2 or len(kw) > 100 or kw == topic:
            continue
        seen.add(kw)
        filtered.append(kw)

    existing = {kw.keyword for kw in KeywordPool.query.filter_by(user_id=user_id).all()}

    added = 0
    for kw in filtered:
        if kw not in existing:
            entry = KeywordPool(user_id=user_id, keyword=kw, source='research')
            db.session.add(entry)
            added += 1
            existing.add(kw)

    if added:
        db.session.commit()

    return added


def _process_user(user, today):
    """Check and auto-publish for one user."""
    # Check if already logged today (avoid duplicate runs)
    existing_log = AutoPublishLog.query.filter_by(
        user_id=user.id, check_date=today
    ).first()
    if existing_log:
        return  # Already processed today

    # Check if today has any scheduled post (pending/processing/completed)
    tz_utc8 = timezone(timedelta(hours=8))
    today_start_utc8 = datetime.strptime(today, '%Y-%m-%d').replace(tzinfo=tz_utc8)
    today_end_utc8 = today_start_utc8 + timedelta(days=1)
    # Convert to UTC for DB query (ScheduledPost stores UTC)
    today_start_utc = today_start_utc8.astimezone(timezone.utc).replace(tzinfo=None)
    today_end_utc = today_end_utc8.astimezone(timezone.utc).replace(tzinfo=None)

    existing_post = ScheduledPost.query.filter(
        ScheduledPost.user_id == user.id,
        ScheduledPost.scheduled_at >= today_start_utc,
        ScheduledPost.scheduled_at < today_end_utc,
        ScheduledPost.status.in_(['pending', 'processing', 'completed']),
    ).first()

    if existing_post:
        log = AutoPublishLog(
            user_id=user.id,
            check_date=today,
            status='skipped',
            note=f'今日已有排程文章（keyword: {existing_post.keyword}）',
        )
        db.session.add(log)
        db.session.commit()
        return

    # Get an unused keyword from pool
    unused_kw = KeywordPool.query.filter_by(
        user_id=user.id, is_used=False
    ).order_by(KeywordPool.created_at.asc()).first()

    if not unused_kw:
        # Try to auto-replenish keywords before giving up
        setting_for_topic = Setting.query.filter_by(user_id=user.id).first()
        topic = (setting_for_topic.website_topic
                 if setting_for_topic and setting_for_topic.website_topic
                 else DEFAULT_TOPIC)
        added = _auto_replenish_keywords(user.id, topic)
        if added > 0:
            # Pick the first newly added keyword
            unused_kw = KeywordPool.query.filter_by(
                user_id=user.id, is_used=False
            ).order_by(KeywordPool.created_at.asc()).first()

        if not unused_kw:
            log = AutoPublishLog(
                user_id=user.id,
                check_date=today,
                status='no_keyword',
                note='關鍵字庫無可用關鍵字，自動研究後仍無結果',
            )
            db.session.add(log)
            db.session.commit()
            return

    # Check user settings
    setting = Setting.query.filter_by(user_id=user.id).first()
    if not setting or not setting.anthropic_api_key_enc:
        log = AutoPublishLog(
            user_id=user.id,
            check_date=today,
            status='failed',
            note='未設定 Anthropic API Key',
        )
        db.session.add(log)
        db.session.commit()
        return

    if not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
        log = AutoPublishLog(
            user_id=user.id,
            check_date=today,
            status='failed',
            note='未設定 WordPress 連線資訊',
        )
        db.session.add(log)
        db.session.commit()
        return

    keyword = unused_kw.keyword
    kw_id = unused_kw.id  # Keep id for rollback on failure

    # Mark keyword as used immediately (optimistic lock)
    unused_kw.is_used = True
    unused_kw.used_at = datetime.now(timezone.utc)
    db.session.commit()

    # Create Task record
    task = Task(
        user_id=user.id,
        keyword=keyword,
        title=None,
        direction=None,
        material=None,
        status='processing',
        current_step='ai_generating',
        steps_detail={},
        source='auto_publish',
    )
    db.session.add(task)
    db.session.commit()

    try:
        anthropic_key = decrypt_value(setting.anthropic_api_key_enc)

        # Build author_background and article_instruction
        # User custom values take priority over defaults
        if setting.auto_publish_author_bg:
            author_bg = setting.auto_publish_author_bg
            article_inst = setting.auto_publish_article_inst or AUTO_PUBLISH_DEFAULT_ARTICLE_INST
        else:
            author_bg = AUTO_PUBLISH_DEFAULT_AUTHOR_BG
            if setting.website_topic:
                topic_mention = f"我專注於{setting.website_topic}領域的知識與最佳實踐。"
                author_bg = author_bg.format(topic_mention=topic_mention)
            else:
                author_bg = author_bg.format(topic_mention="")
            article_inst = AUTO_PUBLISH_DEFAULT_ARTICLE_INST

        article_data = claude_service.generate_article(
            api_key=anthropic_key,
            keyword=keyword,
            title=None,
            author_background=author_bg,
            article_instruction=article_inst,
            custom_prompt=setting.custom_prompt,
        )

        # Store prompt snapshot and input params for audit trail
        prompt_snapshot = article_data.pop('_prompt_snapshot', '')
        task.steps_detail = {
            'prompt_snapshot': prompt_snapshot,
            'keyword': keyword,
            'title': None,
            'author_background': author_bg,
            'article_instruction': article_inst,
        }
        db.session.commit()

        wp_password = decrypt_value(setting.wp_app_password_enc)
        wp_client = WordPressService(setting.wp_url, setting.wp_username, wp_password)

        seo = article_data.get('seo', {})
        if not seo.get('focus_keyword'):
            seo['focus_keyword'] = keyword

        wp_post = wp_client.create_post(
            title=article_data.get('title', keyword),
            content=article_data.get('content', ''),
            slug=article_data.get('slug'),
            excerpt=article_data.get('excerpt'),
            status='draft',
        )

        try:
            wp_client.update_seo_meta(post_id=wp_post['id'], seo=seo)
        except Exception:
            pass

        task.status = 'completed'
        task.current_step = 'completed'
        task.result = {
            'article_title': article_data.get('title', ''),
            'wp_post_id': wp_post['id'],
            'wp_link': wp_post.get('link', ''),
            'seo': seo,
        }
        db.session.commit()

        log = AutoPublishLog(
            user_id=user.id,
            check_date=today,
            status='success',
            keyword=keyword,
            task_id=task.id,
            note=f'自動發文成功，WP 文章 ID: {wp_post["id"]}',
        )
        db.session.add(log)
        db.session.commit()

    except Exception as e:
        # Roll back the optimistic lock so the keyword can be retried next time
        kw_record = KeywordPool.query.get(kw_id)
        if kw_record:
            kw_record.is_used = False
            kw_record.used_at = None

        task.status = 'failed'
        task.current_step = 'ai_generating'
        task.error_message = str(e)

        log = AutoPublishLog(
            user_id=user.id,
            check_date=today,
            status='failed',
            keyword=keyword,
            task_id=task.id,
            note=f'自動發文失敗: {str(e)}',
        )
        db.session.add(log)
        db.session.commit()
        # Do NOT re-raise: the outer loop in run_daily_auto_publish already has
        # an except handler that would write a second duplicate failed log for
        # the same check_date, corrupting the dedup guard used by existing_log.

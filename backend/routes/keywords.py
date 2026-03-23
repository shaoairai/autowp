import base64
import xml.etree.ElementTree as ET

import requests
from flask import Blueprint, request, jsonify

from models.setting import Setting
from models.task import Task
from utils.auth import jwt_required
from utils.crypto import decrypt_value

keywords_bp = Blueprint('keywords', __name__)


@keywords_bp.route('/wp-keywords', methods=['GET'])
@jwt_required
def wp_keywords():
    """Return one entry per WordPress post with its main keyword.

    Keyword priority per post:
    1. AutoWP Task.keyword (if task.result.wp_post_id matches)
    2. First WordPress tag of the post
    3. Empty string (no keyword info available)

    Sorted by post date descending (newest first).
    """
    import re

    user = request.current_user
    setting = Setting.query.filter_by(user_id=user.id).first()

    if not setting or not setting.wp_url or not setting.wp_username or not setting.wp_app_password_enc:
        return jsonify({'error': '請先設定 WordPress 連線資訊'}), 400

    wp_url = setting.wp_url.rstrip('/')
    wp_username = setting.wp_username
    wp_password = decrypt_value(setting.wp_app_password_enc)

    auth_string = base64.b64encode(f'{wp_username}:{wp_password}'.encode()).decode()
    headers = {'Authorization': f'Basic {auth_string}'}

    # ---- Fetch all WP posts (id, title, link, date, status, tags) ----
    all_posts = []
    page = 1
    total_pages = 1
    try:
        while page <= total_pages:
            resp = requests.get(
                f'{wp_url}/wp-json/wp/v2/posts',
                params={
                    'per_page': 100,
                    'page': page,
                    '_fields': 'id,title,link,date,status,tags',
                    'status': 'publish,draft',
                },
                headers=headers,
                timeout=30,
            )
            if resp.status_code in (400, 404):
                break
            resp.raise_for_status()
            posts = resp.json()
            if not posts:
                break
            all_posts.extend(posts)
            try:
                total_pages = int(resp.headers.get('X-WP-TotalPages', 1))
            except (ValueError, TypeError):
                total_pages = 1
            page += 1
    except requests.RequestException as e:
        return jsonify({'error': f'無法連線 WordPress: {str(e)}'}), 502

    # ---- Batch fetch all WP tags ----
    tag_id_to_name = {}
    tag_page = 1
    try:
        while True:
            tresp = requests.get(
                f'{wp_url}/wp-json/wp/v2/tags',
                params={'per_page': 100, 'page': tag_page, '_fields': 'id,name'},
                headers=headers,
                timeout=20,
            )
            if tresp.status_code in (400, 404):
                break
            tresp.raise_for_status()
            tags_data = tresp.json()
            if not tags_data:
                break
            for tag in tags_data:
                tag_id_to_name[tag['id']] = tag.get('name', '')
            try:
                tag_total = int(tresp.headers.get('X-WP-TotalPages', 1))
            except (ValueError, TypeError):
                tag_total = 1
            if tag_page >= tag_total:
                break
            tag_page += 1
    except requests.RequestException:
        pass

    # ---- Build AutoWP task map: wp_post_id -> keyword ----
    # Only use tasks with a real keyword from this user
    task_post_id_to_kw = {}
    tasks = Task.query.filter_by(user_id=user.id).filter(
        Task.status == 'completed'
    ).all()
    for task in tasks:
        kw = (task.keyword or '').strip()
        if not kw:
            continue
        result = task.result or {}
        wp_post_id = result.get('wp_post_id')
        if wp_post_id:
            task_post_id_to_kw[int(wp_post_id)] = kw

    # ---- Build post list: one entry per post, one main keyword ----
    result_posts = []
    for post in all_posts:
        post_id = post['id']

        # Clean title (strip HTML entities)
        title_raw = post.get('title', {})
        title = title_raw.get('rendered', title_raw.get('raw', '')) if isinstance(title_raw, dict) else str(title_raw)
        title = re.sub(r'<[^>]+>', '', title)

        # Determine main keyword (priority: AutoWP task > first tag > empty)
        keyword = task_post_id_to_kw.get(post_id, '')
        if not keyword:
            tag_ids = post.get('tags', [])
            if tag_ids:
                keyword = tag_id_to_name.get(tag_ids[0], '')

        result_posts.append({
            'id': post_id,
            'title': title,
            'link': post.get('link', ''),
            'date': (post.get('date', '') or '')[:10],  # YYYY-MM-DD
            'status': post.get('status', ''),
            'keyword': keyword,
        })

    # Sort by date descending (newest first)
    result_posts.sort(key=lambda p: p['date'], reverse=True)

    return jsonify({
        'posts': result_posts,
        'total': len(result_posts),
    })


@keywords_bp.route('/research', methods=['POST'])
@jwt_required
def research():
    """Research long-tail keywords using Google Autocomplete only (free, no API key required)."""
    data = request.get_json()

    if not data or not data.get('keyword'):
        return jsonify({'error': '請提供關鍵字'}), 400

    keyword = data['keyword'].strip()

    # Google Autocomplete (free)
    google_keywords = _fetch_google_suggestions(keyword)

    # Merge and deduplicate
    seen = set()
    merged = []
    for kw in google_keywords:
        kw = kw.strip()
        if not kw or kw in seen:
            continue
        if len(kw) < 2 or len(kw) > 50:
            continue
        if kw == keyword:
            continue
        seen.add(kw)
        merged.append(kw)

    merged = merged[:30]

    return jsonify({
        'keywords': merged,
        'sources': {'google': len(google_keywords)},
        'used_claude': False,
    })


def _fetch_google_suggestions(keyword):
    """Fetch keyword suggestions from Google Autocomplete API (free, no key required).

    Queries multiple variants to maximise coverage:
    - bare keyword and suffix-based variants
    - prefix-based variants (Chinese search patterns)
    """
    suffix_variants = [
        keyword,
        f'{keyword} 怎麼',
        f'{keyword} 如何',
        f'{keyword} 推薦',
        f'{keyword} 最佳',
        f'{keyword} 比較',
        f'{keyword} 費用',
        f'{keyword} 教學',
        f'{keyword} 是什麼',
        f'{keyword} 工具',
        f'{keyword} 技巧',
        f'{keyword} 入門',
        f'{keyword} 問題',
        f'{keyword} 免費',
    ]
    prefix_variants = [
        f'如何 {keyword}',
        f'什麼是 {keyword}',
        f'為什麼 {keyword}',
    ]
    all_variants = suffix_variants + prefix_variants

    headers = {'User-Agent': 'Mozilla/5.0 (compatible; keyword-research-tool/1.0)'}
    all_suggestions = []

    for query in all_variants:
        try:
            resp = requests.get(
                'https://suggestqueries.google.com/complete/search',
                params={'output': 'toolbar', 'hl': 'zh-TW', 'q': query},
                headers=headers,
                timeout=8,
            )
            resp.raise_for_status()
            root = ET.fromstring(resp.content)
            for suggestion in root.iter('suggestion'):
                text = suggestion.get('data', '').strip()
                if text:
                    all_suggestions.append(text)
        except Exception:
            continue

    return all_suggestions

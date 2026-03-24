"""Shared keyword research service using Google Autocomplete (free, no API key)."""
import re
import xml.etree.ElementTree as ET

import requests

DEFAULT_TOPIC = '幫客戶架設網站做SEO的廠商'

# Fallback seeds for the SEO / website-building niche
_NICHE_FALLBACK_SEEDS = ['SEO服務', 'SEO優化', '網站架設', 'SEO廠商推薦', '網站優化', '關鍵字排名', '網站設計']


def extract_seed_keywords(topic):
    """Extract short, Google-friendly seed keywords from a topic description.

    Strips common Chinese function words and returns 2–8 character segments
    that are likely to produce Autocomplete results.
    """
    # Remove common single-character function words
    cleaned = re.sub(r'[幫為是做的地得了也都和與或但而因所以如雖然不過]', ' ', topic)
    parts = re.split(r'[\s,，、。；/]+', cleaned)
    seeds = []
    for part in parts:
        part = part.strip()
        if 2 <= len(part) <= 10:
            seeds.append(part)
    return seeds


def fetch_google_suggestions(keyword):
    """Fetch long-tail keyword suggestions from Google Autocomplete.

    Uses multiple query variants to maximise coverage.
    Returns a list of suggestion strings (may contain duplicates across variants).
    """
    suffix_variants = [
        keyword,
        f'{keyword} 怎麼做',
        f'{keyword} 推薦',
        f'{keyword} 費用',
        f'{keyword} 教學',
        f'{keyword} 是什麼',
        f'{keyword} 工具',
        f'{keyword} 技巧',
        f'{keyword} 入門',
        f'{keyword} 比較',
        f'{keyword} 服務',
        f'{keyword} 案例',
        f'{keyword} 流程',
    ]
    prefix_variants = [
        f'如何 {keyword}',
        f'什麼是 {keyword}',
        f'為什麼需要 {keyword}',
        f'{keyword} 怎麼選',
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


def fetch_suggestions_for_topic(topic):
    """Fetch suggestions for a topic description.

    If the topic is too long to return Autocomplete results directly,
    extracts shorter seed keywords and queries each one.
    Falls back to niche-specific seeds if no seeds can be extracted.
    """
    topic = (topic or DEFAULT_TOPIC).strip()

    # Try the topic directly first
    suggestions = fetch_google_suggestions(topic)

    # If the full topic returned nothing (too long/specific), try shorter seeds
    if not suggestions:
        seeds = extract_seed_keywords(topic)
        if not seeds:
            seeds = _NICHE_FALLBACK_SEEDS
        for seed in seeds:
            suggestions.extend(fetch_google_suggestions(seed))

    return suggestions

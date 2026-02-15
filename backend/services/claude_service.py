import json
import re
from datetime import datetime

from anthropic import Anthropic

DEFAULT_PROMPT = r"""# ROLE
你是一位擁有 10 年經驗的 SEO 內容策略專家與 AI Agent。你專精 Google E-E-A-T 原則、Rank Math SEO 優化、搜尋意圖分析，以及 {{當前年份}} 年最新 SEO 趨勢。你只用繁體中文撰寫內容。你產出的 HTML 必須完全相容 WordPress Gutenberg 區塊編輯器格式。

**重要：現在是 {{當前年份}} 年。** 文章中任何提到年份的地方，「今年」= {{當前年份}}、「明年」= {{明年}}、「去年」= {{去年}}。標題、內容、SEO 欄位中出現的年份都必須正確反映時間。

你是一個 Agent：請先分析關鍵字的搜尋意圖（資訊型/交易型/導航型/商業調查型），再決定文章的結構與語氣。

# INPUT
- 關鍵字: {{關鍵字}}
- 標題: {{標題}}
- 方向: {{方向}}
- 個人經驗/素材: {{素材}}
- 語氣風格: {{語氣}}
- 目標字數: {{目標字數}}
- CTA 內容: {{CTA內容}}

# AGENT 思考步驟（Chain of Thought）
1. **搜尋意圖分析**：判斷此關鍵字屬於 informational / transactional / navigational / commercial investigation 哪種類型
2. **目標讀者畫像**：判斷目標讀者的知識水準、痛點與需求
3. **競爭內容分析**：思考目前搜尋結果前 10 名可能涵蓋的內容，找出差異化角度
4. **語義關鍵字拓展**：列出 LSI（Latent Semantic Indexing）相關詞彙與長尾關鍵字
5. **文章結構規劃**：決定最佳的 H2/H3 層級結構，確保涵蓋主題群集（Topic Cluster）
6. **E-E-A-T 融入策略**：規劃如何展現經驗、專業、權威、可信度
7. **撰寫高品質內容**：結合以上分析產出內容
8. **Rank Math SEO 欄位填寫**：最佳化所有 SEO 欄位

# RULES

## 一、E-E-A-T 內容品質規則（{{當前年份}} 最新）
1. **Experience（經驗）**：若有提供「個人經驗/素材」，必須自然融入文章中，以第一人稱敘述增加真實感。即使沒有素材，也應以「實際操作過的專家」角度撰寫，展現第一手經驗
2. **Expertise（專業）**：內容必須有深度，提供可操作的具體建議，而非表面泛泛而談。引用數據、研究、案例來支撐論點
3. **Authoritativeness（權威）**：使用確定性語氣，避免「可能」「也許」等模糊用語。在適當處引用權威來源
4. **Trustworthiness（可信度）**：資訊必須準確、最新。若涉及 YMYL（Your Money Your Life）主題，需格外嚴謹

## 二、內容結構與可讀性規則
5. 段落控制 2-4 句，每 250-350 字換一個 H2 或 H3，確保閱讀節奏
6. 關鍵字密度 1-2%，自然融入上下文，同段不超過 2 次。同時融入 LSI 語義相關詞
7. 列舉用 Gutenberg 列表區塊，比較用 Gutenberg 表格區塊，步驟用有序列表
8. 結尾加 FAQ（至少 3 題，使用 H3 + P 直接展開格式，不使用 details/summary 收合）和 CTA
9. 標點使用全形，中英文與數字之間不加空格
10. 適當使用 `<strong>` 標記重要關鍵詞（每段最多 1-2 個），有助 SEO 但避免過度使用

## 三、{{當前年份}} SEO 最佳實踐
11. **搜尋意圖優先**：內容必須精準匹配使用者搜尋意圖，而非只是塞滿關鍵字
12. **主題群集策略**：文章應涵蓋該主題的完整面向，建立主題權威性（Topical Authority）
13. **語義搜尋優化**：自然融入語義相關詞彙、同義詞、相關問題，幫助搜尋引擎理解內容深度
14. **AI Overview 優化**：結構化的問答格式、清晰的定義段落、列表式重點，有助於被 Google AI Overview 引用
15. **語音搜尋友善**：FAQ 問題使用自然口語化的完整問句，答案開頭直接回答問題
16. **Core Web Vitals 友善**：HTML 結構簡潔乾淨，避免不必要的巢狀標籤，確保頁面載入效能
17. **先列點再說明**：當有多項重點要介紹時，先用列表列出所有要點，再逐項展開詳細說明。讓讀者能快速掌握全貌
18. **善用表格比較**：當涉及多個選項、工具、方案的比較時，優先使用 Gutenberg 表格區塊呈現，讓差異一目了然
19. **專有名詞超連結**：文章中首次出現的專有名詞、技術術語或品牌名稱，使用 `<a href="高權重說明網站網址" target="_blank" rel="noopener">專有名詞</a>` 連結到該名詞的權威說明頁面（如 Wikipedia、官方文件、MDN 等高權重網站）。同一名詞僅在首次出現時加連結，後續出現不再重複

## 四、WordPress Gutenberg 區塊格式規則（重要！）
所有 HTML 輸出必須嚴格使用 WordPress Gutenberg 區塊格式，確保貼到 WordPress 後可直接辨識為區塊，不需手動調整。

### 標題區塊
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">H2 標題文字</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">H3 標題文字</h3>
<!-- /wp:heading -->

### 段落區塊
<!-- wp:paragraph -->
<p>段落內容文字。</p>
<!-- /wp:paragraph -->

### 無序列表區塊
<!-- wp:list -->
<ul class="wp-block-list">
<li>項目一</li>
<li>項目二</li>
<li>項目三</li>
</ul>
<!-- /wp:list -->

### 有序列表區塊
<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li>步驟一</li>
<li>步驟二</li>
<li>步驟三</li>
</ol>
<!-- /wp:list -->

### 表格區塊
<!-- wp:table -->
<figure class="wp-block-table"><table><thead><tr><th>欄位1</th><th>欄位2</th></tr></thead><tbody><tr><td>資料1</td><td>資料2</td></tr></tbody></table></figure>
<!-- /wp:table -->

### 圖片區塊（圖片標籤會由系統自動插入，content 中不需包含）
<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="圖片網址" alt="SEO alt 文字"/></figure>
<!-- /wp:image -->

### 分隔線區塊
<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->

### 引用區塊
<!-- wp:quote -->
<blockquote class="wp-block-quote">
<!-- wp:paragraph -->
<p>引用內容</p>
<!-- /wp:paragraph -->
</blockquote>
<!-- /wp:quote -->

**注意**：content 欄位中不要包含圖片區塊（圖片由系統自動插入到前三個 H2 段落後方）。

## 五、FAQ 區塊格式（不使用 details/summary 收合）
FAQ 必須使用 H3 標題 + 段落的直接展開格式，讓所有問答內容直接可見：

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">常見問題 FAQ</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Q1: 問題文字？</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>答案文字。直接展開顯示，不使用收合元素。</p>
<!-- /wp:paragraph -->

# OUTPUT STRUCTURE
1. **開場段落**（痛點共鳴 + 解決方案預告 + 為什麼這篇文章值得讀。用 Gutenberg 段落區塊）
2. **本篇重點**（3-5 點重點摘要，用 Gutenberg 列表區塊，方便被 AI Overview 引用）
3. **H2/H3 章節內容**（{{目標字數}}+ 字，至少 4 個 H2 段落，每段有實用建議。全部使用 Gutenberg 區塊格式）
4. **FAQ 區塊**（至少 3 題，使用 H3 + P 直接展開格式，問題用自然口語化完整問句）
5. **CTA 段落**（明確的行動呼籲，使用 Gutenberg 段落區塊）

# RANK MATH SEO 欄位要求
- seo_title: 與文章標題（title）保持一致，不要另外產生不同的標題
- seo_description: 含關鍵字的 Meta 描述，150-160 字元（位元組），包含行動呼籲和明確價值主張
- focus_keyword: 主要關鍵字，只填 1 個（通常就是輸入的關鍵字，不要填多個避免衝突）

# JSON OUTPUT FORMAT
{
  "title": "文章標題（用於 WordPress 文章標題，含關鍵字，吸引點擊，不超過 30 字）",
  "slug": "english-slug-with-keyword（全小寫、用連字號分隔）",
  "content": "完整 Gutenberg 格式 HTML 文章（使用上述所有 wp:heading / wp:paragraph / wp:list / wp:table 等區塊格式，不含圖片標籤，{{目標字數}}+ 字）",
  "excerpt": "文章摘要 100-150 字，含關鍵字，用於 WordPress 摘要欄位",
  "seo": {
    "title": "SEO 標題",
    "description": "Meta 描述",
    "focus_keyword": "主要關鍵字（只填1個）"
  }
}

# 重要提醒
1. content 欄位的 HTML 必須是可以直接貼進 WordPress Gutenberg 編輯器的格式
2. 不要在 content 中包含圖片（圖片由系統自動插入）
3. FAQ 絕對不要使用 <details><summary> 收合格式，使用 H3 + P 直接展開
4. 確保 JSON 格式正確，所有字串中的引號要正確轉義
5. content 中的 HTML 不要有多餘的空行或縮排
6. 每個 Gutenberg 區塊的開始和結束註解之間不要有多餘的空白"""


def generate_article(api_key, keyword, title=None, direction=None, material=None,
                     custom_prompt=None, tone=None, target_words=None, cta_content=None):
    """Call Claude API to generate a SEO blog article.

    Args:
        api_key: Decrypted Anthropic API key.
        keyword: Target SEO keyword (required).
        title: Article title (optional, defaults to keyword).
        direction: Writing direction/angle (optional).
        material: Personal experience/material (optional).
        custom_prompt: User's custom prompt template (optional).
        tone: Writing tone (optional, defaults to '專業且親切').
        target_words: Target word count (optional, defaults to '1500').
        cta_content: CTA content (optional, defaults to '通用型 CTA').

    Returns:
        Parsed dict with article data (title, slug, content, seo, image_prompts, image_alts, excerpt).

    Raises:
        ValueError: If the API response cannot be parsed as valid JSON.
        anthropic.APIError: If the API call fails.
    """
    prompt_template = custom_prompt if custom_prompt else DEFAULT_PROMPT

    # Replace template variables
    current_year = datetime.now().year
    prompt = prompt_template.replace('{{當前年份}}', str(current_year))
    prompt = prompt.replace('{{明年}}', str(current_year + 1))
    prompt = prompt.replace('{{去年}}', str(current_year - 1))
    prompt = prompt.replace('{{關鍵字}}', keyword)
    prompt = prompt.replace('{{標題}}', title or keyword)
    prompt = prompt.replace('{{方向}}', direction or '無')
    prompt = prompt.replace('{{素材}}', material or '無')
    prompt = prompt.replace('{{語氣}}', tone or '專業且親切')
    prompt = prompt.replace('{{目標字數}}', str(target_words or '1500'))
    prompt = prompt.replace('{{CTA內容}}', cta_content or '通用型 CTA')

    client = Anthropic(api_key=api_key)
    response = client.messages.create(
        model='claude-sonnet-4-5-20250929',
        max_tokens=8192,
        messages=[{'role': 'user', 'content': prompt}],
    )

    # Extract text from response
    text = response.content[0].text

    # Parse JSON from the response (may be wrapped in ```json ... ```)
    json_match = re.search(r'```json\s*(.*?)\s*```', text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find raw JSON object
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            raise ValueError('Claude 回應中找不到有效的 JSON 格式')

    result = json.loads(json_str)

    # Validate required fields
    required_fields = ['title', 'content', 'seo']
    for field in required_fields:
        if field not in result:
            raise ValueError(f'Claude 回應缺少必要欄位: {field}')

    return result

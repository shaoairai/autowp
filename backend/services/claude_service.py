import json
import re
from datetime import datetime

from anthropic import Anthropic

DEFAULT_PROMPT = r"""# ROLE
你是一位擁有10年經驗的SEO內容策略專家與AI Agent，專精Google E-E-A-T、Rank Math SEO、搜尋意圖分析，以及{{當前年份}}年最新SEO趨勢。全程只用繁體中文撰寫內容。輸出必須為完全相容WordPress Gutenberg區塊編輯器的HTML（包含區塊註解）。

重要：現在是{{當前年份}}年。文章中任何提到年份的地方，「今年」= {{當前年份}}、「明年」= {{明年}}、「去年」= {{去年}}。標題、內容、SEO欄位中出現年份都必須正確反映時間。

你是一個Agent：必須先分析關鍵字搜尋意圖（資訊型/交易型/導航型/商業調查型），再決定文章的結構、段落順序與內容深度。文章必須緊扣主要關鍵字與本篇指令，不可跑題。

# INPUT（你只能使用以下輸入，不可自行假設未提供的商業資訊或虛構可驗證的案例/數字/客戶名稱）
- 主要關鍵字：{{keyword}}
- 文章標題（選填；若空白，請依搜尋意圖生成最適合且不跑題的標題，必要時可包含年份）：{{title}}
- 作者背景（固定可調參數；用於E-E-A-T與作者視角，但不得喧賓奪主）：{{author_background}}
- 本篇指令（融合欄位：包含內容方向＋必答重點＋讀者＋限制；必須嚴格遵守）：{{article_instruction}}

# 固定寫作設定（不可更改）
- 語氣風格：專業顧問感、直接、可執行、避免空話
- 目標字數：至少2000字（可略多但不要灌水）
- CTA內容：由你根據搜尋意圖與文章內容自行設計，務必明確、可行動、與本文一致（例如：填表詢價/預約諮詢/下載檢核清單/索取報價拆解）

# AGENT 任務步驟（強制順序）
1) 搜尋意圖分析：判斷主要關鍵字意圖，並用1句話說明「使用者此刻最想得到什麼」。
2) 目標讀者畫像：用3點描述讀者痛點、擔心、決策障礙（必須貼合本篇指令）。
3) 語義關鍵字拓展：列出LSI相關詞與長尾關鍵字（至少12個），後續要自然融入。
4) 文章結構規劃：先輸出H2/H3大綱（至少4個H2），並在每個H2後用【目的：解惑/比較/轉換/信任】標註其作用；大綱必須覆蓋本篇指令中的所有必答點。
5) 撰寫全文：依大綱寫出全文（>=2000字），符合下列規則。
6) Rank Math SEO欄位：輸出SEO title/description/focus keyword。

# E-E-A-T 內容品質規則（{{當前年份}}最新）
- Experience（經驗）：以第一人稱寫作，至少插入2段「實務情境」描述（例如：客戶常見誤解、做案決策點、踩坑與解法、驗收與維護常見問題）。不得虛構可驗證的數字、客戶名稱、專案細節；若沒有素材，使用「常見實務情境」敘述。
- Expertise（專業）：內容必須有深度與可操作性，提供步驟、檢核清單、決策準則、比較表，不可只講概念。
- Authoritativeness（權威）：用確定性語氣，避免「可能」「也許」等模糊措辭。首次出現的專有名詞/技術術語/品牌名稱，必須加上權威來源超連結（WordPress官方文件、Google開發者文件、MDN、Wikipedia等），同一名詞僅首次加連結，後續不重複。
- Trustworthiness（可信度）：資訊必須準確、最新。不捏造統計數字；若提到數據，必須能合理對應權威來源或以「常見情況」表述。

# 內容結構與可讀性規則
- 段落控制2-4句；每250-350字至少出現一個H2或H3，維持閱讀節奏。
- 主要關鍵字密度1-2%，自然融入上下文；同段不超過2次；同時融入LSI語義相關詞。
- 列舉用Gutenberg列表區塊；步驟用有序列表；比較優先用Gutenberg表格區塊。
- 結尾必須包含FAQ（至少3題，使用H3+P直接展開，不使用details/summary）與CTA段落。
- 標點使用全形；中英文與數字之間不加空格。
- 每段最多1-2個<strong>，避免過度。

# AI Overview 與語音搜尋友善（{{當前年份}}）
- 重要定義或結論段落要清楚、短句化、先回答再解釋。
- FAQ問題要用自然口語化完整問句，答案第一句直接回答問題。

# WordPress Gutenberg 區塊格式規則（重要）
所有HTML輸出必須嚴格使用WordPress Gutenberg區塊格式（包含<!-- wp:paragraph -->、<!-- wp:heading -->、<!-- wp:list -->、<!-- wp:table -->、<!-- wp:image -->等註解）。

<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">H2 標題</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>段落內容。</p>
<!-- /wp:paragraph -->

<!-- wp:list -->
<ul class="wp-block-list">
<li>項目一</li>
<li>項目二</li>
</ul>
<!-- /wp:list -->

<!-- wp:list {"ordered":true} -->
<ol class="wp-block-list">
<li>步驟一</li>
<li>步驟二</li>
</ol>
<!-- /wp:list -->

<!-- wp:table -->
<figure class="wp-block-table"><table><thead><tr><th>欄位1</th><th>欄位2</th></tr></thead><tbody><tr><td>資料1</td><td>資料2</td></tr></tbody></table></figure>
<!-- /wp:table -->

# Unsplash 圖片規則（每個H2章節結尾必插入1張）
在每個H2章節結尾插入一個Gutenberg image區塊。
圖片來源使用動態URL：https://source.unsplash.com/1600x900/?{英文關鍵字1},{英文關鍵字2}
關鍵字必須貼近該段落主題，避免過度抽象。
圖片alt必須等於該H2標題文字（完全一致）。

<!-- wp:image {"sizeSlug":"large"} -->
<figure class="wp-block-image size-large"><img src="https://source.unsplash.com/1600x900/?seo,content" alt="H2標題文字"/></figure>
<!-- /wp:image -->

# FAQ 格式（不使用details/summary）
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">常見問題 FAQ</h2>
<!-- /wp:heading -->

<!-- wp:heading {"level":3} -->
<h3 class="wp-block-heading">Q1: 問題文字？</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>答案直接展開。</p>
<!-- /wp:paragraph -->

# OUTPUT（JSON格式；禁止輸出任何額外說明文字）
{
  "title": "文章標題",
  "slug": "english-slug-with-keyword",
  "content": "完整Gutenberg格式HTML文章",
  "excerpt": "文章摘要100-150字",
  "seo": {
    "title": "SEO標題（必須與title完全一致）",
    "description": "Meta描述150-160字元，必須包含主要關鍵字",
    "focus_keyword": "主要關鍵字（只填1個）"
  }
}

# 重要提醒
1. content欄位的HTML必須可以直接貼進WordPress Gutenberg編輯器
2. FAQ絕對不要使用<details><summary>收合格式，使用H3+P直接展開
3. 確保JSON格式正確，所有字串中的引號要正確轉義
4. 每個Gutenberg區塊的開始和結束註解之間不要有多餘空白"""


def generate_article(api_key, keyword, title=None, author_background=None, article_instruction=None,
                     custom_prompt=None, direction=None, material=None):
    """Call Claude API to generate a SEO blog article.

    Args:
        api_key: Decrypted Anthropic API key.
        keyword: Target SEO keyword (required).
        title: Article title (optional).
        author_background: Author background for E-E-A-T (optional).
        article_instruction: Article direction + requirements (optional).
        custom_prompt: User's custom prompt template (optional).
        direction: Deprecated alias for author_background.
        material: Deprecated alias for article_instruction.
    """
    # Backwards compat: prefer new names, fall back to old
    author_bg = author_background or direction or ''
    article_inst = article_instruction or material or ''

    prompt_template = custom_prompt if custom_prompt else DEFAULT_PROMPT

    # Replace template variables
    current_year = datetime.now().year
    prompt = prompt_template.replace('{{當前年份}}', str(current_year))
    prompt = prompt.replace('{{明年}}', str(current_year + 1))
    prompt = prompt.replace('{{去年}}', str(current_year - 1))
    # New variable names (used in new prompt)
    prompt = prompt.replace('{{keyword}}', keyword)
    prompt = prompt.replace('{{title}}', title or keyword)
    prompt = prompt.replace('{{author_background}}', author_bg or '無')
    prompt = prompt.replace('{{article_instruction}}', article_inst or '無')
    # Legacy variable names (for old custom prompts stored by users)
    prompt = prompt.replace('{{關鍵字}}', keyword)
    prompt = prompt.replace('{{標題}}', title or keyword)
    prompt = prompt.replace('{{方向}}', author_bg or '無')
    prompt = prompt.replace('{{素材}}', article_inst or '無')
    prompt = prompt.replace('{{語氣}}', '專業顧問感')
    prompt = prompt.replace('{{目標字數}}', '2000')
    prompt = prompt.replace('{{CTA內容}}', '由AI根據文章自行設計')

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

    result['_prompt_snapshot'] = prompt

    return result

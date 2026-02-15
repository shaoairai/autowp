# AutoWP 技術架構建議文件

> 最後更新：2026-02-15
> 適用範圍：完全脫離 n8n 的部落格自動產文系統

---

## 一、推薦技術棧與版本

| 層級 | 技術 | 推薦版本 | 說明 |
|------|------|----------|------|
| 後端框架 | Flask | 3.1.x | 輕量、成熟、Blueprint 模組化支援完善 |
| WSGI Server | Gunicorn | 22.x | 生產環境必備，搭配 gevent worker 支援 SSE |
| 資料庫 | PostgreSQL | 16.x | 穩定、效能佳、JSON 欄位支援好 |
| ORM | SQLAlchemy + Flask-SQLAlchemy | 2.x (Flask-SQLAlchemy) / 2.0+ (SQLAlchemy) | 成熟 ORM，支援 migration |
| 資料庫遷移 | Flask-Migrate (Alembic) | 4.x | 版本化資料庫 schema 變更 |
| 認證 | Flask-JWT-Extended | 4.7.x | JWT access + refresh token，支援 token freshness |
| AI 文章生成 | Anthropic Python SDK | 1.x+ | Claude API，支援 structured output |
| AI 圖片生成 | Google GenAI Python SDK | 1.x+ | Gemini 2.5 Flash Image 模型 |
| CMS 發布 | WordPress REST API v2 | - | 搭配 Application Passwords 認證 |
| SEO | Rank Math API Manager Plugin | 1.x | 透過自訂 REST endpoint 更新 SEO meta |
| 加密 | cryptography (Fernet) | 44.x+ | 對稱加密 API Key 存儲 |
| 反向代理 | Nginx | 1.26+ | 反向代理 + 靜態檔案 + SSL termination |
| 容器化 | Docker + Docker Compose | Engine 25.0+ / Compose 2.22+ | 一鍵部署 |
| 即時通訊 | Server-Sent Events (SSE) | - | Flask 原生 Response + text/event-stream |

---

## 二、檔案結構建議

```
autowp/
├── docker-compose.yaml
├── .env.example                  # 環境變數範本（不含真實金鑰）
├── .gitignore
├── docs/
│   └── architecture.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── wsgi.py                   # Gunicorn 進入點
│   ├── config.py                 # 設定檔（從環境變數讀取）
│   ├── app.py                    # Application Factory
│   ├── extensions.py             # Flask 擴充初始化（db, jwt, migrate）
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py               # 使用者模型
│   │   ├── article.py            # 文章模型（含狀態追蹤）
│   │   ├── wp_site.py            # WordPress 站台設定
│   │   └── api_key.py            # 加密存儲的 API Key
│   ├── routes/
│   │   ├── __init__.py           # 註冊所有 Blueprint
│   │   ├── auth.py               # 認證相關 API
│   │   ├── articles.py           # 文章 CRUD + 生成觸發
│   │   ├── wp_sites.py           # WordPress 站台管理
│   │   ├── settings.py           # API Key 管理
│   │   └── sse.py                # SSE 即時進度推送
│   ├── services/
│   │   ├── __init__.py
│   │   ├── claude_service.py     # Claude API 呼叫邏輯
│   │   ├── gemini_service.py     # Gemini 圖片生成邏輯
│   │   ├── wordpress_service.py  # WordPress 發文 + 媒體上傳
│   │   ├── seo_service.py        # Rank Math SEO meta 更新
│   │   ├── crypto_service.py     # Fernet 加密/解密
│   │   └── email_service.py      # SMTP 寄信服務
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── decorators.py         # 自訂裝飾器
│   │   └── validators.py         # 輸入驗證
│   └── migrations/               # Flask-Migrate 自動產生
├── frontend/
│   ├── index.html                # SPA 入口
│   ├── css/
│   │   └── style.css             # 扁平化黑底設計
│   └── js/
│       ├── app.js                # 主程式
│       ├── api.js                # API 呼叫封裝
│       ├── auth.js               # 認證相關
│       ├── sse.js                # SSE 連線管理
│       └── components/           # UI 元件
└── nginx/
    ├── Dockerfile
    └── nginx.conf                # Nginx 設定檔
```

---

## 三、Application Factory 模式

```python
# backend/app.py
from flask import Flask
from .extensions import db, jwt, migrate
from .routes import register_blueprints

def create_app(config_name=None):
    app = Flask(__name__)
    app.config.from_object(f'config.{config_name or "ProductionConfig"}')

    # 初始化擴充
    db.init_app(app)
    jwt.init_app(app)
    migrate.init_app(app, db)

    # 註冊 Blueprint
    register_blueprints(app)

    return app
```

```python
# backend/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_migrate import Migrate

db = SQLAlchemy()
jwt = JWTManager()
migrate = Migrate()
```

```python
# backend/routes/__init__.py
def register_blueprints(app):
    from .auth import auth_bp
    from .articles import articles_bp
    from .wp_sites import wp_sites_bp
    from .settings import settings_bp
    from .sse import sse_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(articles_bp, url_prefix='/api/articles')
    app.register_blueprint(wp_sites_bp, url_prefix='/api/wp-sites')
    app.register_blueprint(settings_bp, url_prefix='/api/settings')
    app.register_blueprint(sse_bp, url_prefix='/api/sse')
```

---

## 四、外部 API 呼叫方式與注意事項

### 4.1 Claude API（文章生成）

**SDK**: `anthropic` Python SDK（`pip install anthropic`）

**推薦做法 - Structured Output（2025-11 公開 Beta）**：

```python
from pydantic import BaseModel
from anthropic import Anthropic

class ArticleOutput(BaseModel):
    title: str
    meta_title: str
    meta_description: str
    focus_keyword: str
    content: str          # Gutenberg HTML 格式
    slug: str
    categories: list[str]

client = Anthropic(api_key=decrypted_api_key)

response = client.beta.messages.parse(
    model="claude-sonnet-4-5-20250929",
    max_tokens=8192,
    betas=["structured-outputs-2025-11-13"],
    messages=[
        {"role": "user", "content": prompt}
    ],
    response_model=ArticleOutput
)

article = response.parsed  # 型別安全的 ArticleOutput 物件
```

**注意事項**：
- Structured Output 目前支援 Claude Sonnet 4.5 和 Opus 4.1+
- 需要加上 beta header `structured-outputs-2025-11-13`
- `.parse()` 方法自動處理 schema 轉換和驗證
- 如果不使用 structured output，也可用 tool use 方式強制 JSON 格式
- API Key 必須加密存儲，執行時解密
- 建議設定合理的 `max_tokens`，長文可設到 8192

**備選方案 - Tool Use（穩定版）**：

```python
response = client.messages.create(
    model="claude-sonnet-4-5-20250929",
    max_tokens=8192,
    tools=[{
        "name": "generate_article",
        "description": "Generate a blog article",
        "input_schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "content": {"type": "string"},
                "meta_title": {"type": "string"},
                "meta_description": {"type": "string"},
                "focus_keyword": {"type": "string"}
            },
            "required": ["title", "content", "meta_title", "meta_description", "focus_keyword"]
        }
    }],
    tool_choice={"type": "tool", "name": "generate_article"},
    messages=[{"role": "user", "content": prompt}]
)
```

### 4.2 Gemini 圖片生成

**SDK**: `google-genai`（`pip install google-genai`）

**推薦模型**: `gemini-2.5-flash-image`（2025 Q4 正式版）

```python
from google import genai
from google.genai import types
import io
from PIL import Image

client = genai.Client(api_key=decrypted_gemini_key)

response = client.models.generate_content(
    model="gemini-2.5-flash-image",
    contents=prompt,
    config=types.GenerateContentConfig(
        response_modalities=["IMAGE"],
        image_config=types.ImageConfig(
            aspect_ratio="16:9"   # 部落格常用比例
        )
    )
)

# 從回應中提取圖片
for part in response.candidates[0].content.parts:
    if part.inline_data:
        image_bytes = part.inline_data.data
        image = Image.open(io.BytesIO(image_bytes))
        # 儲存或直接上傳到 WordPress
        buf = io.BytesIO()
        image.save(buf, format="PNG")
        buf.seek(0)
```

**注意事項**：
- 舊的 preview 模型 `gemini-2.0-flash-preview-image-generation` 已於 2025-10-31 退役
- 每張圖片約 1290 output tokens，約 $0.039/張
- 支援的寬高比：`1:1`, `3:4`, `4:3`, `9:16`, `16:9`
- 可同時生成文字與圖片（`response_modalities=["Text", "Image"]`）
- 生成的圖片需轉為 bytes 後上傳至 WordPress

### 4.3 WordPress REST API v2

**認證方式**: Application Passwords（WordPress 5.6+ 內建）

```python
import requests
import base64

class WordPressClient:
    def __init__(self, site_url, username, app_password):
        self.base_url = f"{site_url}/wp-json/wp/v2"
        credentials = f"{username}:{app_password}"
        token = base64.b64encode(credentials.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {token}"
        }

    def upload_media(self, image_bytes, filename):
        """上傳圖片到媒體庫"""
        response = requests.post(
            f"{self.base_url}/media",
            headers={
                **self.headers,
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Type": "image/png"
            },
            data=image_bytes
        )
        response.raise_for_status()
        return response.json()["id"]  # 回傳 media ID

    def create_post(self, title, content, status="draft",
                    featured_media_id=None, categories=None):
        """建立文章"""
        data = {
            "title": title,
            "content": content,
            "status": status,
        }
        if featured_media_id:
            data["featured_media"] = featured_media_id
        if categories:
            data["categories"] = categories

        response = requests.post(
            f"{self.base_url}/posts",
            headers=self.headers,
            json=data
        )
        response.raise_for_status()
        return response.json()
```

**注意事項**：
- Application Password 格式為 24 字元，使用時需以 `username:password` 格式 Base64 編碼
- 上傳媒體時使用 `data=` 傳送 binary，不是 `json=`
- `Content-Disposition` header 必須包含檔名
- `featured_media` 欄位接受 media ID（整數）
- 文章 `status` 可為 `draft`、`publish`、`pending`
- 文章 `content` 應為完整 Gutenberg HTML（含 `<!-- wp:paragraph -->` 等標記）
- 建議先上傳圖片取得 media ID，再建立文章時帶入

### 4.4 Rank Math SEO Meta 更新

**前置需求**: 安裝 [Rank Math API Manager](https://github.com/Devora-AS/rank-math-api-manager) 外掛

```python
def update_seo_meta(self, post_id, seo_title, seo_description,
                    focus_keyword, canonical_url=None):
    """更新 Rank Math SEO 欄位"""
    data = {
        "post_id": post_id,
        "rank_math_title": seo_title,
        "rank_math_description": seo_description,
        "rank_math_focus_keyword": focus_keyword,
    }
    if canonical_url:
        data["rank_math_canonical_url"] = canonical_url

    response = requests.post(
        f"{self.site_url}/wp-json/rank-math-api/v1/update-meta",
        headers=self.headers,
        json=data
    )
    response.raise_for_status()
    return response.json()
```

**注意事項**：
- Rank Math 本身不提供直接的 REST API 更新 SEO meta 的功能
- 需安裝 Rank Math API Manager 外掛，暴露 `/wp-json/rank-math-api/v1/update-meta` endpoint
- 可更新的欄位：`rank_math_title`、`rank_math_description`、`rank_math_canonical_url`、`rank_math_focus_keyword`
- 認證方式與 WordPress REST API 相同（Application Passwords）
- 需要 `edit_posts` 權限

### 4.5 SMTP 寄信

```python
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_notification(to_email, subject, html_body):
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
        server.starttls()
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())
```

**注意事項**：
- 使用 `STARTTLS`（port 587）而非 SSL（port 465），相容性更好
- Gmail 需使用應用程式密碼，不能用帳號密碼
- 建議將寄信放入背景任務，避免阻塞 API 回應

---

## 五、JWT 認證架構

### 5.1 Token 策略

| Token 類型 | 過期時間 | 用途 |
|-----------|---------|------|
| Access Token | 15 分鐘 | API 請求認證 |
| Refresh Token | 30 天 | 換取新的 Access Token |

### 5.2 實作要點

```python
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity
)

@auth_bp.route('/login', methods=['POST'])
def login():
    # 驗證帳密後...
    access_token = create_access_token(
        identity=user.id,
        fresh=True  # 登入產生的是 fresh token
    )
    refresh_token = create_refresh_token(identity=user.id)
    return jsonify(
        access_token=access_token,
        refresh_token=refresh_token
    )

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    identity = get_jwt_identity()
    access_token = create_access_token(
        identity=identity,
        fresh=False  # refresh 產生的不是 fresh token
    )
    return jsonify(access_token=access_token)
```

### 5.3 安全建議

- Access Token 存放在前端記憶體（JavaScript 變數），不存 localStorage
- Refresh Token 存放在 httpOnly cookie（防 XSS）或 localStorage
- 敏感操作（如更改密碼、刪除站台）要求 fresh token（`@jwt_required(fresh=True)`）
- JWT secret key 從環境變數讀取，長度至少 256 bits
- 實作 token 黑名單機制（用 Redis 或資料庫表存已撤銷的 token）

---

## 六、Server-Sent Events（SSE）即時進度

### 6.1 實作方式

```python
import queue
from flask import Blueprint, Response, stream_with_context

sse_bp = Blueprint('sse', __name__)

# 每個用戶一個 queue
user_queues = {}

def get_user_queue(user_id):
    if user_id not in user_queues:
        user_queues[user_id] = queue.Queue()
    return user_queues[user_id]

@sse_bp.route('/stream')
@jwt_required()
def stream():
    user_id = get_jwt_identity()
    q = get_user_queue(user_id)

    def event_stream():
        while True:
            try:
                data = q.get(timeout=30)
                yield f"data: {json.dumps(data)}\n\n"
            except queue.Empty:
                yield ": keepalive\n\n"  # 防止連線斷開

    return Response(
        stream_with_context(event_stream()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no'  # 告訴 Nginx 不要 buffer
        }
    )

# 在 service 層推送進度
def push_progress(user_id, step, message, progress_pct):
    q = get_user_queue(user_id)
    q.put({
        "step": step,
        "message": message,
        "progress": progress_pct
    })
```

### 6.2 注意事項

- Gunicorn 需使用 `gevent` worker：`gunicorn -k gevent -w 4 wsgi:app`
- Nginx 設定需加 `proxy_buffering off;` 和 `X-Accel-Buffering: no`
- SSE 是單向的（server -> client），比 WebSocket 簡單且足夠用於進度回報
- 前端使用 `EventSource` API 連線
- 每 30 秒發送 keepalive 註解防止連線斷開

---

## 七、API Key 加密存儲（Fernet）

```python
from cryptography.fernet import Fernet, MultiFernet
import os

class CryptoService:
    def __init__(self):
        # 從環境變數讀取加密金鑰
        key = os.environ["ENCRYPTION_KEY"]  # Fernet.generate_key() 產生
        self.fernet = Fernet(key)

    def encrypt(self, plaintext: str) -> str:
        """加密 API Key，回傳 Base64 編碼的密文"""
        return self.fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """解密 API Key"""
        return self.fernet.decrypt(ciphertext.encode()).decode()
```

### 7.1 金鑰管理建議

- `ENCRYPTION_KEY` 用 `Fernet.generate_key()` 產生（32 bytes Base64 encoded）
- 金鑰只存在環境變數或 `.env` 檔，絕不進版本控制
- 考慮使用 `MultiFernet` 支援金鑰輪替（key rotation）
- PBKDF2 推導金鑰時，迭代次數至少 1,200,000（Django 2025 建議值）
- 加密後的密文存入資料庫，解密只在使用時進行

### 7.2 資料庫中的存儲

```python
class ApiKey(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    service_name = db.Column(db.String(50), nullable=False)  # 'anthropic', 'gemini', 'smtp'
    encrypted_key = db.Column(db.Text, nullable=False)        # Fernet 加密後的密文
    created_at = db.Column(db.DateTime, default=db.func.now())
    updated_at = db.Column(db.DateTime, onupdate=db.func.now())
```

---

## 八、PostgreSQL 資料表設計

### 8.1 核心資料表

```sql
-- 使用者
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- WordPress 站台
CREATE TABLE wp_sites (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    site_name VARCHAR(100) NOT NULL,
    site_url VARCHAR(255) NOT NULL,
    wp_username VARCHAR(100) NOT NULL,
    encrypted_app_password TEXT NOT NULL,  -- Fernet 加密
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- API 金鑰（加密存儲）
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    service_name VARCHAR(50) NOT NULL,    -- 'anthropic', 'gemini', 'smtp'
    encrypted_key TEXT NOT NULL,           -- Fernet 加密
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, service_name)
);

-- 文章
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    wp_site_id INTEGER REFERENCES wp_sites(id) ON DELETE SET NULL,
    title VARCHAR(255),
    slug VARCHAR(255),
    content TEXT,
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    focus_keyword VARCHAR(100),
    featured_image_url VARCHAR(500),
    wp_post_id INTEGER,                   -- WordPress 上的 post ID
    status VARCHAR(20) DEFAULT 'pending', -- pending, generating, generated, publishing, published, failed
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 生成任務日誌
CREATE TABLE generation_logs (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    step VARCHAR(50) NOT NULL,            -- 'claude_generate', 'gemini_image', 'wp_upload', 'wp_publish', 'seo_update'
    status VARCHAR(20) NOT NULL,          -- 'started', 'completed', 'failed'
    detail TEXT,
    tokens_used INTEGER,
    cost_usd NUMERIC(10, 6),
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 九、安全性建議

### 9.1 通用安全

1. **所有 API Key 加密存儲**：使用 Fernet 加密後存入 PostgreSQL，解密僅在呼叫外部 API 時進行
2. **環境變數管理**：`SECRET_KEY`、`ENCRYPTION_KEY`、`DATABASE_URL` 等敏感設定從 `.env` 讀取，絕不 hard-code
3. **HTTPS**：生產環境必須啟用 SSL/TLS（Let's Encrypt 免費憑證）
4. **CORS**：只允許特定 origin（前端 URL），使用 Flask-CORS
5. **Rate Limiting**：使用 Flask-Limiter 限制 API 呼叫頻率，防止濫用
6. **輸入驗證**：所有使用者輸入都要驗證和 sanitize，防止 XSS 和 SQL Injection（SQLAlchemy ORM 已防 SQL Injection）

### 9.2 JWT 安全

1. Access Token 短期（15 分鐘），Refresh Token 長期（30 天）
2. 敏感操作要求 fresh token
3. 實作 token 撤銷機制（blacklist）
4. JWT secret key 至少 256 bits

### 9.3 WordPress 安全

1. Application Password 加密存儲
2. WordPress 後台啟用 HTTPS
3. 建立專用的 API 使用者帳號，僅授予必要權限（Author 或 Editor）
4. 限制 REST API 存取來源（WordPress 安全外掛或 .htaccess）

### 9.4 Docker 安全

1. 不使用 `root` 使用者執行應用程式
2. 使用 `.dockerignore` 排除 `.env`、`.git` 等敏感檔案
3. 使用官方 base image，定期更新
4. 不在 image 中 hard-code 任何 secret

---

## 十、部署建議

### 10.1 Docker Compose 架構

```yaml
# docker-compose.yaml
version: "3.9"

services:
  nginx:
    build: ./nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend:/usr/share/nginx/html:ro
      - ./nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - backend
    restart: unless-stopped

  backend:
    build: ./backend
    expose:
      - "5000"
    env_file:
      - .env
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    command: gunicorn -k gevent -w 4 -b 0.0.0.0:5000 wsgi:app

  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
```

### 10.2 Nginx 設定

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 前端靜態檔案
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # 後端 API 反向代理
    location /api/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SSE 專用設定（不 buffer）
    location /api/sse/ {
        proxy_pass http://backend:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 86400s;  # 長連線
        proxy_set_header Connection '';
        chunked_transfer_encoding off;
    }
}
```

### 10.3 Backend Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# 不使用 root
RUN adduser --disabled-password --gecos '' appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 5000

CMD ["gunicorn", "-k", "gevent", "-w", "4", "-b", "0.0.0.0:5000", "wsgi:app"]
```

### 10.4 .env.example

```bash
# Flask
FLASK_ENV=production
SECRET_KEY=your-secret-key-here

# Database
POSTGRES_DB=autowp
POSTGRES_USER=autowp
POSTGRES_PASSWORD=change-me
DATABASE_URL=postgresql://autowp:change-me@db:5432/autowp

# JWT
JWT_SECRET_KEY=your-jwt-secret-key-here
JWT_ACCESS_TOKEN_EXPIRES=900
JWT_REFRESH_TOKEN_EXPIRES=2592000

# Encryption
ENCRYPTION_KEY=generate-with-Fernet.generate_key()

# SMTP (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=your-email@gmail.com
```

---

## 十一、完整生成流程

```
使用者點擊「生成文章」
    │
    ├─ 1. 前端送出 POST /api/articles/generate
    │     （含關鍵字、語氣、目標站台等參數）
    │
    ├─ 2. 後端建立 article record（status: generating）
    │     並回傳 article_id
    │
    ├─ 3. 前端開啟 SSE 連線 GET /api/sse/stream
    │     監聽生成進度
    │
    ├─ 4. 後端背景執行生成流程：
    │     │
    │     ├─ 4a. 解密 Claude API Key
    │     ├─ 4b. 呼叫 Claude API 生成 Gutenberg HTML 文章
    │     │       推送 SSE: {"step": "claude", "progress": 40}
    │     │
    │     ├─ 4c. 解密 Gemini API Key
    │     ├─ 4d. 呼叫 Gemini 生成特色圖片
    │     │       推送 SSE: {"step": "gemini", "progress": 60}
    │     │
    │     ├─ 4e. 解密 WordPress App Password
    │     ├─ 4f. 上傳圖片到 WordPress 媒體庫
    │     │       推送 SSE: {"step": "wp_media", "progress": 75}
    │     │
    │     ├─ 4g. 建立 WordPress 文章（含特色圖片）
    │     │       推送 SSE: {"step": "wp_post", "progress": 90}
    │     │
    │     ├─ 4h. 更新 Rank Math SEO meta
    │     │       推送 SSE: {"step": "seo", "progress": 95}
    │     │
    │     └─ 4i. 更新 article record（status: published）
    │             推送 SSE: {"step": "done", "progress": 100}
    │
    └─ 5. 前端顯示完成，提供 WordPress 文章連結
```

---

## 十二、參考資源

- [Flask Blueprints 官方文件](https://flask.palletsprojects.com/en/stable/blueprints/)
- [Anthropic Structured Outputs 文件](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)
- [Anthropic Python SDK](https://github.com/anthropics/anthropic-sdk-python)
- [Google GenAI Image Generation 文件](https://ai.google.dev/gemini-api/docs/image-generation)
- [WordPress REST API Media 文件](https://developer.wordpress.org/rest-api/reference/media/)
- [Rank Math API Manager Plugin](https://github.com/Devora-AS/rank-math-api-manager)
- [Flask-JWT-Extended 文件](https://flask-jwt-extended.readthedocs.io/en/stable/)
- [Fernet 加密文件](https://cryptography.io/en/latest/fernet/)
- [Dockerizing Flask with Postgres, Gunicorn, and Nginx](https://testdriven.io/blog/dockerizing-flask-with-postgres-gunicorn-and-nginx/)
- [Flask SSE 無依賴實作](https://maxhalford.github.io/blog/flask-sse-no-deps/)

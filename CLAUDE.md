# AutoWP — Claude 開發手冊

> **目的**：讓未來的 Claude 快速掌握當前系統狀態，在不破壞既有功能的前提下繼續開發。
> **最後更新**：2026-03-23

---

## 系統狀態總覽

| 功能模組 | 狀態 | 備註 |
|---|---|---|
| 使用者認證 (登入/註冊) | ✅ 正常 | JWT，1 天有效期 |
| 設定頁面 (API 金鑰管理) | ✅ 正常 | Fernet 加密存入 PostgreSQL |
| 文章生成 (Claude AI) | ✅ 正常 | SSE 串流，Sonnet 4.5 |
| WordPress 發佈 | ✅ 正常 | REST API，支援 draft/publish/pending |
| Rank Math SEO 設定 | ✅ 正常 | 使用原生 Rank Math endpoint |
| 任務記錄 (Logs) | ✅ 正常 | 含分頁、搜尋、內容預覽 |
| 排程發佈 | ✅ 正常 | APScheduler，每 60 秒檢查 |
| 關鍵字管理 | ✅ 正常 | 從 WP tags 抓取 |
| 長尾關鍵字研究 | ✅ 正常 | Google Autocomplete，17 種查詢變體 |
| Email 通知 | ❌ 未啟用/有問題 | Resend API 串接，**暫勿動** |

---

## 架構概覽

```
[使用者瀏覽器]
      |
[Nginx — 靜態前端 + 反向代理]
      |
[Flask/Gunicorn/gevent — API]
      |
[PostgreSQL — 資料庫]

外部服務：
- Traefik (反向代理，autowp.ottaster.com)
- Claude API (Anthropic)
- WordPress REST API
- Rank Math REST API
- Google Autocomplete API (免費，無需金鑰)
- Resend API (Email，❌ 暫有問題)
- HuggingFace API (圖片生成，基礎設施已建，**尚未整合到任何流程**)
```

---

## 目錄結構

```
autowp/
├── backend/
│   ├── app.py                      # Flask app 工廠，註冊所有 blueprint
│   ├── config.py                   # 環境變數讀取、JWT/DB 設定
│   ├── gunicorn.conf.py            # ⚠️ gevent monkey-patch 在此，絕不可移動
│   ├── requirements.txt
│   ├── models/
│   │   ├── __init__.py             # 統一 import 所有 models
│   │   ├── user.py
│   │   ├── task.py
│   │   ├── scheduled_post.py       # 排程發佈資料表
│   │   ├── setting.py
│   │   └── auth_log.py
│   ├── routes/
│   │   ├── __init__.py             # 統一 register 所有 blueprint
│   │   ├── auth.py                 # /api/auth
│   │   ├── settings.py             # /api/settings
│   │   ├── generate.py             # /api/generate (SSE 串流)
│   │   ├── tasks.py                # /api/tasks
│   │   ├── logs.py                 # /api/logs (admin only)
│   │   ├── schedule.py             # /api/schedule
│   │   └── keywords.py             # /api/keywords
│   ├── services/
│   │   ├── claude_service.py       # Claude API 呼叫、預設 prompt
│   │   ├── wordpress_service.py    # WP REST API + Rank Math
│   │   ├── email_service.py        # Resend API (❌ 暫有問題)
│   │   ├── scheduler.py            # APScheduler 初始化
│   │   └── image_service.py        # HuggingFace 圖片 (未整合)
│   └── utils/
│       ├── auth.py                 # JWT、@jwt_required、@admin_required
│       ├── database.py             # SQLAlchemy init、seed admin
│       └── crypto.py               # Fernet 加密/解密
├── frontend/
│   ├── index.html
│   ├── nginx.conf                  # 靜態服務 + SSE 特殊設定
│   ├── css/style.css
│   └── js/app.js                   # 2100+ 行單檔 SPA
├── docker-compose.yaml
└── CLAUDE.md                       # 本文件
```

---

## 關鍵技術細節（踩過的坑）

### 1. gevent monkey-patching（最重要）
`gunicorn.conf.py` 的第一行必須是：
```python
from gevent import monkey; monkey.patch_all()
```
**原因**：gevent 必須在任何其他 import 之前 patch，否則 SSL 會 RecursionError。
**規則**：不可使用 `--preload`，不可把 monkey-patch 移到 `app.py`。

### 2. Rank Math SEO（必看）
- WP 標準 REST API 的 `meta` 欄位**無法**讀寫 `rank_math_*` 的 key。
- **正確寫法**：POST 到 `/wp-json/rankmath/v1/updateMeta`，body 格式：
  ```json
  { "objectType": "post", "objectID": 123, "meta": { "rank_math_focus_keyword": "..." } }
  ```
- **沒有 GET endpoint**：無法透過 REST API 讀取 Rank Math meta，勿嘗試。

### 3. SQLAlchemy 多 worker 安全
```python
# database.py 中必須有：
SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}
db.engine.dispose()  # init_db() 後呼叫，讓每個 worker 建立新連線
```

### 4. WP 關鍵字來源
關鍵字優先順序：`AutoWP task.keyword` > `WP 文章的第一個 tag` > 空字串。
透過批次請求 `/wp-json/wp/v2/tags` 抓取，不可使用 `rank_math_focus_keyword`（見上）。

### 5. SSE 串流（Nginx 設定）
`/api/generate` 路由需要特殊 Nginx 設定（已設好）：
```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 86400s;
chunked_transfer_encoding on;
```
**勿動** `nginx.conf` 的 SSE 相關設定。

### 6. 瀏覽器快取策略
CSS/JS 使用 `Cache-Control: max-age=3600, must-revalidate`（不是 `immutable`），讓使用者能拿到更新。圖片/字型才用 `immutable`。

---

## API 端點完整列表

### Auth — `/api/auth`
| Method | Path | 說明 |
|---|---|---|
| POST | `/register` | 註冊 |
| POST | `/login` | 登入，回傳 JWT |
| POST | `/logout` | 登出 |
| GET | `/me` | 取得目前使用者 |

### Settings — `/api/settings`
| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 讀取設定（加密欄位顯示 `********`） |
| PUT | `/` | 更新設定 |

### Generate — `/api/generate`
| Method | Path | 說明 |
|---|---|---|
| POST | `/` | 完整生成流程（SSE 串流） |
| POST | `/upload` | 直接上傳內容到 WP（跳過 Claude） |

生成流程步驟：`ai_generating → wp_creating → seo_setting → email_sending`

### Tasks — `/api/tasks`
| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 列出任務（分頁） |
| GET | `/<id>` | 取得單一任務 |

### Schedule — `/api/schedule`
| Method | Path | 說明 |
|---|---|---|
| GET | `/` | 列出排程（分頁、搜尋、狀態篩選） |
| POST | `/` | 建立排程 |
| GET | `/<id>` | 取得排程詳情 |
| PUT | `/<id>` | 修改排程（只有 pending 狀態可改） |
| DELETE | `/<id>` | 刪除排程（只有 pending/cancelled 可刪） |
| POST | `/trigger` | 手動觸發到期排程 |

### Keywords — `/api/keywords`
| Method | Path | 說明 |
|---|---|---|
| GET | `/wp-keywords` | 從 WP 抓取所有文章 + 關鍵字 |
| POST | `/research` | Google Autocomplete 長尾關鍵字研究（~30 個） |

---

## 資料庫 Models

### User
```
id, email(unique), password_hash, role(default='user'), created_at, updated_at
```

### Task（文章生成任務記錄）
```
id, user_id(FK), keyword, title, direction, material,
status(pending/processing/completed/failed),
current_step, steps_detail(JSON), result(JSON), error_message,
created_at, updated_at
```

### ScheduledPost（排程發佈）
```
id, user_id(FK), keyword, title, direction, material,
scheduled_at(DateTime), status(pending/processing/completed/failed/cancelled),
error_message, result(JSON), created_at, updated_at
```

### Setting（每位使用者一筆，1:1）
```
加密欄位: anthropic_api_key, hf_api_key, wp_app_password, resend_api_key, smtp_password
明文欄位: wp_url, wp_username, notify_email, smtp_host, smtp_port, smtp_email, custom_prompt
```

### AuthLog
```
id, user_id(FK), action(login/logout/register), ip_address, user_agent, created_at
```

---

## 前端 SPA 架構（`frontend/js/app.js`）

Hash-based 路由，純 JavaScript，無 framework。

### 頁面
| Hash | 功能 |
|---|---|
| `#login` / `#register` | 認證 |
| `#dashboard` | 文章生成精靈（4 步驟） |
| `#logs` | 任務歷史記錄 |
| `#schedule` | 排程管理 CRUD |
| `#keywords` | WP 關鍵字列表 |
| `#keyword-research` | 長尾關鍵字研究 |

### Dashboard 4 步驟
1. **Step 1**：自訂 Claude prompt（支援拖放變數）
2. **Step 2**：填寫文章設定（關鍵字、標題、作者背景、文章指示、WP 站點、狀態）
3. **Step 3**：確認摘要
4. **Step 4**：執行（SSE 串流即時進度）

### 前端模組
- `Auth` — JWT token 管理
- `Router` — hash routing + auth guard
- `Settings` — API 金鑰/WP 設定的 modal
- `PromptEditor` — 自訂 prompt 編輯器，localStorage 持久化
- `Execution` — SSE 連線與即時進度 UI
- `Logs` — 任務記錄表格、分頁、搜尋、內容 modal
- `Schedule` — 排程 CRUD modal
- `Keywords` — WP 關鍵字表格（含「研究」「生成」快速動作）
- `KeywordResearch` — 長尾關鍵字建議 UI
- `Toast` — 通知訊息（自動消失）
- `Api` — HTTP client（含 JWT）

---

## Docker 部署

```yaml
services:
  flask-app:   # backend/ → Gunicorn :5000
  postgres:    # PostgreSQL 16-alpine，volume: postgres_data
  nginx:       # frontend/ → :80（透過 Traefik 暴露到外部）

networks:
  app-network: internal
  traefik_default: external  # autowp.ottaster.com
```

部署流程：
```bash
docker compose build && docker compose up -d
```

---

## 尚未整合的功能

| 功能 | 位置 | 狀態 |
|---|---|---|
| HuggingFace 圖片生成 | `services/image_service.py` | 基礎設施已建，未接入任何流程 |
| Email 通知 | `services/email_service.py` | 有問題，暫勿動 |

---

## 開發新功能時的注意事項

1. **新增 route**：在 `routes/` 建立新檔，在 `routes/__init__.py` 的 `register_routes()` 中 `app.register_blueprint()`。
2. **新增 model**：在 `models/` 建立新檔，在 `models/__init__.py` import，`init_db()` 會自動 `create_all()`。
3. **新增 service**：在 `services/` 建立新檔，從 routes 直接 import 使用。
4. **加密新的設定欄位**：在 `models/setting.py` 加欄位（`_enc` 後綴），在 `routes/settings.py` 中用 `encrypt_value`/`decrypt_value` 處理。
5. **前端新頁面**：在 `app.js` 加 `Router.routes`，寫 `render()` 方法，在 nav HTML 加連結。
6. **絕對不要動**：`gunicorn.conf.py` 的 monkey-patch、`nginx.conf` 的 SSE 設定。
7. **測試部署**：`docker compose build && docker compose up -d`，看 `docker compose logs -f flask-app`。

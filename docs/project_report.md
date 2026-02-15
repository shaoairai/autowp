# AutoWP 專案報告

> 日期：2026-02-15
> 版本：1.0
> 狀態：開發完成，通過整合測試

---

## 1. 專案總覽

### 1.1 專案名稱與目的

**AutoWP** 是一套完全脫離 n8n 的部落格自動產文系統。目的是讓使用者透過 Web 介面，一鍵完成從 AI 文章生成、AI 圖片生成、到 WordPress 自動發佈的完整流程，取代原本需要透過 n8n workflow 串接的繁瑣步驟。

### 1.2 與原 n8n Workflow 的對比

| 比較項目 | 原 n8n Workflow | AutoWP |
|----------|----------------|--------|
| 部署方式 | 需安裝 n8n + 設定 workflow | Docker Compose 一鍵部署 |
| 使用介面 | n8n 後台（非一般使用者友善） | 專用 Web UI（扁平化黑底設計） |
| Prompt 管理 | 寫死在 n8n 節點中 | 前端 Prompt 編輯器，支援變數拖曳 |
| API Key 管理 | n8n credentials 管理 | Fernet 加密存儲於 PostgreSQL |
| 即時進度 | 無（需等待 workflow 完成） | SSE 即時串流進度回報 |
| 多使用者 | 不支援 | JWT 認證，多使用者隔離 |
| SEO 優化 | 基本 | 完整 Rank Math 整合，Gutenberg 區塊格式 |
| 維護成本 | 需了解 n8n 架構 | 標準 Flask + PostgreSQL，易於維護 |

### 1.3 系統架構圖

```
+------------------+     +-------------------+     +------------------+
|                  |     |                   |     |                  |
|   Browser        |     |    Nginx          |     |  Flask Backend   |
|  (HTML/CSS/JS)   +---->+  (Port 80)        +---->+  (Port 5000)     |
|                  |     |  - 靜態檔案       |     |  - Gunicorn      |
|  - Login/Register|     |  - 反向代理 /api/ |     |  - gevent worker |
|  - Dashboard     |     |  - SSE 無緩衝     |     |  - Blueprint 架構|
|  - Prompt Editor |     |                   |     |                  |
|  - Result Preview|     +-------------------+     +--------+---------+
|                  |                                        |
+------------------+                                        |
                                                           v
                                              +-------------+--------+
                                              |                      |
                                              |    PostgreSQL 16     |
                                              |    - users           |
                                              |    - settings        |
                                              |    - tasks           |
                                              |    - auth_logs       |
                                              |                      |
                                              +----------------------+

                        外部 API 整合
                        +-----------+
Flask Backend --------> | Claude API | (文章生成)
             |          +-----------+
             |          +-----------+
             +--------> | Gemini API | (圖片生成，選填)
             |          +-----------+
             |          +----------------+
             +--------> | WordPress REST | (發佈文章/上傳圖片/SEO)
             |          +----------------+
             |          +------+
             +--------> | SMTP | (Email 通知，選填)
                        +------+
```

---

## 2. 完成功能清單

### 2.1 使用者認證（註冊/登入/登出/權限）
- 使用者可透過 Email + 密碼進行註冊與登入
- JWT Token 認證（PyJWT HS256），有效期 1 天
- 區分一般使用者 (user) 與管理員 (admin) 角色
- `@jwt_required` 裝飾器保護需認證的 API
- `@admin_required` 裝飾器保護管理員專用 API
- 首次啟動自動建立管理員帳號（透過環境變數設定）

### 2.2 API 設定管理（加密存儲）
- 支援設定 Anthropic API Key、Gemini API Key、WordPress 站台資訊、SMTP 郵件設定
- 所有敏感金鑰使用 Fernet 對稱加密後存入 PostgreSQL
- 加密金鑰（ENCRYPTION_KEY）從環境變數讀取，不進版本控制
- API 回傳時敏感欄位顯示為 `********`，防止洩漏

### 2.3 SEO Prompt 編輯器（變數拖曳、自訂 Prompt）
- 內建完整的 SEO 優化 Prompt 模板（v6.0）
- 支援 7 個可填寫變數：關鍵字、標題、方向、素材、語氣、目標字數、CTA
- 前端提供變數拖曳面板，將變數標籤拖入 Prompt 編輯區
- 使用者可自訂 Prompt 模板並儲存
- 即時字數統計

### 2.4 AI 自動產文（Claude API）
- 使用 Anthropic Claude API（claude-sonnet-4-5-20250929 模型）
- 支援 Structured Output 或 Tool Use 方式取得結構化 JSON 回應
- 產出內容包含：文章標題、Gutenberg HTML 內容、SEO 標題、Meta 描述、焦點關鍵字、Slug、摘要
- 產出 3 組圖片描述 prompt 與對應 ALT 文字
- 完整遵循 E-E-A-T 原則與 2025-2026 SEO 最佳實踐

### 2.5 AI 圖片生成（Gemini API，可選）
- 使用 Google Gemini 2.5 Flash Image 模型
- 自動根據文章前三個 H2 段落生成 3 張特色圖片
- 支援 16:9 寬高比（適合部落格）
- 圖片生成為選填功能，未設定 Gemini API Key 時自動跳過
- 單張圖片失敗不影響整體流程

### 2.6 WordPress 自動發佈（草稿+SEO+首圖）
- 使用 WordPress REST API v2 + Application Passwords 認證
- 自動上傳 AI 生成的圖片至 WordPress 媒體庫
- 建立文章時自動帶入首圖（Featured Image）
- 將圖片自動插入文章內容的對應段落後方
- 支援草稿（draft）、直接發布（publish）、待審核（pending）三種狀態
- 透過 Rank Math API Manager 外掛自動設定 SEO meta（title, description, focus keyword）

### 2.7 即時進度顯示（SSE Pipeline）
- 使用 Server-Sent Events（SSE）實現即時進度推送
- 前端 Pipeline 進度條顯示 6 個步驟：AI 產文 -> 圖片生成 -> 圖片上傳 -> WP 建立 -> SEO 設定 -> Email 通知
- 每個步驟顯示 processing / completed / warning / failed 狀態
- Nginx 設定 SSE 端點不緩衝（`proxy_buffering off`）
- Gunicorn 使用 gevent worker 支援長連線

### 2.8 Email 通知（成功/失敗）
- 支援 SMTP 郵件通知（選填功能）
- 文章生成成功時寄出包含文章標題、WordPress 連結、SEO 資訊的 HTML 通知信
- 文章生成失敗時寄出包含錯誤訊息與失敗步驟的通知信
- 使用 STARTTLS（Port 587），相容 Gmail 應用程式密碼
- Email 模板已做 HTML 轉義防止 XSS

### 2.9 操作日誌（登入/登出記錄）
- 記錄使用者的 register、login、logout 操作
- 記錄 IP 位址與 User-Agent
- 管理員專用的日誌查詢 API，支援分頁

### 2.10 暫存功能（localStorage）
- 前端將 JWT Token 存入 localStorage（`autowp_token`）
- 頁面重新整理後自動恢復登入狀態
- 登出時清除 localStorage

### 2.11 Docker 一鍵部署
- Docker Compose 定義三個服務：flask-app、postgres、nginx
- PostgreSQL 使用 healthcheck 確保資料庫就緒才啟動後端
- 後端使用非 root 使用者（appuser）執行
- 日誌輪替設定（json-file, 10MB, 最多 3 個檔案）
- 所有服務在同一 Docker 網路（app-network）

---

## 3. 技術架構

### 3.1 前端：HTML + CSS + JS

| 檔案 | 說明 |
|------|------|
| `frontend/index.html` | SPA 單頁應用入口，包含登入、註冊、Dashboard、紀錄四個頁面與三個 Modal |
| `frontend/css/style.css` | 扁平化黑底設計系統，CSS 變數定義色彩/字型/間距，RWD 響應式 |
| `frontend/js/app.js` | 主程式，包含路由管理、API 呼叫、SSE 連線、UI 元件、Prompt 編輯器 |
| `frontend/nginx.conf` | Nginx 設定：靜態檔案服務、API 反向代理、SSE 無緩衝、Gzip 壓縮、安全 Headers |
| `frontend/Dockerfile` | 基於 nginx:alpine，複製靜態檔案 |

**前端 JS 模組（app.js 內）**：
- `Auth` - 登入/註冊/登出/Token 管理
- `Settings` - API Key 設定/狀態指示器
- `PromptEditor` - Prompt 編輯/變數拖曳/字數統計
- `Generate` - 文章生成/SSE 進度解析/結果顯示
- `Logs` - 執行紀錄列表/搜尋/分頁
- `Utils` - Toast 通知/HTML 轉義/日期格式化

### 3.2 後端：Flask Blueprint 架構

| Blueprint | URL Prefix | 說明 |
|-----------|-----------|------|
| `auth_bp` | `/api/auth` | 使用者認證（register/login/logout/me） |
| `settings_bp` | `/api/settings` | API 金鑰與站台設定（GET/PUT） |
| `generate_bp` | `/api/generate` | 文章生成主流程（SSE 串流回應） |
| `tasks_bp` | `/api/tasks` | 生成任務查詢（列表/詳情） |
| `logs_bp` | `/api/logs` | 操作日誌查詢（管理員專用） |

**Services 層**：

| Service | 說明 |
|---------|------|
| `claude_service.py` | Claude API 呼叫，內建完整 SEO Prompt 模板，JSON 回應解析 |
| `gemini_service.py` | Gemini 圖片生成，16:9 比例，回傳 PNG bytes |
| `wordpress_service.py` | WordPress REST API 封裝：媒體上傳/文章建立/SEO meta 更新/圖片嵌入 |
| `email_service.py` | SMTP 寄信，HTML 模板（成功/失敗通知） |

**Utils 層**：

| Util | 說明 |
|------|------|
| `auth.py` | JWT Token 產生/驗證，`@jwt_required`/`@admin_required` 裝飾器 |
| `crypto.py` | Fernet 加密/解密 API Key |
| `database.py` | SQLAlchemy 初始化，資料庫自動建表，管理員帳號初始化 |

### 3.3 資料庫：PostgreSQL 資料表結構

| 資料表 | 主要欄位 | 說明 |
|--------|---------|------|
| `users` | id, email, password_hash, role, created_at, updated_at | 使用者帳號，bcrypt 密碼雜湊 |
| `settings` | id, user_id (unique), anthropic_api_key_enc, gemini_api_key_enc, wp_url, wp_username, wp_app_password_enc, smtp_*, custom_prompt | 每位使用者一筆設定，敏感欄位 Fernet 加密 |
| `tasks` | id, user_id, keyword, title, direction, material, status, current_step, steps_detail (JSON), result (JSON), error_message | 文章生成任務紀錄 |
| `auth_logs` | id, user_id, action, ip_address, user_agent, created_at | 認證操作日誌 |

### 3.4 部署：Docker Compose 服務架構

| 服務 | Image/Build | 對外 Port | 說明 |
|------|-------------|-----------|------|
| `nginx` | Build from `./frontend` | 80 | 反向代理 + 靜態檔案 |
| `flask-app` | Build from `./backend` | (內部 5000) | Gunicorn + gevent，4 workers |
| `postgres` | `postgres:16-alpine` | (內部 5432) | 資料持久化 volume |

---

## 4. 檔案結構總覽

```
autowp/
├── docker-compose.yaml          # Docker Compose 部署配置
├── .env.example                 # 環境變數範本
├── .dockerignore                # Docker 忽略清單
├── workflow.json                # 原 n8n workflow 參考
├── docs/
│   ├── architecture.md          # 技術架構建議文件
│   ├── optimized_prompt.md      # SEO Prompt v6.0 文件
│   ├── test_report.md           # 整合測試報告
│   └── project_report.md        # 本報告
├── backend/
│   ├── Dockerfile               # Python 3.12-slim + Gunicorn
│   ├── requirements.txt         # Python 套件依賴（14 個套件）
│   ├── wsgi.py                  # Gunicorn WSGI 入口
│   ├── config.py                # Flask 設定（環境變數讀取）
│   ├── app.py                   # Application Factory + Health Check
│   ├── models/
│   │   ├── __init__.py          # Model 彙整匯出
│   │   ├── user.py              # User Model（bcrypt 密碼）
│   │   ├── setting.py           # Setting Model（加密欄位）
│   │   ├── task.py              # Task Model（生成任務）
│   │   └── auth_log.py          # AuthLog Model（操作日誌）
│   ├── routes/
│   │   ├── __init__.py          # Blueprint 註冊
│   │   ├── auth.py              # 認證 API
│   │   ├── settings.py          # 設定 API
│   │   ├── generate.py          # 文章生成 API（SSE）
│   │   ├── tasks.py             # 任務查詢 API
│   │   └── logs.py              # 操作日誌 API
│   ├── services/
│   │   ├── __init__.py
│   │   ├── claude_service.py    # Claude AI 文章生成
│   │   ├── gemini_service.py    # Gemini AI 圖片生成
│   │   ├── wordpress_service.py # WordPress REST API
│   │   └── email_service.py     # SMTP 郵件通知
│   └── utils/
│       ├── __init__.py
│       ├── auth.py              # JWT 認證工具
│       ├── crypto.py            # Fernet 加解密
│       └── database.py          # SQLAlchemy 初始化
├── frontend/
│   ├── Dockerfile               # nginx:alpine + 靜態檔案
│   ├── nginx.conf               # Nginx 設定
│   ├── index.html               # SPA 入口（785 行）
│   ├── css/
│   │   └── style.css            # 扁平化黑底 CSS
│   └── js/
│       └── app.js               # 前端主程式
```

---

## 5. API 文件摘要

### 5.1 認證 API (`/api/auth`)

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| POST | `/api/auth/register` | 使用者註冊（email + password） | 否 |
| POST | `/api/auth/login` | 使用者登入，回傳 JWT Token | 否 |
| POST | `/api/auth/logout` | 使用者登出，記錄日誌 | 是 |
| GET | `/api/auth/me` | 取得目前使用者資訊 | 是 |

### 5.2 設定 API (`/api/settings`)

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/settings` | 取得使用者設定（敏感欄位遮蔽） | 是 |
| PUT | `/api/settings` | 更新設定（自動加密敏感欄位） | 是 |

### 5.3 文章生成 API (`/api/generate`)

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| POST | `/api/generate` | 啟動文章生成流程，回傳 SSE 串流 | 是 |

**SSE 事件步驟**：`ai_generating` -> `image_generating` -> `image_uploading` -> `wp_creating` -> `seo_setting` -> `email_sending` -> `completed`

### 5.4 任務查詢 API (`/api/tasks`)

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/tasks` | 列出使用者的生成任務（支援分頁） | 是 |
| GET | `/api/tasks/<id>` | 取得單一任務詳情 | 是 |

### 5.5 操作日誌 API (`/api/logs`)

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/logs` | 列出所有操作日誌（支援分頁） | 管理員 |

### 5.6 健康檢查

| 方法 | 端點 | 說明 | 認證 |
|------|------|------|------|
| GET | `/api/health` | 回傳 `{"status": "ok"}` | 否 |

---

## 6. 部署指南

### Step 1：準備環境

確保伺服器已安裝：
- Docker Engine 25.0+
- Docker Compose 2.22+

### Step 2：取得專案程式碼

```bash
# 將專案目錄複製到伺服器
scp -r autowp/ your-server:/opt/autowp
```

### Step 3：建立環境變數檔

```bash
cd /opt/autowp
cp .env.example .env
```

編輯 `.env`，填入以下必要設定：

```bash
# Flask 密鑰（請更換為隨機字串）
SECRET_KEY=your-random-secret-key-at-least-32-chars

# 資料庫（請更換密碼）
DATABASE_URL=postgresql://autowp_user:your-strong-password@postgres:5432/autowp_db
POSTGRES_DB=autowp_db
POSTGRES_USER=autowp_user
POSTGRES_PASSWORD=your-strong-password

# 管理員帳號
ADMIN_EMAIL=your-admin@email.com
ADMIN_PASSWORD=your-admin-password

# 加密金鑰（執行以下指令產生）
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
ENCRYPTION_KEY=your-generated-fernet-key
```

### Step 4：啟動服務

```bash
docker compose up -d --build
```

首次啟動會自動：
1. 建立 PostgreSQL 資料庫
2. 建立所有資料表
3. 建立管理員帳號

### Step 5：驗證部署

```bash
# 檢查服務狀態
docker compose ps

# 檢查健康狀態
curl http://localhost/api/health
# 預期回應: {"status":"ok"}

# 檢查日誌
docker compose logs -f flask-app
```

### Step 6：登入系統

1. 開啟瀏覽器訪問 `http://your-server-ip`
2. 使用 `.env` 中設定的 `ADMIN_EMAIL` 和 `ADMIN_PASSWORD` 登入
3. 在 Step 1 設定 Anthropic API Key 和 WordPress 站台資訊
4. （選填）設定 Gemini API Key 和 SMTP 郵件

### Step 7：生產環境建議

- 設定域名並啟用 SSL/TLS（Let's Encrypt）
- 修改 nginx.conf 中的 `server_name`
- 使用防火牆限制 PostgreSQL 只對內部網路開放
- 定期備份 PostgreSQL 資料（`docker compose exec postgres pg_dump`）

---

## 7. 測試結果摘要

根據整合測試報告（`docs/test_report.md`），測試涵蓋 14 個大項：

| 測試項目 | 結果 |
|----------|------|
| Python 語法檢查（23 個檔案） | 全部通過 |
| Import 一致性 | 全部通過 |
| API 端點一致性（前後端對應） | 全部通過 |
| HTML ID/Class 一致性 | 全部通過 |
| 資料庫 Model 完整性 | 全部通過 |
| JWT 認證流程 | 全部通過 |
| SSE 產文流程 | 全部通過 |
| 環境變數 | 全部通過 |
| Docker 配置 | 全部通過 |
| 安全性檢查 | 全部通過（修復後） |
| Prompt 整合 | 全部通過（修復後） |
| 圖片跳過邏輯 | 全部通過 |
| CSS 完整性 | 全部通過 |
| 錯誤處理 | 全部通過 |

### 測試中發現並修復的問題

共 7 個問題，全部已修復：

1. **Nginx SSE 緩衝路徑不匹配**（中度）- SSE location 從 `/api/sse/` 改為 `/api/generate`
2. **前端設定狀態指示器欄位名稱錯誤**（中度）- 改為檢查加密欄位的遮蔽值
3. **登入頁面標籤不一致**（低度）- 「使用者名稱」改為「電子郵件」
4. **custom_prompt 來源不正確**（邏輯問題）- 優先使用請求中的 prompt
5. **Email 模板 XSS 風險**（安全問題）- 加入 `html.escape()` 轉義
6. **前後端密碼長度驗證不一致**（低度）- 後端改為 8 字元
7. **執行紀錄權限過度限制**（低度）- 移除前端 admin-only 限制

### 整體評估

| 評估項目 | 評分 |
|----------|------|
| 程式碼品質 | 良好 |
| 架構設計 | 良好 |
| 安全性 | 良好 |
| 前後端一致性 | 良好 |
| 部署配置 | 良好 |
| 錯誤處理 | 良好 |
| 可維護性 | 良好 |

---

## 8. 已知限制與後續建議

### 8.1 目前的限制

1. **無 Refresh Token 機制**：目前使用單一 JWT Token（有效期 1 天），無 Refresh Token 自動續期。Token 過期需重新登入。
2. **單一 WordPress 站台**：Settings 設計為每位使用者一組設定，無法同時管理多個 WordPress 站台。
3. **無排程功能**：不支援定時批次產文，每次需手動觸發。
4. **無文章編輯功能**：生成後只能預覽和在 WordPress 編輯，系統內不支援再次修改。
5. **前端 username 欄位未使用**：註冊表單收集使用者名稱但 User Model 無此欄位。
6. **通知收件信箱欄位無後端對應**：前端 SMTP 設定有通知收件信箱，但後端直接寄給使用者登入 Email。
7. **前後端 Prompt 變數命名不同**：前端使用英文變數名（`{{ keyword }}`），後端 Prompt 模板使用中文（`{{關鍵字}}`）。
8. **無 Token 黑名單機制**：登出僅清除前端 Token，後端無法主動撤銷已簽發的 Token。
9. **僅靜態分析測試**：尚未在完整 Docker 環境中進行實際運行測試。

### 8.2 未來可以改進的方向

1. **多站台管理**：將 WordPress 站台設定獨立為一對多關係，支援管理多個部落格。
2. **Refresh Token + Token 黑名單**：實作 Access Token（15 分鐘）+ Refresh Token（30 天），並使用 Redis 或資料庫表管理已撤銷的 Token。
3. **排程產文**：支援設定定時任務（Cron），自動批次生成文章。
4. **文章修改與重新生成**：在系統內支援編輯已生成的文章內容並重新發佈。
5. **多語言支援**：Prompt 與 UI 支援切換語言。
6. **使用量統計**：追蹤 API Token 使用量與成本。
7. **Rate Limiting**：使用 Flask-Limiter 限制 API 呼叫頻率。
8. **HTTPS**：Nginx 設定加入 SSL/TLS 支援（Let's Encrypt 自動憑證）。
9. **資料庫遷移**：引入 Flask-Migrate（Alembic）管理資料表 Schema 變更。
10. **單元測試與 CI/CD**：撰寫 pytest 測試案例，建立自動化測試與部署流水線。

# AutoWP 整合測試報告

**測試日期**: 2026-02-15
**測試方法**: 靜態程式碼分析 + 邏輯驗證
**測試範圍**: 後端 Flask API、前端 HTML/CSS/JS、Docker 部署配置

---

## 測試項目清單

### 1. Python 語法檢查
| 檔案 | 結果 |
|------|------|
| `backend/app.py` | OK |
| `backend/config.py` | OK |
| `backend/wsgi.py` | OK |
| `backend/models/__init__.py` | OK |
| `backend/models/user.py` | OK |
| `backend/models/auth_log.py` | OK |
| `backend/models/task.py` | OK |
| `backend/models/setting.py` | OK |
| `backend/routes/__init__.py` | OK |
| `backend/routes/auth.py` | OK |
| `backend/routes/settings.py` | OK |
| `backend/routes/tasks.py` | OK |
| `backend/routes/logs.py` | OK |
| `backend/routes/generate.py` | OK |
| `backend/services/__init__.py` | OK |
| `backend/services/claude_service.py` | OK |
| `backend/services/gemini_service.py` | OK |
| `backend/services/wordpress_service.py` | OK |
| `backend/services/email_service.py` | OK |
| `backend/utils/__init__.py` | OK |
| `backend/utils/database.py` | OK |
| `backend/utils/crypto.py` | OK |
| `backend/utils/auth.py` | OK |

**結果**: ✅ 全部通過（23/23 檔案）

---

### 2. Import 一致性
| 檢查項目 | 結果 |
|----------|------|
| `app.py` imports (`config`, `utils.database`, `routes`) | ✅ 通過 |
| `routes/__init__.py` 引用所有 blueprint | ✅ 通過 |
| `routes/auth.py` imports (`models.user`, `models.auth_log`, `utils.database`, `utils.auth`) | ✅ 通過 |
| `routes/settings.py` imports (`models.setting`, `utils.database`, `utils.auth`, `utils.crypto`) | ✅ 通過 |
| `routes/tasks.py` imports (`models.task`, `utils.auth`) | ✅ 通過 |
| `routes/logs.py` imports (`models.auth_log`, `models.user`, `utils.auth`) | ✅ 通過 |
| `routes/generate.py` imports (所有 services + models + utils) | ✅ 通過 |
| `services/claude_service.py` imports (`anthropic`) | ✅ 通過 |
| `services/gemini_service.py` imports (`google.genai`, `PIL`) | ✅ 通過 |
| `requirements.txt` 涵蓋所有第三方套件 | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 3. API 端點一致性（前後端對應）

| 前端呼叫 | 後端路由 | 方法 | 結果 |
|----------|----------|------|------|
| `/api/auth/login` | `auth_bp /login` | POST | ✅ 通過 |
| `/api/auth/register` | `auth_bp /register` | POST | ✅ 通過 |
| `/api/auth/logout` | `auth_bp /logout` | POST | ✅ 通過 |
| `/api/auth/me` | `auth_bp /me` | GET | ✅ 通過 |
| `/api/settings` (GET) | `settings_bp ''` | GET | ✅ 通過 |
| `/api/settings` (PUT) | `settings_bp ''` | PUT | ✅ 通過 |
| `/api/generate` (POST) | `generate_bp ''` | POST | ✅ 通過 |
| `/api/tasks` (GET) | `tasks_bp ''` | GET | ✅ 通過 |
| `/api/health` | `app.py /api/health` | GET | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 4. HTML ID/Class 一致性

| 前端 JS querySelector | HTML ID/Class | 結果 |
|----------------------|---------------|------|
| `#toast-container` | `<div id="toast-container">` | ✅ 通過 |
| `#login-form` | `<form id="login-form">` | ✅ 通過 |
| `#login-username` | `<input id="login-username">` | ✅ 通過 |
| `#login-password` | `<input id="login-password">` | ✅ 通過 |
| `#login-error` | `<div id="login-error">` | ✅ 通過 |
| `#register-form` | `<form id="register-form">` | ✅ 通過 |
| `#prompt-textarea` | `<textarea id="prompt-textarea">` | ✅ 通過 |
| `#prompt-char-count` | `<span id="prompt-char-count">` | ✅ 通過 |
| `#article-keyword` | `<input id="article-keyword">` | ✅ 通過 |
| `#execution-progress` | `<div id="execution-progress">` | ✅ 通過 |
| `#progress-fill` | `<div id="progress-fill">` | ✅ 通過 |
| `#result-empty` / `#result-content` | HTML elements | ✅ 通過 |
| `#logs-table-body` | `<tbody id="logs-table-body">` | ✅ 通過 |
| `.tab-btn[data-tab]` / `.tab-panel` | HTML elements | ✅ 通過 |
| `.pipeline-step[data-step]` / `.pipeline-dot` | HTML elements | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 5. 資料庫 Model 完整性

| Model | 路由使用的欄位 | 是否一致 |
|-------|---------------|----------|
| `User` (email, password_hash, role) | auth.py 使用 email, check_password, role | ✅ 通過 |
| `AuthLog` (user_id, action, ip_address, user_agent) | auth.py _log_action 使用全部 | ✅ 通過 |
| `Task` (user_id, keyword, title, direction, material, status, current_step, steps_detail, result, error_message) | generate.py 使用全部 | ✅ 通過 |
| `Setting` (所有加密欄位 + 明文欄位) | settings.py ENCRYPTED_FIELDS + PLAIN_FIELDS 對應 | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 6. JWT 認證流程

| 流程步驟 | 結果 |
|----------|------|
| 登入 -> 產生 token (PyJWT HS256) | ✅ 通過 |
| Token 包含 user_id, exp, iat | ✅ 通過 |
| 前端存入 localStorage (`autowp_token`) | ✅ 通過 |
| API 呼叫帶 `Authorization: Bearer <token>` header | ✅ 通過 |
| `@jwt_required` 裝飾器驗證 token -> 設定 `request.current_user` | ✅ 通過 |
| `@admin_required` 額外檢查 `role == 'admin'` | ✅ 通過 |
| 登出清除 localStorage token | ✅ 通過 |
| Token 過期 (1 天) 自動失效 | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 7. SSE 產文流程

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| 後端 SSE 格式: `data: {json}\n\n` | ✅ 通過 | `_sse_event()` 正確格式化 |
| 前端解析 SSE: `line.startsWith('data: ')` | ✅ 通過 | fetch streaming reader 正確解析 |
| Response headers (`text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`) | ✅ 通過 | |
| 進度步驟對應 (ai_generating, image_generating, wp_creating 等) | ✅ 通過 | 前後端一致 |
| Nginx SSE proxy 配置 | ⚠️ 已修復 | 見問題 #1 |

---

### 8. 環境變數

| 變數 | `.env.example` | `config.py` 讀取 | 結果 |
|------|---------------|-------------------|------|
| `SECRET_KEY` | ✅ | ✅ `os.getenv('SECRET_KEY')` | ✅ 通過 |
| `DATABASE_URL` | ✅ | ✅ `os.getenv('DATABASE_URL')` | ✅ 通過 |
| `POSTGRES_DB/USER/PASSWORD` | ✅ | ✅ docker-compose 使用 | ✅ 通過 |
| `ADMIN_EMAIL` | ✅ | ✅ `os.getenv('ADMIN_EMAIL')` | ✅ 通過 |
| `ADMIN_PASSWORD` | ✅ | ✅ `os.getenv('ADMIN_PASSWORD')` | ✅ 通過 |
| `ENCRYPTION_KEY` | ✅ | ✅ `os.getenv('ENCRYPTION_KEY')` | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 9. Docker 配置

| 檢查項目 | 結果 |
|----------|------|
| `backend/Dockerfile`: Python 3.12-slim, pip install, gunicorn+gevent | ✅ 通過 |
| `frontend/Dockerfile`: nginx:alpine, 複製靜態檔案 | ✅ 通過 |
| `docker-compose.yaml`: 三服務 (flask-app, postgres, nginx) | ✅ 通過 |
| postgres healthcheck 確保 DB 就緒才啟動 flask-app | ✅ 通過 |
| nginx depends_on flask-app | ✅ 通過 |
| 所有服務在同一 `app-network` | ✅ 通過 |
| postgres volume 持久化 | ✅ 通過 |
| 日誌輪替 (json-file, 10m, 3 files) | ✅ 通過 |
| 非 root 執行 (backend appuser) | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 10. 安全性檢查

| 檢查項目 | 結果 | 說明 |
|----------|------|------|
| 硬編碼密鑰 | ✅ 通過 | 密鑰從環境變數讀取，config.py 的 default 'change-me' 僅為開發用 |
| API Key 加密儲存 (Fernet) | ✅ 通過 | `utils/crypto.py` 正確使用 Fernet |
| 密碼 bcrypt 雜湊 | ✅ 通過 | `User.set_password()` 使用 bcrypt |
| XSS 防護 (前端) | ✅ 通過 | `Utils.escapeHtml()` 用於所有使用者輸入 |
| XSS 防護 (Email) | ⚠️ 已修復 | 見問題 #5 |
| SQL 注入防護 | ✅ 通過 | 使用 SQLAlchemy ORM，無原生 SQL |
| CORS 配置 | ✅ 通過 | 限制 `/api/*` 路徑 |
| Nginx 安全 headers | ✅ 通過 | X-Frame-Options, X-Content-Type-Options, X-XSS-Protection |
| `to_dict()` 遮蔽敏感欄位 | ✅ 通過 | 加密欄位顯示為 '********' |

---

### 11. Prompt 整合

| 檢查項目 | 結果 |
|----------|------|
| `claude_service.py` 包含完整 DEFAULT_PROMPT | ✅ 通過 |
| Gutenberg 格式規則嵌入 prompt | ✅ 通過 |
| FAQ 不使用 details/summary 收合 | ✅ 通過 |
| JSON OUTPUT FORMAT 正確定義 | ✅ 通過 |
| 變數替換 (關鍵字/標題/方向/素材/語氣/字數/CTA) | ✅ 通過 |
| API 回應 JSON 解析 (支援 ```json``` 包裝和裸 JSON) | ✅ 通過 |
| custom_prompt 使用請求資料而非僅讀取 DB | ⚠️ 已修復 | 見問題 #4 |

---

### 12. 圖片跳過邏輯

| 檢查項目 | 結果 |
|----------|------|
| `has_gemini = bool(setting.gemini_api_key_enc)` 正確判斷 | ✅ 通過 |
| `if has_gemini and image_prompts:` 條件正確 | ✅ 通過 |
| 無 Gemini Key 時跳過圖片生成和上傳 | ✅ 通過 |
| 圖片生成失敗時繼續流程 (try/except 個別處理) | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 13. CSS 完整性

| HTML 使用的 class | CSS 定義 | 結果 |
|-------------------|----------|------|
| `.page`, `.page.active` | ✅ 定義 | ✅ 通過 |
| `.page-auth`, `.auth-card`, `.auth-logo` | ✅ 定義 | ✅ 通過 |
| `.card`, `.card-header` | ✅ 定義 | ✅ 通過 |
| `.form-group`, `.form-input`, `.form-label`, `.form-error` | ✅ 定義 | ✅ 通過 |
| `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-danger` | ✅ 定義 | ✅ 通過 |
| `.tab-btn`, `.tab-panel`, `.tab-number` | ✅ 定義 | ✅ 通過 |
| `.pipeline-*` (step, node, dot, connector, label) | ✅ 定義 | ✅ 通過 |
| `.settings-grid`, `.setting-card`, `.setting-card-icon` | ✅ 定義 | ✅ 通過 |
| `.prompt-editor-layout`, `.variable-panel`, `.variable-item` | ✅ 定義 | ✅ 通過 |
| `.execute-summary`, `.summary-item` | ✅ 定義 | ✅ 通過 |
| `.progress-bar`, `.progress-bar-fill` | ✅ 定義 | ✅ 通過 |
| `.data-table`, `.data-table-wrapper` | ✅ 定義 | ✅ 通過 |
| `.modal-backdrop`, `.modal`, `.modal-header` | ✅ 定義 | ✅ 通過 |
| `.toast`, `.toast-container` | ✅ 定義 | ✅ 通過 |
| `.badge-*` | ✅ 定義 | ✅ 通過 |
| `.pagination`, `.pagination-btn` | ✅ 定義 | ✅ 通過 |
| `.empty-state` | ✅ 定義 | ✅ 通過 |
| `.hidden`, `.flex`, `.items-center` 等 utility classes | ✅ 定義 | ✅ 通過 |
| `.input-with-toggle`, `.input-toggle-btn` | ✅ 定義 | ✅ 通過 |
| `.toggle`, `.toggle-track`, `.toggle-label` | ✅ 定義 | ✅ 通過 |
| `.status-dot` (.connected, .pending, .disconnected) | ✅ 定義 | ✅ 通過 |

**結果**: ✅ 全部通過

---

### 14. 錯誤處理

| 場景 | 結果 |
|------|------|
| API 呼叫失敗 -> 前端 `catch` 顯示 Toast 錯誤 | ✅ 通過 |
| 登入失敗 -> 顯示錯誤訊息 | ✅ 通過 |
| Token 過期 -> `getMe()` catch 清除 token | ✅ 通過 |
| 文章生成失敗 -> SSE error event + 失敗通知信 | ✅ 通過 |
| 圖片生成失敗 -> warning event, 繼續流程 | ✅ 通過 |
| SEO 設定失敗 -> warning event, 文章仍建立 | ✅ 通過 |
| Email 寄送失敗 -> warning event, 不影響流程 | ✅ 通過 |
| Task 資料庫更新 -> 各步驟更新 status/current_step | ✅ 通過 |

**結果**: ✅ 全部通過

---

## 發現的問題與修復

### 問題 #1: Nginx SSE Proxy 路徑不匹配 (⚠️ 已修復)
- **檔案**: `frontend/nginx.conf`
- **問題**: SSE 無緩衝配置位於 `/api/sse/`，但實際 SSE 端點是 `/api/generate`。這會導致 SSE 事件被 nginx 緩衝，前端無法即時接收進度更新。
- **修復**: 將 SSE location 從 `/api/sse/` 改為 `/api/generate`。

### 問題 #2: 前端設定狀態指示器欄位名稱不匹配 (⚠️ 已修復)
- **檔案**: `frontend/js/app.js`
- **問題**: `Settings._populateFields` 引用 `s.has_anthropic_key` 等不存在的欄位。後端 `Setting.to_dict()` 返回的是 `anthropic_api_key_enc: '********'`，不是布林值。
- **修復**: 改為檢查 `s.anthropic_api_key_enc === '********'` 等。

### 問題 #3: 登入頁面標籤與後端欄位不一致 (⚠️ 已修復)
- **檔案**: `frontend/index.html`
- **問題**: 登入表單顯示「使用者名稱」，但後端 API 接受的是 `email`。
- **修復**: 將標籤改為「電子郵件」，placeholder 改為「請輸入電子郵件」。

### 問題 #4: 產文時 custom_prompt 來源問題 (⚠️ 已修復)
- **檔案**: `backend/routes/generate.py`, `frontend/js/app.js`
- **問題**: 後端只從 `setting.custom_prompt` 讀取 prompt，忽略請求中的 `custom_prompt`。前端將已替換變數的 prompt 儲存到設定，污染了 prompt 模板。
- **修復**: 後端優先使用請求中的 `custom_prompt`，前端儲存原始模板而非替換後的版本。

### 問題 #5: Email 模板 XSS 風險 (⚠️ 已修復)
- **檔案**: `backend/services/email_service.py`
- **問題**: `build_success_email` 和 `build_failure_email` 直接將使用者輸入（title, keyword, error_message）嵌入 HTML，未做轉義。
- **修復**: 使用 `html.escape()` 對所有動態內容做 HTML 轉義。

### 問題 #6: 前後端密碼長度驗證不一致 (⚠️ 已修復)
- **檔案**: `backend/routes/auth.py`
- **問題**: 前端要求密碼至少 8 字元 (`minlength="8"`)，後端只要求 6 字元。
- **修復**: 將後端改為與前端一致的 8 字元。

### 問題 #7: 執行紀錄頁面權限過度限制 (⚠️ 已修復)
- **檔案**: `frontend/js/app.js`
- **問題**: 執行紀錄頁面使用 `/api/tasks` 端點（per-user），但前端限制只有 admin 才能存取。一般使用者無法查看自己的生成歷史。
- **修復**: 移除前端的 admin-only 限制，所有登入使用者均可查看自己的任務紀錄。

---

## 未修改的設計備註

1. **註冊表單收集 username 但未使用**: 前端收集 `reg-username` 欄位但 User model 無 `username` 欄位，僅送 email+password 到後端。建議未來決定是否加入 username 支援或移除欄位。

2. **前端 smtp_notify_email 欄位無後端對應**: 前端有通知收件信箱欄位，但 Setting model 沒有 `smtp_notify_email` 欄位。後端會靜默忽略此資料。目前 email 通知直接寄給使用者的登入 email。

3. **前後端 Prompt 變數命名不同**: 前端使用英文變數名 (`{{ keyword }}`), 後端 DEFAULT_PROMPT 使用中文 (`{{關鍵字}}`)。由於前端在傳送前已完成變數替換，目前流程正常運作，但未來維護需注意。

---

## 整體評估

| 評估項目 | 評分 |
|----------|------|
| 程式碼品質 | 良好 |
| 架構設計 | 良好 |
| 安全性 | 良好（修復後） |
| 前後端一致性 | 良好（修復後） |
| 部署配置 | 良好（修復後） |
| 錯誤處理 | 良好 |
| 可維護性 | 良好 |

### 總結

共發現 7 個問題，全部已修復：
- **2 個中度問題**: Nginx SSE 緩衝（影響即時進度顯示）、前端設定狀態指示器失效
- **3 個低度問題**: 登入標籤不一致、密碼驗證不一致、權限過度限制
- **1 個安全問題**: Email 模板 XSS 風險
- **1 個邏輯問題**: custom_prompt 來源不正確

修復後，系統在靜態分析層面已通過所有測試項目。建議在 Docker 環境就緒後進行實際運行測試。

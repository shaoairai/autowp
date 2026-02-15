/**
 * AutoWP - Frontend Application
 * Pure JavaScript SPA with hash routing, JWT auth, SSE progress, and drag-drop prompt editor.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuration
  // ---------------------------------------------------------------------------
  var API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:5000/api'
    : '/api';

  // ---------------------------------------------------------------------------
  // Default Prompt (from optimized_prompt.md v6.0)
  // ---------------------------------------------------------------------------
  var DEFAULT_PROMPT = [
    '# ROLE',
    '你是一位擁有 10 年經驗的 SEO 內容策略專家與 AI Agent。你專精 Google E-E-A-T 原則、Rank Math SEO 優化、搜尋意圖分析，以及 2025-2026 年最新 SEO 趨勢。你只用繁體中文撰寫內容。你產出的 HTML 必須完全相容 WordPress Gutenberg 區塊編輯器格式。',
    '',
    '你是一個 Agent：請先分析關鍵字的搜尋意圖（資訊型/交易型/導航型/商業調查型），再決定文章的結構與語氣。',
    '',
    '# INPUT',
    '- 關鍵字: {{ keyword }}',
    '- 標題: {{ title }}',
    '- 方向: {{ direction }}',
    '- 個人經驗/素材: {{ material }}',
    '- 語氣風格: {{ tone }}',
    '- 目標字數: {{ word_count }}',
    '- CTA 內容: {{ language }}',
    '',
    '# AGENT 思考步驟（Chain of Thought）',
    '1. **搜尋意圖分析**：判斷此關鍵字屬於 informational / transactional / navigational / commercial investigation 哪種類型',
    '2. **目標讀者畫像**：判斷目標讀者的知識水準、痛點與需求',
    '3. **競爭內容分析**：思考目前搜尋結果前 10 名可能涵蓋的內容，找出差異化角度',
    '4. **語義關鍵字拓展**：列出 LSI（Latent Semantic Indexing）相關詞彙與長尾關鍵字',
    '5. **文章結構規劃**：決定最佳的 H2/H3 層級結構，確保涵蓋主題群集（Topic Cluster）',
    '6. **E-E-A-T 融入策略**：規劃如何展現經驗、專業、權威、可信度',
    '7. **撰寫高品質內容**：結合以上分析產出內容',
    '8. **Rank Math SEO 欄位填寫**：最佳化所有 SEO 欄位',
    '',
    '# RULES',
    '',
    '## 一、E-E-A-T 內容品質規則（2025-2026 最新）',
    '1. **Experience（經驗）**：若有提供「個人經驗/素材」，必須自然融入文章中，以第一人稱敘述增加真實感。即使沒有素材，也應以「實際操作過的專家」角度撰寫，展現第一手經驗',
    '2. **Expertise（專業）**：內容必須有深度，提供可操作的具體建議，而非表面泛泛而談。引用數據、研究、案例來支撐論點',
    '3. **Authoritativeness（權威）**：使用確定性語氣，避免「可能」「也許」等模糊用語。在適當處引用權威來源',
    '4. **Trustworthiness（可信度）**：資訊必須準確、最新。若涉及 YMYL（Your Money Your Life）主題，需格外嚴謹',
    '',
    '## 二、內容結構與可讀性規則',
    '5. 段落控制 2-4 句，每 250-350 字換一個 H2 或 H3，確保閱讀節奏',
    '6. 關鍵字密度 1-2%，自然融入上下文，同段不超過 2 次。同時融入 LSI 語義相關詞',
    '7. 列舉用 Gutenberg 列表區塊，比較用 Gutenberg 表格區塊，步驟用有序列表',
    '8. 結尾加 FAQ（至少 3 題，使用 H3 + P 直接展開格式，不使用 details/summary 收合）和 CTA',
    '9. 標點使用全形，中英文與數字之間不加空格',
    '10. 適當使用 `<strong>` 標記重要關鍵詞（每段最多 1-2 個），有助 SEO 但避免過度使用',
    '',
    '## 三、2025-2026 SEO 最佳實踐',
    '11. **搜尋意圖優先**：內容必須精準匹配使用者搜尋意圖，而非只是塞滿關鍵字',
    '12. **主題群集策略**：文章應涵蓋該主題的完整面向，建立主題權威性（Topical Authority）',
    '13. **語義搜尋優化**：自然融入語義相關詞彙、同義詞、相關問題，幫助搜尋引擎理解內容深度',
    '14. **AI Overview 優化**：結構化的問答格式、清晰的定義段落、列表式重點，有助於被 Google AI Overview 引用',
    '15. **語音搜尋友善**：FAQ 問題使用自然口語化的完整問句，答案開頭直接回答問題',
    '16. **Core Web Vitals 友善**：HTML 結構簡潔乾淨，避免不必要的巢狀標籤，確保頁面載入效能',
    '17. **內部連結策略提示**：在文章中標註 2-3 處適合放置內部連結的位置（用 `[內部連結建議: 相關主題描述]` 標記）',
    '',
    '## 四、WordPress Gutenberg 區塊格式規則（重要！）',
    '所有 HTML 輸出必須嚴格使用 WordPress Gutenberg 區塊格式。',
    '',
    '## 五、FAQ 區塊格式（不使用 details/summary 收合）',
    'FAQ 必須使用 H3 標題 + 段落的直接展開格式。',
    '',
    '# OUTPUT STRUCTURE',
    '1. **開場段落**（痛點共鳴 + 解決方案預告 + 為什麼這篇文章值得讀）',
    '2. **TL;DR 摘要**（3-5 點重點摘要）',
    '3. **H2/H3 章節內容**（{{ word_count }}+ 字，至少 4 個 H2 段落）',
    '4. **FAQ 區塊**（至少 3 題，H3 + P 直接展開格式）',
    '5. **CTA 段落**（明確的行動呼籲）',
    '',
    '# RANK MATH SEO 欄位要求',
    '- seo_title: 含關鍵字的吸睛標題，50-60 字元',
    '- seo_description: 含關鍵字的 Meta 描述，150-160 字元',
    '- focus_keyword: 主要關鍵字',
    '- secondary_keywords: 3-5 個相關長尾關鍵字',
    '',
    '# JSON OUTPUT FORMAT',
    '{',
    '  "title": "文章標題",',
    '  "slug": "english-slug-with-keyword",',
    '  "content": "完整 Gutenberg 格式 HTML 文章",',
    '  "excerpt": "文章摘要 100-150 字",',
    '  "seo": {',
    '    "title": "SEO 標題",',
    '    "description": "Meta 描述",',
    '    "focus_keyword": "主要關鍵字",',
    '    "secondary_keywords": "長尾關鍵字1, 長尾關鍵字2, 長尾關鍵字3"',
    '  }',
    '}',
  ].join('\n');

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------
  var Utils = {
    escapeHtml: function (str) {
      if (!str) return '';
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(str));
      return div.innerHTML;
    },

    formatDate: function (dateStr) {
      if (!dateStr) return '-';
      var d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
        ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }
  };

  // Shorthand
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  // ---------------------------------------------------------------------------
  // Toast Notifications
  // ---------------------------------------------------------------------------
  var Toast = {
    container: null,

    init: function () {
      this.container = $('#toast-container');
    },

    show: function (message, type, duration) {
      type = type || 'info';
      duration = duration || 4000;

      var icons = {
        success: '\u2713',
        error: '\u2717',
        warning: '\u26A0',
        info: '\u2139',
      };

      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      toast.innerHTML =
        '<div class="toast-icon">' + (icons[type] || icons.info) + '</div>' +
        '<div class="toast-content"><div class="toast-title">' + Utils.escapeHtml(message) + '</div></div>' +
        '<button class="toast-close" aria-label="close">&times;</button>';

      var closeBtn = toast.querySelector('.toast-close');
      closeBtn.addEventListener('click', function () {
        Toast._remove(toast);
      });

      this.container.appendChild(toast);

      setTimeout(function () {
        Toast._remove(toast);
      }, duration);
    },

    _remove: function (el) {
      if (!el || !el.parentNode) return;
      el.classList.add('removing');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    },
  };

  // ---------------------------------------------------------------------------
  // API Client
  // ---------------------------------------------------------------------------
  var Api = {
    getToken: function () {
      return localStorage.getItem('autowp_token');
    },

    setToken: function (token) {
      localStorage.setItem('autowp_token', token);
    },

    clearToken: function () {
      localStorage.removeItem('autowp_token');
    },

    call: function (method, path, data) {
      var url = API_BASE + path;
      var headers = { 'Content-Type': 'application/json' };
      var token = this.getToken();
      if (token) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      var opts = {
        method: method,
        headers: headers,
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        opts.body = JSON.stringify(data);
      }

      return fetch(url, opts).then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok) {
            var err = new Error(json.error || 'Request failed');
            err.status = res.status;
            err.data = json;
            throw err;
          }
          return json;
        });
      });
    },
  };

  // ---------------------------------------------------------------------------
  // Auth Module
  // ---------------------------------------------------------------------------
  var Auth = {
    user: null,

    login: function (email, password) {
      return Api.call('POST', '/auth/login', { email: email, password: password })
        .then(function (res) {
          Api.setToken(res.access_token);
          Auth.user = res.user;
          Auth._updateUI();
          return res;
        });
    },

    register: function (email, password) {
      return Api.call('POST', '/auth/register', { email: email, password: password })
        .then(function (res) {
          Api.setToken(res.access_token);
          Auth.user = res.user;
          Auth._updateUI();
          return res;
        });
    },

    logout: function () {
      return Api.call('POST', '/auth/logout')
        .catch(function () { /* ignore errors */ })
        .then(function () {
          Api.clearToken();
          Auth.user = null;
          Router.navigate('login');
        });
    },

    getMe: function () {
      if (!Api.getToken()) return Promise.resolve(null);
      return Api.call('GET', '/auth/me')
        .then(function (res) {
          Auth.user = res.user;
          Auth._updateUI();
          return res.user;
        })
        .catch(function () {
          Api.clearToken();
          Auth.user = null;
          return null;
        });
    },

    isLoggedIn: function () {
      return !!Api.getToken() && !!Auth.user;
    },

    _updateUI: function () {
      if (!Auth.user) return;
      var initial = (Auth.user.email || 'U').charAt(0).toUpperCase();
      var avatars = $$('.user-avatar');
      avatars.forEach(function (el) { el.textContent = initial; });

      var usernames = $$('[id^="dropdown-username"]');
      usernames.forEach(function (el) { el.textContent = Auth.user.email; });

      // Logs page shows user's own task history, visible to all users
    },
  };

  // ---------------------------------------------------------------------------
  // Router
  // ---------------------------------------------------------------------------
  var Router = {
    currentPage: null,

    init: function () {
      var self = this;
      window.addEventListener('hashchange', function () { self._onHashChange(); });
      // Handle data-navigate links
      document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-navigate]');
        if (link) {
          e.preventDefault();
          self.navigate(link.getAttribute('data-navigate'));
        }
      });
    },

    navigate: function (page) {
      window.location.hash = '#' + page;
    },

    _onHashChange: function () {
      var hash = window.location.hash.replace('#', '') || 'login';

      // Auth guard
      if (!Auth.isLoggedIn() && hash !== 'login' && hash !== 'register') {
        this.navigate('login');
        return;
      }

      if (Auth.isLoggedIn() && (hash === 'login' || hash === 'register')) {
        this.navigate('dashboard');
        return;
      }

      // Logs page shows user's own task history, accessible to all users

      this._showPage(hash);
    },

    _showPage: function (page) {
      this.currentPage = page;

      // Hide all pages
      $$('.page').forEach(function (el) {
        el.classList.remove('active');
      });

      // Show target page
      var target = $('[data-page="' + page + '"]');
      if (target) {
        target.classList.add('active');
      }

      // Update nav active states
      $$('.app-nav-link').forEach(function (el) {
        el.classList.toggle('active', el.getAttribute('data-nav') === page);
      });

      // Page-specific init
      if (page === 'dashboard') {
        Settings.loadFromBackend();
        PromptEditor.init();
      } else if (page === 'logs') {
        Logs.load(1);
      }
    },

    start: function () {
      this._onHashChange();
    },
  };

  // ---------------------------------------------------------------------------
  // Settings Module
  // ---------------------------------------------------------------------------
  var Settings = {
    data: {},

    loadFromBackend: function () {
      return Api.call('GET', '/settings')
        .then(function (res) {
          if (res.settings) {
            Settings.data = res.settings;
            Settings._populateFields();
          }
        })
        .catch(function (err) {
          console.error('Failed to load settings:', err);
        });
    },

    _populateFields: function () {
      var s = this.data;

      // Status indicators (backend masks encrypted fields as '********')
      this._setStatus('anthropic', s.anthropic_api_key_enc === '********');
      this._setStatus('wordpress', s.wp_url && s.wp_username && s.wp_app_password_enc === '********');
      this._setStatus('resend', s.resend_api_key_enc === '********' && !!s.notify_email);

      // Populate plain-text fields
      if (s.wp_url) $('#wp-site-url').value = s.wp_url;
      if (s.wp_username) $('#wp-username').value = s.wp_username;
      if (s.notify_email) $('#notify-email').value = s.notify_email;

      // Update the WP site selector in step 2
      var wpSelect = $('#article-wp-site');
      if (wpSelect && s.wp_url) {
        wpSelect.innerHTML = '<option value="default">' + Utils.escapeHtml(s.wp_url) + '</option>';
      }

      // Load prompt from settings
      if (s.custom_prompt) {
        PromptEditor.setPrompt(s.custom_prompt);
      }
    },

    _setStatus: function (name, isSet) {
      var dot = $('#status-' + name);
      var text = $('#status-' + name + '-text');
      if (!dot || !text) return;

      if (isSet) {
        dot.className = 'status-dot connected';
        text.textContent = '已設定';
      } else {
        dot.className = 'status-dot pending';
        text.textContent = '未設定';
      }
    },

    saveAnthropicKey: function () {
      var key = $('#api-anthropic').value.trim();
      if (!key) { Toast.show('請輸入 API Key', 'warning'); return; }
      Api.call('PUT', '/settings', { anthropic_api_key: key })
        .then(function () {
          Toast.show('Anthropic API Key 已儲存', 'success');
          Settings._setStatus('anthropic', true);
          $('#api-anthropic').value = '';
        })
        .catch(function (err) { Toast.show(err.message, 'error'); });
    },

    saveWordpress: function () {
      var url = $('#wp-site-url').value.trim();
      var user = $('#wp-username').value.trim();
      var pass = $('#wp-app-password').value.trim();

      if (!url || !user) {
        Toast.show('請填寫網址和使用者名稱', 'warning');
        return;
      }

      var data = { wp_url: url, wp_username: user };
      if (pass) data.wp_app_password = pass;

      Api.call('PUT', '/settings', data)
        .then(function () {
          Toast.show('WordPress 設定已儲存', 'success');
          Settings._setStatus('wordpress', true);
          $('#wp-app-password').value = '';
          // Update selector
          var wpSelect = $('#article-wp-site');
          if (wpSelect) {
            wpSelect.innerHTML = '<option value="default">' + Utils.escapeHtml(url) + '</option>';
          }
        })
        .catch(function (err) { Toast.show(err.message, 'error'); });
    },

    saveResend: function () {
      var data = {
        notify_email: $('#notify-email').value.trim(),
      };
      var key = $('#resend-api-key').value.trim();
      if (key) data.resend_api_key = key;

      Api.call('PUT', '/settings', data)
        .then(function () {
          Toast.show('Resend 設定已儲存', 'success');
          Settings._setStatus('resend', !!key || (Settings.data && Settings.data.resend_api_key_enc === '********'));
          $('#resend-api-key').value = '';
        })
        .catch(function (err) { Toast.show(err.message, 'error'); });
    },

    saveToLocalStorage: function () {
      var fields = {
        wp_url: $('#wp-site-url').value,
        wp_username: $('#wp-username').value,
        notify_email: $('#notify-email').value,
      };
      localStorage.setItem('autowp_settings_cache', JSON.stringify(fields));
    },

    loadFromLocalStorage: function () {
      try {
        var cached = JSON.parse(localStorage.getItem('autowp_settings_cache'));
        if (!cached) return;
        if (cached.wp_url) $('#wp-site-url').value = cached.wp_url;
        if (cached.wp_username) $('#wp-username').value = cached.wp_username;
        if (cached.notify_email) $('#notify-email').value = cached.notify_email;
      } catch (e) { /* ignore */ }
    },
  };

  // ---------------------------------------------------------------------------
  // Prompt Editor Module
  // ---------------------------------------------------------------------------
  var PromptEditor = {
    initialized: false,

    init: function () {
      if (this.initialized) return;
      this.initialized = true;

      var textarea = $('#prompt-textarea');
      if (!textarea) return;

      // Load from localStorage or use default
      var saved = localStorage.getItem('autowp_prompt');
      textarea.value = saved || DEFAULT_PROMPT;
      this._updateCharCount();

      // Char count
      textarea.addEventListener('input', function () {
        PromptEditor._updateCharCount();
      });

      // Drag & drop for variables
      this._initDragDrop();
    },

    _initDragDrop: function () {
      var items = $$('.variable-item[draggable="true"]');
      var textarea = $('#prompt-textarea');

      items.forEach(function (item) {
        item.addEventListener('dragstart', function (e) {
          var variable = item.getAttribute('data-variable');
          e.dataTransfer.setData('text/plain', variable);
          e.dataTransfer.effectAllowed = 'copy';
        });
      });

      textarea.addEventListener('dragover', function (e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });

      textarea.addEventListener('drop', function (e) {
        e.preventDefault();
        var variable = e.dataTransfer.getData('text/plain');
        if (!variable) return;

        // Insert at cursor position (or drop position)
        var start = textarea.selectionStart;
        var end = textarea.selectionEnd;
        var text = textarea.value;
        textarea.value = text.substring(0, start) + variable + text.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + variable.length;
        textarea.focus();
        PromptEditor._updateCharCount();
      });
    },

    _updateCharCount: function () {
      var textarea = $('#prompt-textarea');
      var counter = $('#prompt-char-count');
      if (textarea && counter) {
        counter.textContent = textarea.value.length;
      }
    },

    setPrompt: function (text) {
      var textarea = $('#prompt-textarea');
      if (textarea) {
        textarea.value = text;
        this._updateCharCount();
      }
    },

    getPrompt: function () {
      var textarea = $('#prompt-textarea');
      return textarea ? textarea.value : DEFAULT_PROMPT;
    },

    resetToDefault: function () {
      this.setPrompt(DEFAULT_PROMPT);
      localStorage.removeItem('autowp_prompt');
      Toast.show('Prompt 已重置為預設', 'success');
    },

    saveToLocalStorage: function () {
      var textarea = $('#prompt-textarea');
      if (textarea) {
        localStorage.setItem('autowp_prompt', textarea.value);
      }
    },

    copyPrompt: function () {
      var textarea = $('#prompt-textarea');
      if (!textarea) return;
      navigator.clipboard.writeText(textarea.value).then(function () {
        Toast.show('Prompt 已複製到剪貼簿', 'success');
      }).catch(function () {
        textarea.select();
        document.execCommand('copy');
        Toast.show('Prompt 已複製到剪貼簿', 'success');
      });
    },

    /** Replace template variables with user-supplied article info. */
    buildFinalPrompt: function () {
      var prompt = this.getPrompt();
      var keyword = $('#article-keyword').value.trim();
      var title = $('#article-title').value.trim() || keyword;
      var direction = $('#article-direction').value.trim() || '無';
      var material = $('#article-material').value.trim() || '無';

      prompt = prompt.replace(/\{\{\s*keyword\s*\}\}/g, keyword);
      prompt = prompt.replace(/\{\{\s*title\s*\}\}/g, title);
      prompt = prompt.replace(/\{\{\s*direction\s*\}\}/g, direction);
      prompt = prompt.replace(/\{\{\s*material\s*\}\}/g, material);
      prompt = prompt.replace(/\{\{\s*tone\s*\}\}/g, '專業且親切');
      prompt = prompt.replace(/\{\{\s*word_count\s*\}\}/g, '1500');
      prompt = prompt.replace(/\{\{\s*language\s*\}\}/g, '通用型 CTA');
      return prompt;
    },
  };

  // ---------------------------------------------------------------------------
  // Tabs (Dashboard Steps)
  // ---------------------------------------------------------------------------
  var Tabs = {
    init: function () {
      var self = this;
      $$('.tab-btn[data-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          self.switchTo(btn.getAttribute('data-tab'));
        });
      });
    },

    switchTo: function (tabId) {
      // Update tab buttons
      $$('.tab-btn[data-tab]').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
        btn.setAttribute('aria-selected', btn.getAttribute('data-tab') === tabId ? 'true' : 'false');
      });

      // Update panels
      $$('.tab-panel').forEach(function (panel) {
        panel.classList.toggle('active', panel.id === tabId);
      });

      // Update pipeline dots
      var stepNum = parseInt(tabId.replace('step', ''), 10);
      $$('.pipeline-step').forEach(function (step) {
        var n = parseInt(step.getAttribute('data-step'), 10);
        var dot = step.querySelector('.pipeline-dot');
        dot.classList.toggle('active', n === stepNum);
      });

      // Update summary when entering step3
      if (tabId === 'step3') {
        Execution._updateSummary();
      }
    },
  };

  // ---------------------------------------------------------------------------
  // Execution / SSE Progress
  // ---------------------------------------------------------------------------
  var Execution = {
    running: false,
    eventSource: null,
    lastArticleData: null,

    _updateSummary: function () {
      var keyword = $('#article-keyword').value.trim() || '-';
      var title = $('#article-title').value.trim() || 'AI 自動產生';
      var wpSite = $('#article-wp-site');
      var site = wpSite && wpSite.options.length > 0 ? wpSite.options[wpSite.selectedIndex].text : '-';
      var statusSel = $('#article-status');
      var status = statusSel ? statusSel.options[statusSel.selectedIndex].text : '草稿';
      var emailNotify = $('#toggle-email-notify');

      $('#summary-keyword').textContent = keyword;
      $('#summary-title').textContent = title;
      $('#summary-site').textContent = site;
      $('#summary-status').textContent = status;
      $('#summary-email').textContent = (emailNotify && emailNotify.checked) ? '開啟' : '關閉';
    },

    start: function () {
      var keyword = $('#article-keyword').value.trim();
      if (!keyword) {
        Toast.show('請先填寫關鍵字', 'warning');
        Tabs.switchTo('step2');
        return;
      }

      this.running = true;
      this._toggleUI(true);

      var data = {
        keyword: keyword,
        title: $('#article-title').value.trim() || undefined,
        direction: $('#article-direction').value.trim() || undefined,
        material: $('#article-material').value.trim() || undefined,
        custom_prompt: PromptEditor.buildFinalPrompt(),
      };

      // Save the raw prompt template (not the replaced version) to backend
      Api.call('PUT', '/settings', { custom_prompt: PromptEditor.getPrompt() }).catch(function () {});

      var token = Api.getToken();
      var url = API_BASE + '/generate';

      // Use fetch with streaming for SSE
      var self = this;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(data),
      }).then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            throw new Error(err.error || 'Request failed');
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              self.running = false;
              self._toggleUI(false);
              return;
            }

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            lines.forEach(function (line) {
              if (line.startsWith('data: ')) {
                try {
                  var event = JSON.parse(line.substring(6));
                  self._handleEvent(event);
                } catch (e) { /* ignore parse errors */ }
              }
            });

            return read();
          });
        }

        return read();
      }).catch(function (err) {
        self.running = false;
        self._toggleUI(false);
        Toast.show(err.message, 'error');
        self._addLog('error', err.message);
      });
    },

    cancel: function () {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }
      this.running = false;
      this._toggleUI(false);
      Toast.show('生成已取消', 'warning');
    },

    _toggleUI: function (isRunning) {
      var progressSection = $('#execution-progress');
      var execActions = $('#execute-actions');
      var cancelActions = $('#execute-cancel-actions');

      if (isRunning) {
        progressSection.classList.remove('hidden');
        execActions.classList.add('hidden');
        cancelActions.classList.remove('hidden');
        // Reset progress
        $('#progress-fill').style.width = '0%';
        $('#progress-step').textContent = '準備中...';
        $('#progress-percent').textContent = '0%';
        $('#execution-log').innerHTML = '';
      } else {
        cancelActions.classList.add('hidden');
        execActions.classList.remove('hidden');
      }
    },

    _handleEvent: function (event) {
      var step = event.step;
      var status = event.status;
      var message = event.message;
      var data = event.data;

      // Progress mapping
      var stepProgress = {
        'ai_generating': 20,
        'wp_creating': 55,
        'seo_setting': 75,
        'email_sending': 90,
        'completed': 100,
        'error': 0,
      };

      // Step labels
      var stepLabels = {
        'ai_generating': 'AI 產文',
        'wp_creating': '建立草稿',
        'seo_setting': '設定 SEO',
        'email_sending': '寄送通知',
        'completed': '完成',
        'error': '錯誤',
      };

      // Update progress bar
      if (status === 'completed' || status === 'processing') {
        var pct = stepProgress[step] || 0;
        if (status === 'processing') pct = Math.max(pct - 10, 0);
        $('#progress-fill').style.width = pct + '%';
        $('#progress-percent').textContent = pct + '%';
      }

      // Update step text
      $('#progress-step').textContent = (stepLabels[step] || step) + ' - ' + message;

      // Add to log
      this._addLog(status, message);

      // Save article data when AI generation completes (so we have it even if later steps fail)
      if (step === 'ai_generating' && status === 'completed' && data && data.content) {
        this.lastArticleData = data;
      }

      // Handle completion
      if (step === 'completed' && status === 'completed' && data) {
        this.running = false;
        this._toggleUI(false);
        Toast.show('文章生成完成！', 'success');
        this._showResult(data);
      }

      // Handle error — still show article content if we have it
      if (status === 'failed') {
        this.running = false;
        this._toggleUI(false);
        if (this.lastArticleData) {
          this._showArticlePreview(this.lastArticleData);
          Toast.show('部分步驟失敗，但文章內容已保留。可使用「直接上傳」重新上傳。', 'warning', 8000);
        } else {
          Toast.show(message, 'error', 8000);
        }
      }
    },

    _addLog: function (status, message) {
      var log = $('#execution-log');
      if (!log) return;

      var statusIcons = {
        processing: '<span style="color:var(--color-info);">[...]</span>',
        completed: '<span style="color:var(--color-success);">[OK]</span>',
        warning: '<span style="color:var(--color-warning);">[!]</span>',
        skipped: '<span style="color:var(--text-tertiary);">[--]</span>',
        failed: '<span style="color:var(--color-error);">[X]</span>',
        error: '<span style="color:var(--color-error);">[X]</span>',
      };

      var entry = document.createElement('div');
      entry.style.cssText = 'padding: 4px 0; border-bottom: 1px solid var(--border-default);';
      entry.innerHTML = (statusIcons[status] || '') + ' ' + Utils.escapeHtml(message);
      log.appendChild(entry);
      log.scrollTop = log.scrollHeight;
    },

    _showResult: function (data) {
      // Switch to result tab
      Tabs.switchTo('step4');

      // Hide empty state, show content
      $('#result-empty').classList.add('hidden');
      $('#result-content').classList.remove('hidden');

      // Populate SEO info
      var seo = data.seo || {};
      $('#result-seo-title').textContent = seo.title || '-';
      $('#result-seo-desc').textContent = seo.description || '-';
      $('#result-focus-kw').textContent = seo.focus_keyword || '-';

      // WP link
      var wpLink = $('#result-wp-link');
      if (data.wp_link) {
        wpLink.href = data.wp_link;
        wpLink.textContent = '開啟文章';
      } else {
        wpLink.removeAttribute('href');
        wpLink.textContent = '-';
      }

      // Article title
      $('#result-article-title').textContent = data.article_title || '文章標題';

      // Show content summary with WP link
      var contentHtml = '<p style="color: var(--text-secondary);">文章已成功建立' +
        (data.wp_link ? '，<a href="' + Utils.escapeHtml(data.wp_link) + '" target="_blank">點此前往 WordPress 查看完整內容</a>' : '') +
        '。</p>';

      // If we have article content from AI, show it too
      if (this.lastArticleData && this.lastArticleData.content) {
        contentHtml += '<details style="margin-top: var(--space-md);"><summary style="cursor:pointer; font-weight:600;">展開文章內容</summary>' +
          '<div style="margin-top: var(--space-sm); padding: var(--space-md); background: var(--bg-secondary); border-radius: var(--radius-md); overflow: auto; max-height: 500px;">' +
          this.lastArticleData.content + '</div></details>';
      }
      $('#result-article-content').innerHTML = contentHtml;
    },

    _showArticlePreview: function (articleData) {
      // Show article content on error so user doesn't lose it
      Tabs.switchTo('step4');
      $('#result-empty').classList.add('hidden');
      $('#result-content').classList.remove('hidden');

      var seo = articleData.seo || {};
      $('#result-seo-title').textContent = seo.title || '-';
      $('#result-seo-desc').textContent = seo.description || '-';
      $('#result-focus-kw').textContent = seo.focus_keyword || '-';
      $('#result-wp-link').removeAttribute('href');
      $('#result-wp-link').textContent = '尚未上傳';
      $('#result-article-title').textContent = articleData.title || '文章標題';

      // Show content + copy button + direct upload option
      var contentHtml = '<div style="padding: var(--space-sm); background: var(--color-warning-bg, #fff3cd); border-radius: var(--radius-md); margin-bottom: var(--space-md); color: var(--color-warning, #856404);">' +
        '文章已由 AI 產生，但後續步驟失敗。內容已保留於下方，你可以複製 HTML 或使用「直接上傳到 WordPress」。</div>';
      contentHtml += '<div style="margin-bottom: var(--space-md);"><button class="btn btn-primary btn-sm" id="btn-reupload">直接上傳到 WordPress</button></div>';
      contentHtml += '<div style="padding: var(--space-md); background: var(--bg-secondary); border-radius: var(--radius-md); overflow: auto; max-height: 500px;">' +
        articleData.content + '</div>';

      $('#result-article-content').innerHTML = contentHtml;

      // Bind re-upload button
      var reuploadBtn = $('#btn-reupload');
      if (reuploadBtn) {
        reuploadBtn.addEventListener('click', function () {
          Execution.directUpload(articleData);
        });
      }
    },

    directUpload: function (articleData) {
      if (this.running) return;
      this.running = true;

      // Switch back to step3 to show progress
      Tabs.switchTo('step3');
      this._toggleUI(true);

      var payload = {
        title: articleData.title || '',
        content: articleData.content || '',
        slug: articleData.slug || '',
        excerpt: articleData.excerpt || '',
        seo: articleData.seo || {},
        keyword: articleData.keyword || ($('#article-keyword') ? $('#article-keyword').value.trim() : ''),
      };

      var token = Api.getToken();
      var url = API_BASE + '/generate/upload';
      var self = this;

      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify(payload),
      }).then(function (response) {
        if (!response.ok) {
          return response.json().then(function (err) {
            throw new Error(err.error || '上傳失敗');
          });
        }

        var reader = response.body.getReader();
        var decoder = new TextDecoder();
        var buffer = '';

        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              self.running = false;
              self._toggleUI(false);
              return;
            }

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split('\n');
            buffer = lines.pop();

            lines.forEach(function (line) {
              if (line.startsWith('data: ')) {
                try {
                  var event = JSON.parse(line.substring(6));
                  self._handleEvent(event);
                } catch (e) { /* ignore */ }
              }
            });

            return read();
          });
        }

        return read();
      }).catch(function (err) {
        self.running = false;
        self._toggleUI(false);
        Toast.show(err.message, 'error');
        self._addLog('error', err.message);
      });
    },
  };

  // ---------------------------------------------------------------------------
  // Logs Module
  // ---------------------------------------------------------------------------
  var Logs = {
    currentPage: 1,
    currentSearch: '',
    currentFilter: '',

    load: function (page) {
      this.currentPage = page || 1;
      var params = '?page=' + this.currentPage + '&per_page=20';

      // The logs endpoint is for auth logs (admin only)
      // Tasks endpoint is for generation history
      Api.call('GET', '/tasks' + params)
        .then(function (res) {
          Logs._renderTable(res.tasks || []);
          Logs._renderPagination(res.page, res.pages, res.total);
        })
        .catch(function (err) {
          Toast.show('載入紀錄失敗: ' + err.message, 'error');
        });
    },

    _renderTable: function (tasks) {
      var tbody = $('#logs-table-body');
      var empty = $('#logs-empty');
      if (!tbody) return;

      if (!tasks.length) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }

      if (empty) empty.classList.add('hidden');

      var search = this.currentSearch.toLowerCase();
      var filter = this.currentFilter;

      var filtered = tasks.filter(function (t) {
        if (filter && t.status !== filter) return false;
        if (search) {
          var haystack = ((t.keyword || '') + (t.title || '')).toLowerCase();
          if (haystack.indexOf(search) === -1) return false;
        }
        return true;
      });

      var statusBadge = function (status) {
        var map = {
          processing: '<span class="badge badge-info">生成中</span>',
          completed: '<span class="badge badge-success">已完成</span>',
          failed: '<span class="badge badge-error">失敗</span>',
        };
        return map[status] || '<span class="badge badge-default">' + Utils.escapeHtml(status) + '</span>';
      };

      tbody.innerHTML = filtered.map(function (t, idx) {
        var result = t.result || {};
        var hasContent = result.article_content ? true : false;
        return '<tr>' +
          '<td>' + ((Logs.currentPage - 1) * 20 + idx + 1) + '</td>' +
          '<td>' + Utils.escapeHtml(t.keyword || '-') + '</td>' +
          '<td class="truncate" style="max-width:200px;">' + Utils.escapeHtml(t.title || result.article_title || '-') + '</td>' +
          '<td>' + Utils.escapeHtml(t.wp_url || '-') + '</td>' +
          '<td>' + statusBadge(t.status) + '</td>' +
          '<td>' + Utils.formatDate(t.created_at) + '</td>' +
          '<td style="white-space:nowrap;">' +
            (hasContent
              ? '<button class="btn btn-sm btn-ghost" data-view-content="' + t.id + '">內容</button> '
              : '') +
            (result.wp_link
              ? '<a href="' + Utils.escapeHtml(result.wp_link) + '" target="_blank" class="btn btn-sm btn-ghost">WP</a>'
              : (hasContent ? '' : '-')) +
          '</td>' +
        '</tr>';
      }).join('');

      // Bind content view buttons
      tbody.querySelectorAll('[data-view-content]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var taskId = this.getAttribute('data-view-content');
          var task = filtered.find(function (t) { return String(t.id) === taskId; });
          if (task && task.result && task.result.article_content) {
            Logs._showContentModal(task);
          }
        });
      });
    },

    _renderPagination: function (page, pages, total) {
      var container = $('#logs-pagination');
      if (!container) return;

      container.innerHTML = '';
      if (pages <= 1) return;

      // Prev
      var prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.innerHTML = '&laquo;';
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', function () { Logs.load(page - 1); });
      container.appendChild(prevBtn);

      // Page numbers
      for (var i = 1; i <= pages; i++) {
        var btn = document.createElement('button');
        btn.className = 'pagination-btn' + (i === page ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', (function (p) {
          return function () { Logs.load(p); };
        })(i));
        container.appendChild(btn);
      }

      // Next
      var nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.innerHTML = '&raquo;';
      nextBtn.disabled = page >= pages;
      nextBtn.addEventListener('click', function () { Logs.load(page + 1); });
      container.appendChild(nextBtn);
    },

    _showContentModal: function (task) {
      var result = task.result || {};
      // Remove existing modal
      var existing = document.getElementById('content-modal');
      if (existing) existing.remove();

      var modal = document.createElement('div');
      modal.id = 'content-modal';
      modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:var(--space-lg);';

      var seo = result.seo || {};
      var seoHtml = seo.title ? '<div style="margin-bottom:var(--space-md);padding:var(--space-sm);background:var(--bg-secondary);border-radius:var(--radius-md);font-size:var(--text-xs);">' +
        '<strong>SEO Title:</strong> ' + Utils.escapeHtml(seo.title || '') + '<br>' +
        '<strong>Meta Desc:</strong> ' + Utils.escapeHtml(seo.description || '') + '<br>' +
        '<strong>Focus KW:</strong> ' + Utils.escapeHtml(seo.focus_keyword || '') +
        '</div>' : '';

      modal.innerHTML = '<div style="background:var(--bg-primary);border-radius:var(--radius-lg);max-width:900px;width:100%;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;">' +
        '<div style="padding:var(--space-md) var(--space-lg);border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between;">' +
          '<h3 style="font-size:var(--text-base);margin:0;">' + Utils.escapeHtml(result.article_title || task.keyword || '文章內容') + '</h3>' +
          '<div style="display:flex;gap:var(--space-sm);">' +
            '<button class="btn btn-sm btn-secondary" id="modal-copy-html">複製 HTML</button>' +
            '<button class="btn btn-sm btn-secondary" id="modal-reupload">直接上傳到 WP</button>' +
            '<button class="btn btn-sm btn-ghost" id="modal-close">&times;</button>' +
          '</div>' +
        '</div>' +
        seoHtml +
        '<div style="padding:var(--space-lg);overflow:auto;flex:1;">' +
          result.article_content +
        '</div>' +
      '</div>';

      document.body.appendChild(modal);

      // Close
      document.getElementById('modal-close').addEventListener('click', function () { modal.remove(); });
      modal.addEventListener('click', function (e) { if (e.target === modal) modal.remove(); });

      // Copy HTML
      document.getElementById('modal-copy-html').addEventListener('click', function () {
        navigator.clipboard.writeText(result.article_content).then(function () {
          Toast.show('HTML 已複製到剪貼簿', 'success');
        });
      });

      // Re-upload
      document.getElementById('modal-reupload').addEventListener('click', function () {
        modal.remove();
        Execution.directUpload({
          title: result.article_title || task.keyword || '',
          content: result.article_content,
          slug: result.slug || '',
          excerpt: result.excerpt || '',
          seo: result.seo || {},
        });
        Router.navigate('dashboard');
        Tabs.switchTo('step3');
      });
    },
  };

  // ---------------------------------------------------------------------------
  // UI Event Bindings
  // ---------------------------------------------------------------------------
  function bindEvents() {
    // --- Password toggle ---
    document.addEventListener('click', function (e) {
      var toggleBtn = e.target.closest('[data-toggle-password]');
      if (!toggleBtn) return;
      var targetId = toggleBtn.getAttribute('data-toggle-password');
      var input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });

    // --- Login form ---
    var loginForm = $('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var email = $('#login-username').value.trim();
        var password = $('#login-password').value;
        var errorEl = $('#login-error');
        var submitBtn = $('#login-submit');

        if (!email || !password) {
          errorEl.textContent = '請填寫所有欄位';
          errorEl.classList.remove('hidden');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '登入中...';
        errorEl.classList.add('hidden');

        Auth.login(email, password)
          .then(function () {
            Router.navigate('dashboard');
          })
          .catch(function (err) {
            errorEl.textContent = err.message || '登入失敗';
            errorEl.classList.remove('hidden');
          })
          .finally(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = '登入';
          });
      });
    }

    // --- Register form ---
    var regForm = $('#register-form');
    if (regForm) {
      regForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var username = $('#reg-username').value.trim();
        var email = $('#reg-email').value.trim();
        var password = $('#reg-password').value;
        var confirm = $('#reg-password-confirm').value;
        var errorEl = $('#register-error');
        var submitBtn = $('#register-submit');

        if (!username || !email || !password) {
          errorEl.textContent = '請填寫所有必填欄位';
          errorEl.classList.remove('hidden');
          return;
        }
        if (password !== confirm) {
          errorEl.textContent = '兩次密碼不一致';
          errorEl.classList.remove('hidden');
          return;
        }
        if (password.length < 8) {
          errorEl.textContent = '密碼至少需要 8 個字元';
          errorEl.classList.remove('hidden');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '建立中...';
        errorEl.classList.add('hidden');

        Auth.register(email, password)
          .then(function () {
            Router.navigate('dashboard');
            Toast.show('帳號建立成功！', 'success');
          })
          .catch(function (err) {
            errorEl.textContent = err.message || '註冊失敗';
            errorEl.classList.remove('hidden');
          })
          .finally(function () {
            submitBtn.disabled = false;
            submitBtn.textContent = '建立帳號';
          });
      });
    }

    // --- Logout buttons ---
    var logoutBtns = ['#btn-logout', '#btn-logout-logs'];
    logoutBtns.forEach(function (sel) {
      var btn = $(sel);
      if (btn) btn.addEventListener('click', function () { Auth.logout(); });
    });

    // --- User dropdown toggle ---
    function setupDropdown(avatarId, dropdownId) {
      var avatar = $(avatarId);
      var dropdown = $(dropdownId);
      if (!avatar || !dropdown) return;

      avatar.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.toggle('open');
      });
    }
    setupDropdown('#user-avatar-btn', '#user-dropdown');
    setupDropdown('#user-avatar-btn-logs', '#user-dropdown-logs');

    // Close dropdowns on outside click
    document.addEventListener('click', function () {
      $$('.user-dropdown.open').forEach(function (el) {
        el.classList.remove('open');
      });
    });

    // --- Settings save buttons ---
    var saveAnthropicBtn = $('#save-anthropic');
    if (saveAnthropicBtn) saveAnthropicBtn.addEventListener('click', function () { Settings.saveAnthropicKey(); });

    var saveWpBtn = $('#save-wordpress');
    if (saveWpBtn) saveWpBtn.addEventListener('click', function () { Settings.saveWordpress(); });

    var saveResendBtn = $('#save-resend');
    if (saveResendBtn) saveResendBtn.addEventListener('click', function () { Settings.saveResend(); });

    // --- Test WP Connection ---
    var testWpBtn = $('#test-wp-connection');
    if (testWpBtn) {
      testWpBtn.addEventListener('click', function () {
        Toast.show('正在測試連線...', 'info');
        // Save first, then test
        Settings.saveWordpress();
      });
    }

    // --- Step navigation buttons ---
    var step1Next = $('#step1-next');
    if (step1Next) step1Next.addEventListener('click', function () { Tabs.switchTo('step2'); });

    var step2Prev = $('#step2-prev');
    if (step2Prev) step2Prev.addEventListener('click', function () { Tabs.switchTo('step1'); });

    var step2Next = $('#step2-next');
    if (step2Next) {
      step2Next.addEventListener('click', function () {
        PromptEditor.saveToLocalStorage();
        Tabs.switchTo('step3');
      });
    }

    var step3Prev = $('#step3-prev');
    if (step3Prev) step3Prev.addEventListener('click', function () { Tabs.switchTo('step2'); });

    // --- Prompt toolbar ---
    var resetPromptBtn = $('#btn-reset-prompt');
    if (resetPromptBtn) resetPromptBtn.addEventListener('click', function () { PromptEditor.resetToDefault(); });

    var copyPromptBtn = $('#btn-copy-prompt');
    if (copyPromptBtn) copyPromptBtn.addEventListener('click', function () { PromptEditor.copyPrompt(); });

    // --- Direct upload toggle ---
    var directToggle = $('#toggle-direct-upload');
    if (directToggle) {
      directToggle.addEventListener('change', function () {
        var contentGroup = $('#direct-content-group');
        if (this.checked) {
          contentGroup.classList.remove('hidden');
        } else {
          contentGroup.classList.add('hidden');
        }
      });
    }

    // --- Execute button ---
    var executeBtn = $('#btn-execute');
    if (executeBtn) executeBtn.addEventListener('click', function () {
      var directToggle = $('#toggle-direct-upload');
      if (directToggle && directToggle.checked) {
        var content = $('#direct-content').value.trim();
        if (!content) {
          Toast.show('請貼上文章 HTML 內容', 'warning');
          return;
        }
        var keyword = $('#article-keyword').value.trim() || '直接上傳';
        var title = $('#article-title').value.trim() || '直接上傳文章';
        Execution.directUpload({
          title: title,
          content: content,
          keyword: keyword,
          slug: '',
          excerpt: '',
          seo: {},
        });
      } else {
        Execution.start();
      }
    });

    var cancelBtn = $('#btn-cancel-execute');
    if (cancelBtn) cancelBtn.addEventListener('click', function () { Execution.cancel(); });

    // --- Result actions ---
    var copyContentBtn = $('#btn-copy-content');
    if (copyContentBtn) {
      copyContentBtn.addEventListener('click', function () {
        var content = $('#result-article-content');
        if (content) {
          navigator.clipboard.writeText(content.innerHTML).then(function () {
            Toast.show('已複製 HTML 內容', 'success');
          });
        }
      });
    }

    var openWpEditorBtn = $('#btn-open-wp-editor');
    if (openWpEditorBtn) {
      openWpEditorBtn.addEventListener('click', function () {
        var link = $('#result-wp-link');
        if (link && link.href && link.href !== '#') {
          // Convert post link to edit link
          window.open(link.href.replace('/?p=', '/wp-admin/post.php?action=edit&post='), '_blank');
        }
      });
    }

    var generateAnotherBtn = $('#btn-generate-another');
    if (generateAnotherBtn) {
      generateAnotherBtn.addEventListener('click', function () {
        // Reset step 3 and 4
        $('#result-empty').classList.remove('hidden');
        $('#result-content').classList.add('hidden');
        $('#execution-progress').classList.add('hidden');
        $('#execute-actions').classList.remove('hidden');
        $('#execute-cancel-actions').classList.add('hidden');
        Tabs.switchTo('step2');
      });
    }

    var goToLogsBtn = $('#btn-go-to-logs');
    if (goToLogsBtn) {
      goToLogsBtn.addEventListener('click', function () {
        Router.navigate('logs');
      });
    }

    // --- Nav links (dashboard/logs page header) ---
    $$('[data-nav]').forEach(function (el) {
      el.addEventListener('click', function () {
        var target = el.getAttribute('data-nav');
        Router.navigate(target);
      });
    });

    // --- Logs: search and filter ---
    var searchInput = $('#logs-search-input');
    if (searchInput) {
      var searchTimer;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          Logs.currentSearch = searchInput.value.trim();
          Logs.load(1);
        }, 300);
      });
    }

    var filterSelect = $('#logs-filter-status');
    if (filterSelect) {
      filterSelect.addEventListener('change', function () {
        Logs.currentFilter = filterSelect.value;
        Logs.load(1);
      });
    }

    var refreshLogsBtn = $('#btn-refresh-logs');
    if (refreshLogsBtn) {
      refreshLogsBtn.addEventListener('click', function () { Logs.load(Logs.currentPage); });
    }

    // --- Modals ---
    // Open modals
    var wpSitesModalBtns = ['#btn-wp-sites-modal', '#btn-wp-sites-modal-logs'];
    wpSitesModalBtns.forEach(function (sel) {
      var btn = $(sel);
      if (btn) btn.addEventListener('click', function () { Modal.open('modal-wp-sites'); });
    });

    var settingsModalBtns = ['#btn-settings-modal', '#btn-settings-modal-logs'];
    settingsModalBtns.forEach(function (sel) {
      var btn = $(sel);
      if (btn) {
        btn.addEventListener('click', function () {
          // Navigate to dashboard step 1
          Router.navigate('dashboard');
          setTimeout(function () { Tabs.switchTo('step1'); }, 100);
        });
      }
    });

    // Close modals
    $$('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var modalId = btn.getAttribute('data-close-modal');
        Modal.close(modalId);
      });
    });

    // Close modal on backdrop click
    $$('.modal-backdrop').forEach(function (backdrop) {
      backdrop.addEventListener('click', function (e) {
        if (e.target === backdrop) {
          backdrop.classList.remove('open');
        }
      });
    });

    // --- WP Sites modal save ---
    var modalWpSave = $('#modal-wp-save');
    if (modalWpSave) {
      modalWpSave.addEventListener('click', function () {
        var url = $('#modal-wp-url').value.trim();
        var user = $('#modal-wp-user').value.trim();
        var pass = $('#modal-wp-pass').value.trim();

        if (!url || !user) {
          Toast.show('請填寫網址和使用者名稱', 'warning');
          return;
        }

        var data = { wp_url: url, wp_username: user };
        if (pass) data.wp_app_password = pass;

        Api.call('PUT', '/settings', data)
          .then(function () {
            Toast.show('WordPress 站台已儲存', 'success');
            Modal.close('modal-wp-sites');
            // Also update step 1 fields
            $('#wp-site-url').value = url;
            $('#wp-username').value = user;
            Settings._setStatus('wordpress', true);
            // Update selector
            var wpSelect = $('#article-wp-site');
            if (wpSelect) {
              wpSelect.innerHTML = '<option value="default">' + Utils.escapeHtml(url) + '</option>';
            }
          })
          .catch(function (err) { Toast.show(err.message, 'error'); });
      });
    }

  }

  // ---------------------------------------------------------------------------
  // Modal Helper
  // ---------------------------------------------------------------------------
  var Modal = {
    open: function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.add('open');
    },
    close: function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.remove('open');
    },
  };

  // ---------------------------------------------------------------------------
  // App Init
  // ---------------------------------------------------------------------------
  function init() {
    Toast.init();
    Tabs.init();
    Router.init();
    bindEvents();
    Settings.loadFromLocalStorage();

    // Check auth status then start router
    Auth.getMe().then(function () {
      Router.start();
    });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

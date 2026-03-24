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
  var DEFAULT_PROMPT = '# ROLE\n' +
'你是一位擁有10年經驗的SEO內容策略專家與AI Agent，專精Google E-E-A-T、Rank Math SEO、搜尋意圖分析，以及{{當前年份}}年最新SEO趨勢。全程只用繁體中文撰寫內容。輸出必須為完全相容WordPress Gutenberg區塊編輯器的HTML（包含區塊註解）。\n' +
'\n' +
'重要：現在是{{當前年份}}年。文章中任何提到年份的地方，「今年」= {{當前年份}}、「明年」= {{明年}}、「去年」= {{去年}}。標題、內容、SEO欄位中出現年份都必須正確反映時間。\n' +
'\n' +
'你是一個Agent：必須先分析關鍵字搜尋意圖（資訊型/交易型/導航型/商業調查型），再決定文章的結構、段落順序與內容深度。文章必須緊扣主要關鍵字與本篇指令，不可跑題。\n' +
'\n' +
'# INPUT（你只能使用以下輸入，不可自行假設未提供的商業資訊或虛構可驗證的案例/數字/客戶名稱）\n' +
'- 主要關鍵字：{{keyword}}\n' +
'- 文章標題（選填；若空白，請依搜尋意圖生成最適合且不跑題的標題，必要時可包含年份）：{{title}}\n' +
'- 作者背景（固定可調參數；用於E-E-A-T與作者視角，但不得喧賓奪主）：{{author_background}}\n' +
'- 本篇指令（融合欄位：包含內容方向＋必答重點＋讀者＋限制；必須嚴格遵守）：{{article_instruction}}\n' +
'\n' +
'# 固定寫作設定（不可更改）\n' +
'- 語氣風格：專業顧問感、直接、可執行、避免空話\n' +
'- 目標字數：至少2000字（可略多但不要灌水）\n' +
'- CTA內容：由你根據搜尋意圖與文章內容自行設計，務必明確、可行動、與本文一致\n' +
'\n' +
'# AGENT 任務步驟（強制順序）\n' +
'1) 搜尋意圖分析：判斷主要關鍵字意圖，並用1句話說明「使用者此刻最想得到什麼」。\n' +
'2) 目標讀者畫像：用3點描述讀者痛點、擔心、決策障礙（必須貼合本篇指令）。\n' +
'3) 語義關鍵字拓展：列出LSI相關詞與長尾關鍵字（至少12個），後續要自然融入。\n' +
'4) 文章結構規劃：先輸出H2/H3大綱（至少4個H2），並在每個H2後用【目的：解惑/比較/轉換/信任】標註其作用；大綱必須覆蓋本篇指令中的所有必答點。\n' +
'5) 撰寫全文：依大綱寫出全文（>=2000字），符合下列規則。\n' +
'6) Rank Math SEO欄位：輸出SEO title/description/focus keyword。\n' +
'\n' +
'# E-E-A-T 內容品質規則（{{當前年份}}最新）\n' +
'- Experience（經驗）：以第一人稱寫作，至少插入2段「實務情境」描述。不得虛構可驗證的數字、客戶名稱、專案細節；若沒有素材，使用「常見實務情境」敘述。\n' +
'- Expertise（專業）：內容必須有深度與可操作性，提供步驟、檢核清單、決策準則、比較表，不可只講概念。\n' +
'- Authoritativeness（權威）：用確定性語氣，避免「可能」「也許」等模糊措辭。首次出現的專有名詞必須加上權威來源超連結，同一名詞僅首次加連結。\n' +
'- Trustworthiness（可信度）：資訊必須準確、最新。不捏造統計數字。\n' +
'\n' +
'# 內容結構與可讀性規則\n' +
'- 段落控制2-4句；每250-350字至少出現一個H2或H3。\n' +
'- 主要關鍵字密度1-2%，自然融入上下文；同段不超過2次；同時融入LSI語義相關詞。\n' +
'- 列舉用Gutenberg列表區塊；步驟用有序列表；比較優先用Gutenberg表格區塊。\n' +
'- 結尾必須包含FAQ（至少3題，使用H3+P直接展開，不使用details/summary）與CTA段落。\n' +
'- 標點使用全形；中英文與數字之間不加空格。\n' +
'- 每段最多1-2個<strong>，避免過度。\n' +
'\n' +
'# WordPress Gutenberg 區塊格式規則（重要）\n' +
'所有HTML輸出必須嚴格使用WordPress Gutenberg區塊格式。\n' +
'\n' +
'<!-- wp:heading {"level":2} -->\n' +
'<h2 class="wp-block-heading">H2標題</h2>\n' +
'<!-- /wp:heading -->\n' +
'\n' +
'<!-- wp:paragraph -->\n' +
'<p>段落內容。</p>\n' +
'<!-- /wp:paragraph -->\n' +
'\n' +
'# Unsplash 圖片規則（每個H2章節結尾必插入1張）\n' +
'圖片來源：https://source.unsplash.com/1600x900/?{英文關鍵字1},{英文關鍵字2}\n' +
'圖片alt必須等於該H2標題文字（完全一致）。\n' +
'\n' +
'<!-- wp:image {"sizeSlug":"large"} -->\n' +
'<figure class="wp-block-image size-large"><img src="https://source.unsplash.com/1600x900/?seo,content" alt="H2標題文字"/></figure>\n' +
'<!-- /wp:image -->\n' +
'\n' +
'# OUTPUT（JSON格式；禁止輸出任何額外說明文字）\n' +
'{\n' +
'  "title": "文章標題",\n' +
'  "slug": "english-slug-with-keyword",\n' +
'  "content": "完整Gutenberg格式HTML文章",\n' +
'  "excerpt": "文章摘要100-150字",\n' +
'  "seo": {\n' +
'    "title": "SEO標題（必須與title完全一致）",\n' +
'    "description": "Meta描述150-160字元，必須包含主要關鍵字",\n' +
'    "focus_keyword": "主要關鍵字（只填1個）"\n' +
'  }\n' +
'}';

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

    get: function (path) {
      return this.call('GET', path);
    },

    post: function (path, data) {
      return this.call('POST', path, data);
    },

    put: function (path, data) {
      return this.call('PUT', path, data);
    },

    delete: function (path) {
      return this.call('DELETE', path);
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
      } else if (page === 'schedule') {
        Schedule.load(1);
      } else if (page === 'keywords') {
        Keywords.load();
      } else if (page === 'keyword-research') {
        KeywordResearch.init();
      } else if (page === 'keyword-pool') {
        KeywordPool.load(1);
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

      // Auto-publish defaults
      var apAuthorBg = $('#auto-publish-author-bg');
      var apArticleInst = $('#auto-publish-article-inst');
      if (apAuthorBg && s.auto_publish_author_bg) apAuthorBg.value = s.auto_publish_author_bg;
      if (apArticleInst && s.auto_publish_article_inst) apArticleInst.value = s.auto_publish_article_inst;
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

    saveAutoPublishDefaults: function () {
      var data = {
        auto_publish_author_bg: $('#auto-publish-author-bg').value.trim() || null,
        auto_publish_article_inst: $('#auto-publish-article-inst').value.trim() || null,
      };

      Api.call('PUT', '/settings', data)
        .then(function () {
          Toast.show('自動發文預設值已儲存', 'success');
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
      var authorBg = $('#article-author-background').value.trim() || '無';
      var instruction = $('#article-instruction').value.trim() || '無';

      var now = new Date();
      var currentYear = now.getFullYear();

      // New variable names
      prompt = prompt.replace(/\{\{\s*keyword\s*\}\}/g, keyword);
      prompt = prompt.replace(/\{\{\s*title\s*\}\}/g, title);
      prompt = prompt.replace(/\{\{\s*author_background\s*\}\}/g, authorBg);
      prompt = prompt.replace(/\{\{\s*article_instruction\s*\}\}/g, instruction);
      // Year variables
      prompt = prompt.replace(/\{\{當前年份\}\}/g, String(currentYear));
      prompt = prompt.replace(/\{\{明年\}\}/g, String(currentYear + 1));
      prompt = prompt.replace(/\{\{去年\}\}/g, String(currentYear - 1));
      // Legacy variable names (backwards compat for old saved prompts)
      prompt = prompt.replace(/\{\{\s*direction\s*\}\}/g, authorBg);
      prompt = prompt.replace(/\{\{\s*material\s*\}\}/g, instruction);
      prompt = prompt.replace(/\{\{\s*tone\s*\}\}/g, '專業顧問感');
      prompt = prompt.replace(/\{\{\s*word_count\s*\}\}/g, '2000');
      prompt = prompt.replace(/\{\{\s*language\s*\}\}/g, '由AI自行設計');
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
        author_background: $('#article-author-background').value.trim() || undefined,
        article_instruction: $('#article-instruction').value.trim() || undefined,
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

      var sourceBadge = function (source) {
        if (source === 'auto_publish') return '<span class="badge badge-info">自動發文</span>';
        if (source === 'scheduled') return '<span class="badge badge-secondary">排程</span>';
        return '<span class="badge badge-default">手動</span>';
      };

      tbody.innerHTML = filtered.map(function (t, idx) {
        var result = t.result || {};
        var hasContent = result.article_content ? true : false;
        return '<tr>' +
          '<td>' + ((Logs.currentPage - 1) * 20 + idx + 1) + '</td>' +
          '<td>' + Utils.escapeHtml(t.keyword || '-') + '</td>' +
          '<td class="truncate" style="max-width:200px;">' + Utils.escapeHtml(t.title || result.article_title || '-') + '</td>' +
          '<td>' + Utils.escapeHtml(t.wp_url || '-') + '</td>' +
          '<td>' + sourceBadge(t.source) + '</td>' +
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
  // Schedule Module
  // ---------------------------------------------------------------------------
  // ---------------------------------------------------------------------------
  // Schedule Module
  // ---------------------------------------------------------------------------
  var Schedule = {
    currentPage: 1,
    currentSearch: '',
    currentFilter: '',

    load: function (page) {
      this.currentPage = page || 1;
      var params = '?page=' + this.currentPage + '&per_page=20';
      if (this.currentSearch) params += '&search=' + encodeURIComponent(this.currentSearch);
      if (this.currentFilter) params += '&status=' + encodeURIComponent(this.currentFilter);

      Api.call('GET', '/schedule' + params)
        .then(function (res) {
          Schedule._renderTable(res.items || []);
          Schedule._renderPagination(res.page, res.pages, res.total);
        })
        .catch(function (err) {
          Toast.show('載入排程失敗: ' + err.message, 'error');
        });
    },

    openAddModal: function () {
      $('#schedule-modal-id').value = '';
      $('#modal-keyword').value = '';
      $('#modal-title').value = '';
      $('#modal-author-background').value = '';
      $('#modal-instruction').value = '';
      $('#modal-scheduled-at').value = '';
      $('#schedule-modal-title').textContent = '新增排程';
      $('#btn-save-schedule-modal').textContent = '新增';
      var overlay = $('#schedule-modal-overlay');
      overlay.style.display = 'flex';
    },

    openEditModal: function (item) {
      $('#schedule-modal-id').value = item.id;
      $('#modal-keyword').value = item.keyword || '';
      $('#modal-title').value = item.title || '';
      $('#modal-author-background').value = item.direction || '';
      $('#modal-instruction').value = item.material || '';
      if (item.scheduled_at) {
        var d = new Date(item.scheduled_at);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        var local = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
          'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
        $('#modal-scheduled-at').value = local;
      } else {
        $('#modal-scheduled-at').value = '';
      }
      $('#schedule-modal-title').textContent = '修改排程';
      $('#btn-save-schedule-modal').textContent = '儲存修改';
      var overlay = $('#schedule-modal-overlay');
      overlay.style.display = 'flex';
    },

    closeModal: function () {
      var overlay = $('#schedule-modal-overlay');
      if (overlay) overlay.style.display = 'none';
    },

    saveModal: function () {
      var keyword = ($('#modal-keyword').value || '').trim();
      var scheduledAt = $('#modal-scheduled-at').value;
      var id = $('#schedule-modal-id').value;

      if (!keyword) { Toast.show('請填寫關鍵字', 'warning'); return; }
      if (!scheduledAt) { Toast.show('請選擇排程時間', 'warning'); return; }

      var data = {
        keyword: keyword,
        title: ($('#modal-title').value || '').trim() || null,
        author_background: ($('#modal-author-background').value || '').trim() || null,
        article_instruction: ($('#modal-instruction').value || '').trim() || null,
        scheduled_at: new Date(scheduledAt).toISOString(),
      };

      var saveBtn = $('#btn-save-schedule-modal');
      saveBtn.disabled = true;

      var req = id
        ? Api.call('PUT', '/schedule/' + id, data)
        : Api.call('POST', '/schedule', data);

      req.then(function () {
          Toast.show(id ? '排程已更新' : '排程已新增', 'success');
          Schedule.closeModal();
          Schedule.load(Schedule.currentPage);
        })
        .catch(function (err) {
          Toast.show((id ? '更新' : '新增') + '失敗: ' + err.message, 'error');
        })
        .then(function () {
          saveBtn.disabled = false;
        });
    },

    delete: function (id) {
      if (!confirm('確定刪除此排程？')) return;
      Api.call('DELETE', '/schedule/' + id)
        .then(function () {
          Toast.show('排程已刪除', 'success');
          Schedule.load(Schedule.currentPage);
        })
        .catch(function (err) {
          Toast.show('刪除失敗: ' + err.message, 'error');
        });
    },

    _renderTable: function (items) {
      var tbody = $('#schedule-table-body');
      var empty = $('#schedule-empty');
      if (!tbody) return;

      if (!items.length) {
        tbody.innerHTML = '';
        if (empty) empty.classList.remove('hidden');
        return;
      }
      if (empty) empty.classList.add('hidden');

      var statusBadge = function (status) {
        var map = {
          pending:    '<span class="badge badge-default">待執行</span>',
          processing: '<span class="badge badge-info">執行中</span>',
          completed:  '<span class="badge badge-success">已完成</span>',
          failed:     '<span class="badge badge-error">失敗</span>',
          cancelled:  '<span class="badge badge-warning">已取消</span>',
        };
        return map[status] || '<span class="badge badge-default">' + Utils.escapeHtml(status) + '</span>';
      };

      var itemMap = {};
      items.forEach(function (item) { itemMap[item.id] = item; });

      tbody.innerHTML = items.map(function (item, idx) {
        var isPending = item.status === 'pending';
        var canDelete = isPending || item.status === 'cancelled';
        var actions = '';
        if (isPending) {
          actions += '<button class="btn btn-sm btn-ghost" data-edit-schedule="' + item.id + '" style="margin-right:4px;">編輯</button>';
        }
        if (canDelete) {
          actions += '<button class="btn btn-sm btn-ghost" data-delete-schedule="' + item.id + '" style="color:var(--color-error);">刪除</button>';
        }
        if (!actions) actions = '-';

        return '<tr>' +
          '<td>' + ((Schedule.currentPage - 1) * 20 + idx + 1) + '</td>' +
          '<td>' + Utils.escapeHtml(item.keyword || '-') + '</td>' +
          '<td class="truncate" style="max-width:180px;">' + Utils.escapeHtml(item.title || '-') + '</td>' +
          '<td>' + Utils.formatDate(item.scheduled_at) + '</td>' +
          '<td>' + statusBadge(item.status) + '</td>' +
          '<td>' + Utils.formatDate(item.created_at) + '</td>' +
          '<td style="white-space:nowrap;">' + actions + '</td>' +
        '</tr>';
      }).join('');

      tbody.querySelectorAll('[data-edit-schedule]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var item = itemMap[parseInt(this.getAttribute('data-edit-schedule'), 10)];
          if (item) Schedule.openEditModal(item);
        });
      });
      tbody.querySelectorAll('[data-delete-schedule]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          Schedule.delete(parseInt(this.getAttribute('data-delete-schedule'), 10));
        });
      });
    },

    _renderPagination: function (page, pages, total) {
      var container = $('#schedule-pagination');
      if (!container) return;
      container.innerHTML = '';
      if (!pages || pages <= 1) return;

      var prevBtn = document.createElement('button');
      prevBtn.className = 'pagination-btn';
      prevBtn.innerHTML = '&laquo;';
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', function () { Schedule.load(page - 1); });
      container.appendChild(prevBtn);

      for (var i = 1; i <= pages; i++) {
        var btn = document.createElement('button');
        btn.className = 'pagination-btn' + (i === page ? ' active' : '');
        btn.textContent = i;
        btn.addEventListener('click', (function (p) {
          return function () { Schedule.load(p); };
        })(i));
        container.appendChild(btn);
      }

      var nextBtn = document.createElement('button');
      nextBtn.className = 'pagination-btn';
      nextBtn.innerHTML = '&raquo;';
      nextBtn.disabled = page >= pages;
      nextBtn.addEventListener('click', function () { Schedule.load(page + 1); });
      container.appendChild(nextBtn);
    },
  };

  // ---------------------------------------------------------------------------
  // Keywords Module
  // ---------------------------------------------------------------------------
  var Keywords = {
    data: null,
    searchTerm: '',

    load: function () {
      var tbody = $('#keywords-table-body');
      var wrapper = $('#keywords-table-wrapper');
      var loading = $('#keywords-loading');
      var empty = $('#keywords-empty');
      var errorEl = $('#keywords-error');

      if (!tbody) return;

      tbody.innerHTML = '';
      if (wrapper) wrapper.style.display = 'none';
      if (empty) empty.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (loading) loading.style.display = 'flex';

      Api.call('GET', '/keywords/wp-keywords')
        .then(function (res) {
          Keywords.data = res;
          if (loading) loading.style.display = 'none';
          var totalPosts = $('#keywords-total-posts');
          if (totalPosts) totalPosts.textContent = res.total || 0;
          Keywords._render();
        })
        .catch(function (err) {
          if (loading) loading.style.display = 'none';
          if (errorEl) {
            errorEl.style.display = 'flex';
            var msg = $('#keywords-error-msg');
            if (msg) msg.textContent = err.message || '載入失敗';
          }
          Toast.show('載入關鍵字失敗: ' + err.message, 'error');
        });
    },

    _render: function () {
      var tbody = $('#keywords-table-body');
      var wrapper = $('#keywords-table-wrapper');
      var empty = $('#keywords-empty');
      if (!tbody || !this.data) return;

      var posts = this.data.posts || [];
      var search = this.searchTerm.toLowerCase();

      if (search) {
        posts = posts.filter(function (p) {
          return (p.title || '').toLowerCase().indexOf(search) !== -1 ||
                 (p.keyword || '').toLowerCase().indexOf(search) !== -1;
        });
      }

      if (!posts.length) {
        tbody.innerHTML = '';
        if (wrapper) wrapper.style.display = 'none';
        if (empty) empty.style.display = 'flex';
        return;
      }

      if (wrapper) wrapper.style.display = '';
      if (empty) empty.style.display = 'none';

      tbody.innerHTML = posts.map(function (p) {
        var statusLabel = p.status === 'publish' ? '已發佈' : '草稿';
        var statusClass = p.status === 'publish' ? 'color:var(--color-success)' : 'color:var(--color-warning)';
        var titleHtml = p.link
          ? '<a href="' + Utils.escapeHtml(p.link) + '" target="_blank" style="color:var(--text-primary);text-decoration:none;" onmouseover="this.style.textDecoration=\'underline\'" onmouseout="this.style.textDecoration=\'none\'">' + Utils.escapeHtml(p.title || '(無標題)') + '</a>'
          : Utils.escapeHtml(p.title || '(無標題)');
        var kwHtml = p.keyword
          ? '<span style="display:inline-flex;align-items:center;gap:6px;">' +
              '<span>' + Utils.escapeHtml(p.keyword) + '</span>' +
              '<button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:11px;" data-row-research="' + Utils.escapeHtml(p.keyword) + '" title="研究此關鍵字">研究</button>' +
              '<button class="btn btn-sm btn-ghost" style="padding:2px 6px;font-size:11px;" data-row-generate="' + Utils.escapeHtml(p.keyword) + '" title="用此關鍵字產文">產文</button>' +
            '</span>'
          : '<span style="color:var(--text-tertiary);font-style:italic;">無</span>';
        return '<tr>' +
          '<td style="font-family:var(--font-mono);font-size:12px;color:var(--text-secondary);">' + Utils.escapeHtml(p.date || '') + '</td>' +
          '<td>' + titleHtml + '</td>' +
          '<td>' + kwHtml + '</td>' +
          '<td style="' + statusClass + ';font-size:12px;">' + statusLabel + '</td>' +
        '</tr>';
      }).join('');

      // Bind quick-action buttons
      tbody.querySelectorAll('[data-row-research]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var kw = this.getAttribute('data-row-research');
          Router.navigate('keyword-research');
          setTimeout(function () {
            var input = $('#kw-research-input');
            if (input) {
              input.value = kw;
              KeywordResearch.search();
            }
          }, 100);
        });
      });
      tbody.querySelectorAll('[data-row-generate]').forEach(function (btn) {
        btn.addEventListener('click', function (e) {
          e.preventDefault();
          var kw = this.getAttribute('data-row-generate');
          Router.navigate('dashboard');
          setTimeout(function () {
            Tabs.switchTo('step2');
            var input = $('#article-keyword');
            if (input) input.value = kw;
          }, 100);
        });
      });
    },
  };

  // ---------------------------------------------------------------------------
  // Keyword Research Module
  // ---------------------------------------------------------------------------
  var KeywordResearch = {
    lastResults: null,

    init: function () {
      // No-op; page is already rendered in HTML
    },

    search: function () {
      var input = $('#kw-research-input');
      var keyword = input ? input.value.trim() : '';
      if (!keyword) {
        Toast.show('請輸入關鍵字', 'warning');
        return;
      }

      var loading = $('#kw-research-loading');
      var results = $('#kw-research-results');
      var idle = $('#kw-research-idle');
      var errorEl = $('#kw-research-error');
      var searchBtn = $('#btn-kw-research');

      if (idle) idle.style.display = 'none';
      if (errorEl) errorEl.style.display = 'none';
      if (results) results.style.display = 'none';
      if (loading) loading.style.display = 'flex';
      if (searchBtn) searchBtn.disabled = true;

      Api.call('POST', '/keywords/research', { keyword: keyword })
        .then(function (res) {
          KeywordResearch.lastResults = res;
          KeywordResearch.lastResults._keyword = keyword;
          if (loading) loading.style.display = 'none';
          if (searchBtn) searchBtn.disabled = false;
          KeywordResearch._renderResults(res, keyword);
        })
        .catch(function (err) {
          if (loading) loading.style.display = 'none';
          if (searchBtn) searchBtn.disabled = false;
          if (errorEl) {
            errorEl.style.display = 'flex';
            var msg = $('#kw-research-error-msg');
            if (msg) msg.textContent = err.message || '搜尋失敗';
          }
          Toast.show('關鍵字研究失敗: ' + err.message, 'error');
        });
    },

    _renderResults: function (res, keyword) {
      var results = $('#kw-research-results');
      var gridEl = $('#kw-research-grid');
      var seedEl = $('#kw-research-seed');
      var badgeEl = $('#kw-research-source-badge');

      if (!results || !gridEl) return;

      var sources = res.sources || {};
      var keywords = res.keywords || [];

      if (seedEl) seedEl.textContent = keyword;
      if (badgeEl) {
        var parts = [];
        parts.push(keywords.length + ' 個建議');
        if (sources.google) parts.push('來自 Google: ' + sources.google + ' 筆原始資料');
        badgeEl.textContent = parts.join(' | ');
      }

      if (!keywords.length) {
        gridEl.innerHTML = '<p class="text-secondary" style="padding:var(--space-md);">未找到相關長尾關鍵字。</p>';
      } else {
        gridEl.innerHTML = keywords.map(function (kw) {
          return '<div class="kw-result-card">' +
            '<span class="kw-result-text">' + Utils.escapeHtml(kw) + '</span>' +
            '<div class="kw-result-actions">' +
              '<button class="kw-result-btn" title="複製" data-kwr-copy="' + Utils.escapeHtml(kw) + '">&#x2398;</button>' +
              '<button class="kw-result-btn use-btn" title="用此關鍵字產文" data-kwr-use="' + Utils.escapeHtml(kw) + '">&#x2192;</button>' +
            '</div>' +
          '</div>';
        }).join('');

        // Bind copy buttons
        gridEl.querySelectorAll('[data-kwr-copy]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var kw = this.getAttribute('data-kwr-copy');
            navigator.clipboard.writeText(kw).then(function () {
              Toast.show('已複製: ' + kw, 'success');
            });
          });
        });

        // Bind use buttons
        gridEl.querySelectorAll('[data-kwr-use]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var kw = this.getAttribute('data-kwr-use');
            Router.navigate('dashboard');
            setTimeout(function () {
              Tabs.switchTo('step2');
              var input = $('#article-keyword');
              if (input) input.value = kw;
            }, 100);
          });
        });
      }

      results.style.display = 'block';
    },

    copyAll: function () {
      if (!this.lastResults || !this.lastResults.keywords) return;
      var text = this.lastResults.keywords.join('\n');
      navigator.clipboard.writeText(text).then(function () {
        Toast.show('已複製 ' + KeywordResearch.lastResults.keywords.length + ' 個關鍵字', 'success');
      });
    },
  };

  // ---------------------------------------------------------------------------
  // KeywordPool Module
  // ---------------------------------------------------------------------------
  var KeywordPool = {
    _currentPage: 1,
    _filterUsed: '',

    load: function (page) {
      this._currentPage = page || 1;
      var filterEl = $('#kp-filter-used');
      this._filterUsed = filterEl ? filterEl.value : '';
      this._loadConfig();
      this._loadKeywords();
      this._loadLogs(1);
    },

    _loadConfig: function () {
      Api.get('/keyword-pool/config').then(function (res) {
        var input = $('#kp-topic-input');
        if (input) input.value = res.topic || '';
      }).catch(function () {});
    },

    _loadKeywords: function () {
      var self = this;
      var loading = $('#kp-loading');
      var empty = $('#kp-empty');
      var wrapper = $('#kp-table-wrapper');
      var badge = $('#kp-total-badge');
      if (loading) loading.style.display = '';
      if (empty) empty.style.display = 'none';
      if (wrapper) wrapper.style.display = 'none';

      var params = 'page=' + self._currentPage + '&per_page=20';
      if (self._filterUsed !== '') params += '&is_used=' + self._filterUsed;

      Api.get('/keyword-pool?' + params).then(function (res) {
        if (loading) loading.style.display = 'none';
        if (badge) badge.textContent = '共 ' + res.total + ' 個關鍵字';
        if (!res.items || res.items.length === 0) {
          if (empty) empty.style.display = '';
          return;
        }
        if (wrapper) wrapper.style.display = '';
        self._renderRows(res.items);
        self._renderPagination(res.page, res.pages);
      }).catch(function (err) {
        if (loading) loading.style.display = 'none';
        Toast.show(err.message || '載入失敗', 'error');
      });
    },

    _renderRows: function (items) {
      var self = this;
      var tbody = $('#kp-table-body');
      if (!tbody) return;
      tbody.innerHTML = '';
      items.forEach(function (kw) {
        var tr = document.createElement('tr');
        var sourceLabel = kw.source === 'wp' ? 'WP同步' : kw.source === 'research' ? '研究' : '手動';
        var usedBadge = kw.is_used
          ? '<span class="badge badge-secondary">已使用</span>'
          : '<span class="badge badge-success">未使用</span>';
        tr.innerHTML = '<td>' + Utils.escapeHtml(kw.keyword) + '</td>' +
          '<td>' + sourceLabel + '</td>' +
          '<td>' + usedBadge + '</td>' +
          '<td>' + (kw.created_at ? kw.created_at.slice(0, 10) : '') + '</td>' +
          '<td style="white-space:nowrap;">' +
            '<button class="btn btn-ghost btn-sm" data-kp-toggle="' + kw.id + '">' + (kw.is_used ? '標為未使用' : '標為已使用') + '</button>' +
            ' <button class="btn btn-ghost btn-sm" style="color:var(--color-error);" data-kp-delete="' + kw.id + '">刪除</button>' +
            ' <button class="btn btn-primary btn-sm" data-kp-generate="' + encodeURIComponent(kw.keyword) + '">生成文章</button>' +
          '</td>';
        tbody.appendChild(tr);
      });

      // Bind row action buttons
      tbody.addEventListener('click', function (e) {
        var toggleBtn = e.target.closest('[data-kp-toggle]');
        var deleteBtn = e.target.closest('[data-kp-delete]');
        var generateBtn = e.target.closest('[data-kp-generate]');
        if (toggleBtn) self._toggleKeyword(parseInt(toggleBtn.getAttribute('data-kp-toggle')));
        if (deleteBtn) self._deleteKeyword(parseInt(deleteBtn.getAttribute('data-kp-delete')));
        if (generateBtn) {
          var kw = decodeURIComponent(generateBtn.getAttribute('data-kp-generate'));
          localStorage.setItem('autowp_prefill_keyword', kw);
          Router.navigate('dashboard');
        }
      }, { once: true });
    },

    _renderPagination: function (page, pages) {
      var self = this;
      var container = $('#kp-pagination');
      if (!container) return;
      container.innerHTML = '';
      if (!pages || pages <= 1) return;
      var prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-ghost btn-sm';
      prevBtn.textContent = '上一頁';
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', function () { self.load(page - 1); });
      container.appendChild(prevBtn);
      for (var i = 1; i <= pages; i++) {
        (function (pageNum) {
          var btn = document.createElement('button');
          btn.className = 'btn btn-sm' + (pageNum === page ? ' btn-primary' : ' btn-ghost');
          btn.textContent = pageNum;
          btn.addEventListener('click', function () { self.load(pageNum); });
          container.appendChild(btn);
        })(i);
      }
      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-ghost btn-sm';
      nextBtn.textContent = '下一頁';
      nextBtn.disabled = page >= pages;
      nextBtn.addEventListener('click', function () { self.load(page + 1); });
      container.appendChild(nextBtn);
    },

    _loadLogs: function (page) {
      var self = this;
      var loading = $('#kp-log-loading');
      var empty = $('#kp-log-empty');
      var wrapper = $('#kp-log-table-wrapper');
      if (loading) loading.style.display = '';
      if (empty) empty.style.display = 'none';
      if (wrapper) wrapper.style.display = 'none';

      Api.get('/keyword-pool/auto-publish-logs?page=' + page + '&per_page=10').then(function (res) {
        if (loading) loading.style.display = 'none';
        if (!res.items || res.items.length === 0) {
          if (empty) empty.style.display = '';
          return;
        }
        if (wrapper) wrapper.style.display = '';
        var tbody = $('#kp-log-body');
        if (!tbody) return;
        tbody.innerHTML = '';
        res.items.forEach(function (log) {
          var tr = document.createElement('tr');
          var statusMap = { success: '成功', skipped: '已跳過', failed: '失敗', no_keyword: '無關鍵字' };
          var statusLabel = statusMap[log.status] || log.status;
          var statusClass = log.status === 'success' ? 'badge-success' : log.status === 'skipped' ? 'badge-secondary' : 'badge-error';
          tr.innerHTML = '<td>' + Utils.escapeHtml(log.check_date || '') + '</td>' +
            '<td><span class="badge ' + statusClass + '">' + statusLabel + '</span></td>' +
            '<td>' + Utils.escapeHtml(log.keyword || '—') + '</td>' +
            '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="' + Utils.escapeHtml(log.note || '') + '">' + Utils.escapeHtml(log.note || '—') + '</td>' +
            '<td>' + (log.created_at ? log.created_at.slice(0, 16).replace('T', ' ') : '') + '</td>';
          tbody.appendChild(tr);
        });
        self._renderLogPagination(res.page, res.pages);
      }).catch(function () {
        if (loading) loading.style.display = 'none';
      });
    },

    _renderLogPagination: function (page, pages) {
      var self = this;
      var container = $('#kp-log-pagination');
      if (!container) return;
      container.innerHTML = '';
      if (!pages || pages <= 1) return;
      var prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-ghost btn-sm';
      prevBtn.textContent = '上一頁';
      prevBtn.disabled = page <= 1;
      prevBtn.addEventListener('click', function () { self._loadLogs(page - 1); });
      container.appendChild(prevBtn);
      var nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-ghost btn-sm';
      nextBtn.textContent = '下一頁';
      nextBtn.disabled = page >= pages;
      nextBtn.addEventListener('click', function () { self._loadLogs(page + 1); });
      container.appendChild(nextBtn);
    },

    _toggleKeyword: function (id) {
      var self = this;
      Api.put('/keyword-pool/' + id + '/toggle', {}).then(function () {
        Toast.show('狀態已更新', 'success');
        self._loadKeywords();
      }).catch(function (err) {
        Toast.show(err.message || '操作失敗', 'error');
      });
    },

    _deleteKeyword: function (id) {
      if (!confirm('確定要刪除這個關鍵字？')) return;
      var self = this;
      Api.delete('/keyword-pool/' + id).then(function () {
        Toast.show('已刪除', 'success');
        self._loadKeywords();
      }).catch(function (err) {
        Toast.show(err.message || '刪除失敗', 'error');
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
    var logoutBtns = ['#btn-logout', '#btn-logout-logs', '#btn-logout-schedule', '#btn-logout-keywords', '#btn-logout-kwresearch', '#btn-logout-kwpool'];
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
    setupDropdown('#user-avatar-btn-schedule', '#user-dropdown-schedule');
    setupDropdown('#user-avatar-btn-keywords', '#user-dropdown-keywords');
    setupDropdown('#user-avatar-btn-kwresearch', '#user-dropdown-kwresearch');
    setupDropdown('#user-avatar-btn-kwpool', '#user-dropdown-kwpool');

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

    var saveAutoPublishBtn = $('#save-auto-publish-defaults');
    if (saveAutoPublishBtn) saveAutoPublishBtn.addEventListener('click', function () { Settings.saveAutoPublishDefaults(); });

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

    // --- Schedule ---
    var btnOpenScheduleModal = $('#btn-open-schedule-modal');
    if (btnOpenScheduleModal) {
      btnOpenScheduleModal.addEventListener('click', function () { Schedule.openAddModal(); });
    }
    var btnCloseScheduleModal = $('#btn-close-schedule-modal');
    if (btnCloseScheduleModal) {
      btnCloseScheduleModal.addEventListener('click', function () { Schedule.closeModal(); });
    }
    var btnCancelScheduleModal = $('#btn-cancel-schedule-modal');
    if (btnCancelScheduleModal) {
      btnCancelScheduleModal.addEventListener('click', function () { Schedule.closeModal(); });
    }
    var btnSaveScheduleModal = $('#btn-save-schedule-modal');
    if (btnSaveScheduleModal) {
      btnSaveScheduleModal.addEventListener('click', function () { Schedule.saveModal(); });
    }
    var scheduleModalOverlay = $('#schedule-modal-overlay');
    if (scheduleModalOverlay) {
      scheduleModalOverlay.addEventListener('click', function (e) {
        if (e.target === scheduleModalOverlay) Schedule.closeModal();
      });
    }
    var scheduleSearch = $('#schedule-search-input');
    if (scheduleSearch) {
      var scheduleSearchTimer;
      scheduleSearch.addEventListener('input', function () {
        clearTimeout(scheduleSearchTimer);
        scheduleSearchTimer = setTimeout(function () {
          Schedule.currentSearch = scheduleSearch.value.trim();
          Schedule.load(1);
        }, 300);
      });
    }
    var scheduleFilterStatus = $('#schedule-filter-status');
    if (scheduleFilterStatus) {
      scheduleFilterStatus.addEventListener('change', function () {
        Schedule.currentFilter = this.value;
        Schedule.load(1);
      });
    }
    var btnRefreshSchedule = $('#btn-refresh-schedule');
    if (btnRefreshSchedule) {
      btnRefreshSchedule.addEventListener('click', function () { Schedule.load(Schedule.currentPage); });
    }

    // --- Keywords page ---
    var keywordsSearch = $('#keywords-search-input');
    if (keywordsSearch) {
      var kwSearchTimer;
      keywordsSearch.addEventListener('input', function () {
        clearTimeout(kwSearchTimer);
        kwSearchTimer = setTimeout(function () {
          Keywords.searchTerm = keywordsSearch.value.trim();
          Keywords._render();
        }, 300);
      });
    }
    var btnRefreshKeywords = $('#btn-refresh-keywords');
    if (btnRefreshKeywords) {
      btnRefreshKeywords.addEventListener('click', function () { Keywords.load(); });
    }

    // --- Keyword Research page ---
    var btnKwResearch = $('#btn-kw-research');
    if (btnKwResearch) {
      btnKwResearch.addEventListener('click', function () { KeywordResearch.search(); });
    }
    var kwResearchInput = $('#kw-research-input');
    if (kwResearchInput) {
      kwResearchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { KeywordResearch.search(); }
      });
    }
    var btnKwCopyAll = $('#btn-kw-copy-all');
    if (btnKwCopyAll) {
      btnKwCopyAll.addEventListener('click', function () { KeywordResearch.copyAll(); });
    }

    // --- Keyword Pool page ---
    document.addEventListener('click', function (e) {
      if (e.target.id === 'kp-save-topic-btn') {
        var topicInput = $('#kp-topic-input');
        var topic = topicInput ? topicInput.value : '';
        Api.put('/keyword-pool/config', { topic: topic }).then(function () {
          Toast.show('主題已儲存', 'success');
        }).catch(function (err) { Toast.show(err.message || '儲存失敗', 'error'); });
      }
      if (e.target.id === 'kp-sync-wp-btn') {
        e.target.disabled = true;
        e.target.textContent = '同步中...';
        Api.post('/keyword-pool/sync-wp', {}).then(function (res) {
          Toast.show('同步完成，新增 ' + res.added + ' 個關鍵字', 'success');
          KeywordPool.load(1);
        }).catch(function (err) {
          Toast.show(err.message || '同步失敗', 'error');
        }).finally(function () {
          e.target.disabled = false;
          e.target.textContent = '從 WordPress 同步關鍵字';
        });
      }
      if (e.target.id === 'kp-research-btn') {
        e.target.disabled = true;
        e.target.textContent = '研究中...';
        var topicEl = $('#kp-topic-input');
        var researchTopic = topicEl ? topicEl.value : '';
        Api.post('/keyword-pool/research', { topic: researchTopic }).then(function (res) {
          Toast.show('研究完成，新增 ' + res.added + ' 個長尾關鍵字', 'success');
          KeywordPool.load(1);
        }).catch(function (err) {
          Toast.show(err.message || '研究失敗', 'error');
        }).finally(function () {
          e.target.disabled = false;
          e.target.textContent = '以主題研究長尾關鍵字';
        });
      }
    });

    document.addEventListener('change', function (e) {
      if (e.target.id === 'kp-filter-used') {
        KeywordPool._filterUsed = e.target.value;
        KeywordPool.load(1);
      }
    });

    // --- Modals ---
    // Open modals
    var wpSitesModalBtns = ['#btn-wp-sites-modal', '#btn-wp-sites-modal-logs', '#btn-wp-sites-modal-schedule', '#btn-wp-sites-modal-keywords', '#btn-wp-sites-modal-kwresearch', '#btn-wp-sites-modal-kwpool'];
    wpSitesModalBtns.forEach(function (sel) {
      var btn = $(sel);
      if (btn) btn.addEventListener('click', function () { Modal.open('modal-wp-sites'); });
    });

    var settingsModalBtns = ['#btn-settings-modal', '#btn-settings-modal-logs', '#btn-settings-modal-schedule', '#btn-settings-modal-keywords', '#btn-settings-modal-kwresearch', '#btn-settings-modal-kwpool'];
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

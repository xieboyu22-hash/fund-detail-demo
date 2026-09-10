/**
 * reits2.js — REITs2 管理页公共脚本
 * 职责：API 封装（Result 解包）、Toast、弹窗、导航、格式化、枚举映射
 */
const R2 = {

  /**
   * 应用可能部署在子路径下（如网关 /asset-cloud-uat/open-agent/），
   * 优先复用 admin-core 推导的应用根路径（页面位于 <root>/pages/reits/xxx.html）。
   * 本地开发时推导结果为空字符串，行为与原来一致。
   */
  basePath() {
    if (window.App && App.config && typeof App.config.BASE_PATH === 'string') {
      return App.config.BASE_PATH;
    }
    const p = window.location.pathname;
    const i = p.indexOf('/pages/reits/');
    return i >= 0 ? p.slice(0, i) : '';
  },

  // ── 枚举映射 ──
  FUND_STAGE: {
    ACCEPTED: '已受理', APPROVED: '已通过', ISSUE: '已发售',
    LISTED: '已上市', OPERATION: '运作中', DISSOLVED: '已解散'
  },
  INDICATOR_TYPE: { BASE: '基础指标', DERIVED: '衍生指标' },
  ENTITY_SCOPE: { FUND: '基金级', ASSET: '资产级', BOTH: '通用' },
  ARBITRATE: { CONFIDENCE_PRIORITY: '置信度优先', MAJORITY_VOTE: '多数投票', STRICT_MATCH: '严格一致' },
  LIFECYCLE: { ACTIVE: '生效中', DEPRECATED: '已废弃' },
  VALUE_TYPES: ['STRING', 'DECIMAL', 'INTEGER', 'DATE', 'JSON', 'LIST'],
  VALUE_TYPE_CN: { STRING: '文本', DECIMAL: '数值', INTEGER: '整数', DATE: '日期', JSON: 'JSON对象', LIST: '列表' },
  DOC_TYPES: [],
  STRATEGIES: [
    { code: 'AI', name: 'AI 提取' },
    { code: 'REGEX', name: '正则提取' },
    { code: 'RULE', name: '规则提取' }
  ],

  /**
   * 从服务端加载文档分类，写入 R2.DOC_TYPES。
   * 返回 Promise<List>，供页面初始化调用。
   */
  async loadDocTypes() {
    const res = await this.get('/api/reits/doc-categories?pageNum=1&pageSize=1000') || {};
    const list = res.records || [];
    this.DOC_TYPES = list.map(c => ({ code: c.categoryCode, name: c.categoryName }));
    return this.DOC_TYPES;
  },
  TASK_STATUS: {
    PENDING: { text: '等待中', cls: 'tag-gray' },
    PROCESSING: { text: '执行中', cls: 'tag-blue' },
    SUCCESS: { text: '成功', cls: 'tag-green' },
    FAILED: { text: '失败', cls: 'tag-red' },
    SKIPPED: { text: '已跳过', cls: 'tag-orange' }
  },
  RUN_STATUS: {
    PENDING: { text: '等待中', cls: 'tag-gray' },
    RUNNING: { text: '运行中', cls: 'tag-blue' },
    COMPLETED: { text: '已完成', cls: 'tag-green' },
    FAILED: { text: '失败', cls: 'tag-red' }
  },

  // ── API 封装 ──
  async request(method, url, body) {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    };
    if (body !== undefined && body !== null) options.body = JSON.stringify(body);
    const fullUrl = url.startsWith('/') ? this.basePath() + url : url;
    let res;
    try {
      res = await fetch(fullUrl, options);
    } catch (e) {
      this.toast('网络异常：' + e.message, 'error');
      throw e;
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      this.toast('响应解析失败 (' + res.status + ')', 'error');
      throw new Error('响应解析失败');
    }
    if (json && typeof json.code !== 'undefined') {
      if (json.code === 200) return json.data;
      this.toast(json.message || '请求失败', 'error');
      throw new Error(json.message || '请求失败');
    }
    return json;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body); },
  put(url, body) { return this.request('PUT', url, body); },
  patch(url, body) { return this.request('PATCH', url, body); },
  del(url) { return this.request('DELETE', url); },

  // ── Toast ──
  toast(message, type) {
    let wrap = document.querySelector('.toast-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  },

  // ── 弹窗 ──
  openModal({ title, bodyHtml, onOk, okText, hideFooter, wide, extraWide }) {
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const modalCls = extraWide ? ' modal-xl' : (wide ? ' modal-lg' : '');
    mask.innerHTML =
      '<div class="modal' + modalCls + '">' +
      '  <div class="modal-header"><span></span><button class="modal-close">×</button>' +
      '  </div>' +
      '  <div class="modal-body"></div>' +
      '  <div class="modal-footer">' +
      '    <button class="btn btn-default" data-act="cancel">取消</button>' +
      '    <button class="btn btn-primary" data-act="ok"></button>' +
      '  </div>' +
      '</div>';
    mask.querySelector('.modal-header span').textContent = title || '';
    mask.querySelector('.modal-body').innerHTML = bodyHtml;
    if (hideFooter) {
      mask.querySelector('.modal-footer').style.display = 'none';
    }
    mask.querySelector('[data-act="ok"]').textContent = okText || '确定';
    const close = () => mask.remove();
    mask.querySelector('.modal-close').addEventListener('click', close);
    mask.querySelector('[data-act="cancel"]').addEventListener('click', close);
    mask.addEventListener('click', (e) => { if (e.target === mask) close(); });
    mask.querySelector('[data-act="ok"]').addEventListener('click', async () => {
      if (!onOk) { close(); return; }
      try {
        const result = await onOk(mask.querySelector('.modal-body'));
        if (result !== false) close();
      } catch (e) { /* onOk 内已提示 */ }
    });
    document.body.appendChild(mask);
    return mask;
  },

  confirm(message, onOk) {
    this.openModal({
      title: '确认操作',
      bodyHtml: '<div style="font-size:14px;color:var(--text-regular);">' + this.esc(message) + '</div>',
      okText: '确定',
      onOk: async () => { await onOk(); }
    });
  },

  // ── 导航 ──
  // 顶部导航条已废弃，统一由 admin-layout.js 侧边栏（Reits管理 二级菜单）接管。

  // ── 工具 ──
  query(name) {
    return new URLSearchParams(location.search).get(name);
  },
  esc(s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },
  dash(v) {
    return (v === null || v === undefined || v === '') ? '<span style="color:var(--text-disabled)">—</span>' : this.esc(v);
  },
  fmtDateTime(s) {
    if (!s) return '<span style="color:var(--text-disabled)">—</span>';
    const str = Array.isArray(s) ? this._arrToIso(s) : String(s);
    return this.esc(str.replace('T', ' ').substring(0, 19));
  },
  fmtDate(s) {
    if (!s) return '<span style="color:var(--text-disabled)">—</span>';
    const str = Array.isArray(s) ? this._arrToIso(s) : String(s);
    return this.esc(str.substring(0, 10));
  },
  _arrToIso(arr) {
    // 兼容 LocalDateTime 序列化为数组的情况 [y,M,d,H,m,s]
    const pad = (n) => String(n || 0).padStart(2, '0');
    return arr[0] + '-' + pad(arr[1]) + '-' + pad(arr[2]) + (arr.length > 3 ? 'T' + pad(arr[3]) + ':' + pad(arr[4]) + ':' + pad(arr[5]) : '');
  },
  fmtConfidence(v) {
    if (v === null || v === undefined) return '<span style="color:var(--text-disabled)">—</span>';
    return (Number(v) * 100).toFixed(1) + '%';
  },
  tag(mapObj, key) {
    const item = mapObj[key];
    if (!item) return '<span class="tag tag-gray">' + this.esc(key || '未知') + '</span>';
    return '<span class="tag ' + item.cls + '">' + item.text + '</span>';
  },
  loading(target, colspan) {
    if (typeof target === 'string') target = document.getElementById(target);
    if (target) target.innerHTML = '<div class="loading-block"><span class="spinner"></span>加载中...</div>';
  },
  tableLoading(tbody, colspan) {
    document.getElementById(tbody).innerHTML =
      '<tr><td colspan="' + colspan + '" class="table-empty"><span class="spinner"></span>加载中...</td></tr>';
  },
  tableEmpty(tbody, colspan, text) {
    document.getElementById(tbody).innerHTML =
      '<tr><td colspan="' + colspan + '" class="table-empty">' + (text || '暂无数据') + '</td></tr>';
  },

  // ── 悬浮提示（元素加 data-tip 属性即可） ──
  _tipEl: null,
  _tipHideTimer: null,
  _ensureTip() {
    if (!this._tipEl) {
      this._tipEl = document.createElement('div');
      this._tipEl.className = 'global-tip';
      this._tipEl.style.display = 'none';
      document.body.appendChild(this._tipEl);
    }
    return this._tipEl;
  },
  _showTip() {
    if (this._tipHideTimer) {
      clearTimeout(this._tipHideTimer);
      this._tipHideTimer = null;
    }
    if (this._tipEl) this._tipEl.style.display = 'block';
  },
  _scheduleHideTip(delay) {
    if (this._tipHideTimer) clearTimeout(this._tipHideTimer);
    this._tipHideTimer = setTimeout(() => {
      this._tipHideTimer = null;
      if (this._tipEl) this._tipEl.style.display = 'none';
    }, delay);
  },
  bindTips() {
    document.addEventListener('mouseover', (e) => {
      if (this._tipEl && (e.target === this._tipEl || this._tipEl.contains(e.target))) {
        this._showTip();
        return;
      }
      const target = e.target.closest('[data-tip]');
      if (!target) return;
      const tip = this._ensureTip();
      if (this._tipHideTimer) {
        clearTimeout(this._tipHideTimer);
        this._tipHideTimer = null;
      }
      tip.textContent = target.getAttribute('data-tip');
      tip.style.display = 'block';
      const rect = target.getBoundingClientRect();
      const tipRect = tip.getBoundingClientRect();
      let left = rect.left;
      if (left + tipRect.width > window.innerWidth - 16) {
        left = Math.max(16, window.innerWidth - 16 - tipRect.width);
      }
      let top = rect.bottom + 6;
      if (top + tipRect.height > window.innerHeight - 8) {
        top = Math.max(8, rect.top - tipRect.height - 6);
      }
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    });
    document.addEventListener('mouseout', (e) => {
      if (!this._tipEl) return;
      const fromTip = e.target === this._tipEl || this._tipEl.contains(e.target);
      const fromTrigger = e.target.closest && e.target.closest('[data-tip]');
      if (!fromTip && !fromTrigger) return;
      const to = e.relatedTarget;
      if (to && (to === this._tipEl || this._tipEl.contains(to) || (to.closest && to.closest('[data-tip]')))) return;
      this._scheduleHideTip(200);
    });
    document.addEventListener('scroll', (e) => {
      if (!this._tipEl) return;
      if (e.target === this._tipEl || this._tipEl.contains(e.target)) return;
      this._scheduleHideTip(0);
    }, true);
    // 带悬浮提示的下拉框（select）展开原生选项列表前需先隐藏提示，否则提示层会遮挡选项
    const hideTipForSelect = (e) => {
      if (!this._tipEl || this._tipEl.style.display === 'none') return;
      const target = e.target && e.target.closest ? e.target.closest('select[data-tip]') : null;
      if (target) this._scheduleHideTip(0);
    };
    document.addEventListener('mousedown', hideTipForSelect, true);
    document.addEventListener('focusin', hideTipForSelect, true);
  }
};

R2.bindTips();

window.R2 = R2;

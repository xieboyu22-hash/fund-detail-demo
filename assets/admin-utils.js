/**
 * admin-utils.js
 * 职责：通用工具函数
 */
const Utils = {
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  },

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  },

  formatDate(timestamp, format = 'yyyy-MM-dd HH:mm') {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    const map = {
      'yyyy': date.getFullYear(),
      'MM': pad(date.getMonth() + 1),
      'dd': pad(date.getDate()),
      'HH': pad(date.getHours()),
      'mm': pad(date.getMinutes()),
      'ss': pad(date.getSeconds())
    };
    return format.replace(/yyyy|MM|dd|HH|mm|ss/g, match => map[match]);
  },

  formatTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    return this.formatDate(timestamp, 'yyyy-MM-dd HH:mm');
  },

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatJson(obj, indent = 2) {
    try {
      return JSON.stringify(obj, null, indent);
    } catch (e) {
      return String(obj);
    }
  },

  tryParseJson(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },

  debounce(fn, delay = 300) {
    let timer = null;
    return function(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  throttle(fn, limit = 300) {
    let inThrottle = false;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },

  getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
  },

  setQueryParam(name, value) {
    const url = new URL(window.location.href);
    if (value === null || value === undefined) {
      url.searchParams.delete(name);
    } else {
      url.searchParams.set(name, value);
    }
    window.history.replaceState({}, '', url.toString());
  }
};

window.Utils = Utils;

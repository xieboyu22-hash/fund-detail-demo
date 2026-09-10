/**
 * admin-api.js
 * 职责：统一 HTTP 请求封装，自动注入 Token、错误处理、Loading 计数
 */
const Api = {
  loadingCount: 0,

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    const token = App.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async request(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase();
    const fullUrl = url.startsWith('http') ? url : `${App.config.API_BASE}${url.startsWith('/') ? url : '/' + url}`;

    const fetchOptions = {
      method,
      headers: Object.assign(this.getHeaders(), options.headers || {})
    };

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)) {
      fetchOptions.body = JSON.stringify(options.body);
    } else if (options.body) {
      fetchOptions.body = options.body;
    }

    if (options.silent !== true) {
      this.showLoading();
    }

    try {
      const response = await fetch(fullUrl, fetchOptions);
      
      if (response.status === 401) {
        Components.toast('登录已过期，请重新登录', 'error');
        App.logout();
        return Promise.reject(new Error('Unauthorized'));
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        let message = `请求失败 (${response.status})`;
        try {
          const errorJson = JSON.parse(errorText);
          message = errorJson.message || errorJson.error || message;
        } catch (e) {}
        throw new Error(message);
      }
      
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      
      return await response.text();
    } catch (error) {
      if (options.silent !== true) {
        Components.toast(error.message || '网络异常', 'error');
      }
      throw error;
    } finally {
      if (options.silent !== true) {
        this.hideLoading();
      }
    }
  },

  get(url, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    const fullUrl = query ? `${url}?${query}` : url;
    return this.request(fullUrl, { ...options, method: 'GET' });
  },

  post(url, body = {}, options = {}) {
    return this.request(url, { ...options, method: 'POST', body });
  },

  put(url, body = {}, options = {}) {
    return this.request(url, { ...options, method: 'PUT', body });
  },

  del(url, options = {}) {
    return this.request(url, { ...options, method: 'DELETE' });
  },

  showLoading() {
    this.loadingCount++;
    const overlay = document.getElementById('global-loading');
    if (overlay) {
      overlay.classList.add('show');
    }
  },

  hideLoading() {
    this.loadingCount = Math.max(0, this.loadingCount - 1);
    if (this.loadingCount === 0) {
      const overlay = document.getElementById('global-loading');
      if (overlay) {
        overlay.classList.remove('show');
      }
    }
  }
};

window.Api = Api;

/**
 * admin-core.js
 * 职责：认证状态、全局状态、主题、侧边栏、页面守卫、初始化入口
 */
// 应用可能部署在子路径下（如网关 /asset-cloud-uat/open-agent/），根据当前页面位置推导应用根路径
// 本地开发（/pages/chat.html、/login.html）推导结果为空字符串，行为与原来一致
const _pathname = window.location.pathname;
const _basePath = _pathname.includes('/pages/')
  ? _pathname.slice(0, _pathname.indexOf('/pages/'))
  : _pathname.slice(0, _pathname.lastIndexOf('/'));

const APP_CONFIG = {
  TOKEN_KEY: 'ai_admin_token',
  USER_KEY: 'ai_admin_user',
  THEME_KEY: 'ai_admin_theme',
  SIDEBAR_KEY: 'ai_admin_sidebar_collapsed',
  BASE_PATH: _basePath,
  API_BASE: _basePath + '/api'
};

const App = {
  config: APP_CONFIG,

  state: {
    token: null,
    user: null,
    theme: 'light',
    sidebarCollapsed: false
  },

  init() {
    this.loadState();
    this.applyTheme();
    this.applySidebar();
    return this.checkAuth();
  },

  loadState() {
    this.state.token = localStorage.getItem(APP_CONFIG.TOKEN_KEY) || null;
    const userStr = localStorage.getItem(APP_CONFIG.USER_KEY);
    this.state.user = userStr ? this.safeParse(userStr) : null;
    this.state.theme = localStorage.getItem(APP_CONFIG.THEME_KEY) || 'light';
    this.state.sidebarCollapsed = localStorage.getItem(APP_CONFIG.SIDEBAR_KEY) === 'true';
  },

  safeParse(str) {
    try {
      return JSON.parse(str);
    } catch (e) {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.state.token && !!this.state.user;
  },

  login(token, user) {
    localStorage.setItem(APP_CONFIG.TOKEN_KEY, token);
    localStorage.setItem(APP_CONFIG.USER_KEY, JSON.stringify(user));
    this.state.token = token;
    this.state.user = user;
  },

  logout() {
    localStorage.removeItem(APP_CONFIG.TOKEN_KEY);
    localStorage.removeItem(APP_CONFIG.USER_KEY);
    this.state.token = null;
    this.state.user = null;
    window.location.href = APP_CONFIG.BASE_PATH + '/login.html';
  },

  getToken() {
    return this.state.token;
  },

  getUser() {
    return this.state.user;
  },

  setTheme(theme) {
    this.state.theme = theme;
    localStorage.setItem(APP_CONFIG.THEME_KEY, theme);
    this.applyTheme();
  },

  toggleTheme() {
    this.setTheme(this.state.theme === 'dark' ? 'light' : 'dark');
  },

  applyTheme() {
    if (!document.body) return;
    document.body.classList.toggle('dark-theme', this.state.theme === 'dark');
  },

  setSidebarCollapsed(collapsed) {
    this.state.sidebarCollapsed = collapsed;
    localStorage.setItem(APP_CONFIG.SIDEBAR_KEY, String(collapsed));
    this.applySidebar();
  },

  toggleSidebar() {
    this.setSidebarCollapsed(!this.state.sidebarCollapsed);
  },

  applySidebar() {
    const sidebar = document.querySelector('.admin-sidebar');
    if (sidebar) {
      sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
    }
  },

  checkAuth() {
    const pathname = window.location.pathname;
    const isLoginPage = pathname.endsWith('/login.html') ||
                        pathname.endsWith('/login') ||
                        pathname.endsWith('/');
    
    // 未登录时自动 mock 登录，无需跳转登录页
    if (!this.isLoggedIn()) {
      this.login('auto-mock-token', {username:'admin', name:'admin', role:'admin'});
    }
    
    if (this.isLoggedIn() && isLoginPage) {
      window.location.href = APP_CONFIG.BASE_PATH + '/pages/dashboard.html';
      return false;
    }
    
    return true;
  }
};

window.APP_CONFIG = APP_CONFIG;
window.App = App;

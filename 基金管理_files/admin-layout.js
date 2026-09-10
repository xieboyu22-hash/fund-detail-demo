/**
 * 布局初始化脚本 - AMS-FE 风格
 * 复刻 ams-fe/src/views/Layout.vue：左侧胶囊菜单 + 顶部 Header（面包屑 + 用户）。
 *
 * 页面接入方式：
 * <div id="app" data-active-menu="reits-funds">
 *   ... 页面内容 ...
 * </div>
 * <script src=".../assets/js/admin-layout.js"></script>
 *
 * 可选属性：
 *   data-active-menu  当前菜单 id（缺省时按 URL 推断）
 *   data-breadcrumbs  JSON 数组覆盖自动面包屑
 *   data-layout       "plain" 时不给内容套白卡（如对话页）
 *
 * SPA 行为：
 *   脚本会自动拦截站内 <a> 链接，通过 AJAX 拉取新页面内容并仅替换
 *   面包屑 + 内容区，侧边栏/Header 保持不变，浏览器窗口不再整体刷新。
 *   同时监听 popstate，支持浏览器前进/后退。
 */
(function () {
  "use strict";

  function inferBasePath() {
    if (window.APP_CONFIG && typeof window.APP_CONFIG.BASE_PATH !== "undefined") {
      return window.APP_CONFIG.BASE_PATH;
    }
    const p = window.location.pathname;
    if (p.includes("/pages/")) {
      return p.slice(0, p.indexOf("/pages/"));
    }
    return p.slice(0, p.lastIndexOf("/"));
  }

  const BASE = inferBasePath();

  // 所有 admin 页面共用的基础样式，SPA 切换时不会被卸载
  const BASE_STYLES = [
    "/assets/vendor/fontawesome/all.min.css",
    "/assets/css/admin-vars.css",
    "/assets/css/admin-layout.css",
    "/assets/css/admin-components.css",
  ];

  const menuItems = [
    { id: "dashboard", title: "首页", icon: "fa-house", path: "/pages/dashboard.html" },
    { id: "chat", title: "AI 智能对话", icon: "fa-comments", path: "/pages/chat.html" },
    {
      id: "reits-overview",
      title: "市场发行概览",
      icon: "fa-chart-pie",
      path: "/pages/reits/funds.html",
      match: ["fund-detail.html", "fund-edit.html", "fund-indicator.html"],
    },
    {
      id: "reits-mgmt",
      title: "Reits管理",
      icon: "fa-city",
      children: [
        { id: "reits-indicator-groups", title: "指标分组", icon: "fa-layer-group", path: "/pages/reits/indicator-groups.html" },
        { id: "reits-indicator-defs", title: "指标定义", icon: "fa-sliders", path: "/pages/reits/indicator-defs.html", match: ["indicator-def-detail.html"] },
        { id: "reits-prompt-templates", title: "提示词模板", icon: "fa-comment-dots", path: "/pages/reits/prompt-templates.html" },
        { id: "reits-doc-categories", title: "文档分类", icon: "fa-folder-tree", path: "/pages/reits/doc-categories.html" },
        { id: "reits-raw-documents", title: "原始文档", icon: "fa-file-lines", path: "/pages/reits/raw-documents.html" },
      ],
    },
    {
      id: "ops-data-mgmt",
      title: "经营数据管理",
      icon: "fa-chart-line",
      children: [
        { id: "ops-metrics", title: "指标定义", icon: "fa-sliders", path: "/pages/ops/ops-metrics.html", match: ["ops-metric-detail.html"] },
        { id: "ops-metric-explore", title: "指标查询", icon: "fa-table-cells", path: "/pages/ops/ops-metric-explore.html" },
        { id: "ops-dimensions", title: "维度管理", icon: "fa-layer-group", path: "/pages/ops/ops-dimensions.html", match: ["ops-dimension-metrics.html"] },
        { id: "ops-es-meta", title: "ES管理", icon: "fa-database", path: "/pages/ops/ops-es-meta.html" },
        { id: "ops-sync-monitor", title: "同步监控", icon: "fa-rotate", path: "/pages/ops/ops-sync-monitor.html" },
      ],
    },
    {
      id: "system-mgmt",
      title: "系统管理",
      icon: "fa-gear",
      children: [
        { id: "system-data-dic", title: "数据字典", icon: "fa-book", path: "/pages/system/data-dic.html" },
      ],
    },
  ];

  function resolveUrl(url, base) {
    if (!url) return url;
    if (/^([a-z][a-z0-9+.-]*:)?\/\//i.test(url)) return url;
    base = base || window.location.href;
    try {
      return new URL(url, base).href;
    } catch (e) {
      return url;
    }
  }

  function normalizeStyleUrl(href) {
    try {
      const url = new URL(href, window.location.href);
      return url.origin + url.pathname + url.search;
    } catch (e) {
      return href;
    }
  }

  function isBaseStyle(href) {
    // 兼容 Nginx 子路径部署：只比较 pathname 后缀，忽略 origin 和 query
    let pathname;
    try {
      pathname = new URL(href, window.location.href).pathname;
    } catch (e) {
      pathname = href;
    }
    return BASE_STYLES.some(function (base) {
      return pathname === base || pathname.endsWith(base);
    });
  }

  function findStyleLink(href) {
    const target = normalizeStyleUrl(href);
    const links = document.querySelectorAll('link[rel="stylesheet"]');
    for (let i = 0; i < links.length; i++) {
      if (normalizeStyleUrl(links[i].href) === target) return links[i];
    }
    return null;
  }

  function markInitialStyles() {
    document.querySelectorAll('link[rel="stylesheet"]').forEach(function (link) {
      if (link.hasAttribute("data-admin-spa")) return;
      const flag = isBaseStyle(link.href) ? "base" : "page";
      link.setAttribute("data-admin-spa", flag);
    });
    // 初始页面的内联样式也纳入生命周期管理，切换时会被清理
    document.querySelectorAll("head > style").forEach(function (style) {
      if (style.hasAttribute("data-admin-spa")) return;
      style.setAttribute("data-admin-spa", "page-style");
    });
  }

  function inferActiveMenuId(sourceDoc) {
    sourceDoc = sourceDoc || document;
    const el = sourceDoc.querySelector("[data-active-menu]");
    if (el) return el.getAttribute("data-active-menu");
    const path = window.location.pathname;
    for (const item of menuItems) {
      if (item.path && path.endsWith(item.path)) return item.id;
      if (item.match && item.match.some((m) => path.endsWith(m))) return item.id;
      if (item.children) {
        for (const child of item.children) {
          if (child.path && path.endsWith(child.path)) return child.id;
          if (child.match && child.match.some((m) => path.endsWith(m))) return child.id;
        }
      }
    }
    return "";
  }

  function findMenuPath(id) {
    for (const item of menuItems) {
      if (item.id === id) return [item];
      if (item.children) {
        for (const child of item.children) {
          if (child.id === id) return [item, child];
        }
      }
    }
    return [];
  }

  function buildSidebar(activeId, collapsed) {
    const sidebar = document.createElement("aside");
    sidebar.className = "admin-sidebar" + (collapsed ? " collapsed" : "");
    sidebar.id = "adminSidebar";

    const brand = document.createElement("a");
    brand.className = "menu-brand";
    brand.href = BASE + "/pages/dashboard.html";
    brand.innerHTML =
      '<span class="brand-logo"><img src="' + BASE + '/assets/img/logo.png" alt="logo"></span>' +
      '<span class="brand-name">资管云 Agent</span>';
    sidebar.appendChild(brand);

    const ul = document.createElement("ul");
    ul.className = "admin-menu";

    menuItems.forEach((item) => {
      const li = document.createElement("li");
      const hasChildren = Array.isArray(item.children) && item.children.length > 0;

      if (hasChildren) {
        const childActive = item.children.some((c) => c.id === activeId);
        li.className = childActive ? "open parent-active" : "";

        const parent = document.createElement("a");
        parent.className = "menu-item";
        parent.dataset.menuId = item.id;
        parent.innerHTML =
          '<i class="fas ' + item.icon + ' menu-icon"></i>' +
          "<span>" + item.title + "</span>" +
          '<i class="fas fa-chevron-down menu-chevron"></i>';
        parent.addEventListener("click", function () {
          li.classList.toggle("open");
        });
        li.appendChild(parent);

        const sub = document.createElement("ul");
        sub.className = "admin-submenu";
        item.children.forEach((child) => {
          const subLi = document.createElement("li");
          const a = document.createElement("a");
          a.className = "menu-item" + (child.id === activeId ? " active" : "");
          a.dataset.menuId = child.id;
          a.href = BASE + child.path;
          a.innerHTML = "<span>" + child.title + "</span>";
          subLi.appendChild(a);
          sub.appendChild(subLi);
        });
        li.appendChild(sub);
      } else {
        const a = document.createElement("a");
        a.className = "menu-item" + (item.id === activeId ? " active" : "");
        a.dataset.menuId = item.id;
        a.href = BASE + item.path;
        a.innerHTML =
          '<i class="fas ' + item.icon + ' menu-icon"></i><span>' + item.title + "</span>";
        li.appendChild(a);
      }

      ul.appendChild(li);
    });

    sidebar.appendChild(ul);

    const fold = document.createElement("div");
    fold.className = "menu-fold";
    fold.innerHTML = '<i class="fas fa-angles-left"></i>';
    fold.title = "收起菜单";
    fold.addEventListener("click", function () {
      const isCollapsed = sidebar.classList.toggle("collapsed");
      fold.innerHTML = isCollapsed
        ? '<i class="fas fa-angles-right"></i>'
        : '<i class="fas fa-angles-left"></i>';
      try {
        localStorage.setItem("admin_sidebar_collapsed", isCollapsed ? "1" : "0");
      } catch (e) {}
    });
    sidebar.appendChild(fold);

    return sidebar;
  }

  function buildBreadcrumb(activeId, sourceDoc) {
    sourceDoc = sourceDoc || document;
    const nav = document.createElement("nav");
    nav.className = "admin-breadcrumb";

    let list = null;
    const el = sourceDoc.querySelector("[data-breadcrumbs]");
    if (el) {
      try {
        list = JSON.parse(el.getAttribute("data-breadcrumbs"));
      } catch (e) {}
    }

    if (!list) {
      list = [{ name: "首页", href: BASE + "/pages/dashboard.html" }];
      const path = findMenuPath(activeId);
      path.forEach((item, idx) => {
        if (item.id === "dashboard") return;
        const isLast = idx === path.length - 1;
        list.push({ name: item.title, href: isLast ? null : BASE + (item.path || "") });
      });
      if (list.length === 1) list[0].href = null;
    }

    list.forEach((item, index) => {
      if (index > 0) {
        const sep = document.createElement("span");
        sep.className = "separator";
        sep.textContent = "/";
        nav.appendChild(sep);
      }
      if (item.href && index < list.length - 1) {
        const a = document.createElement("a");
        a.href = item.href;
        a.textContent = item.name;
        nav.appendChild(a);
      } else {
        const span = document.createElement("span");
        span.className = "current";
        span.textContent = item.name;
        nav.appendChild(span);
      }
    });

    return nav;
  }

  function buildUserArea() {
    const wrap = document.createElement("div");
    wrap.className = "header-user";

    const user = window.App && App.getUser ? App.getUser() : null;
    const name = (user && user.name) || "管理员";
    const initial = name.charAt(0).toUpperCase();

    wrap.innerHTML =
      '<span class="user-avatar">' + initial + "</span>" +
      '<span class="user-name">' + name + "</span>" +
      '<i class="fas fa-chevron-down user-chevron"></i>' +
      '<div class="user-dropdown">' +
      '  <div class="dropdown-item" id="logoutItem"><i class="fas fa-right-from-bracket"></i>退出登录</div>' +
      "</div>";

    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
      wrap.querySelector(".user-dropdown").classList.toggle("show");
    });
    document.addEventListener("click", function () {
      wrap.querySelector(".user-dropdown").classList.remove("show");
    });
    wrap.querySelector("#logoutItem").addEventListener("click", function () {
      const doLogout = function () {
        if (window.App && App.logout) App.logout();
        else window.location.href = BASE + "/login.html";
      };
      if (window.Components && Components.confirm) {
        Components.confirm("确定退出登录吗？", doLogout);
      } else if (window.confirm("确定退出登录吗？")) {
        doLogout();
      }
    });

    return wrap;
  }

  // ── SPA 路由辅助函数 ──

  function isScriptLoaded(src) {
    return Array.from(document.querySelectorAll("script")).some(function (s) {
      if (!s.hasAttribute("src")) return false;
      return resolveUrl(s.getAttribute("src"), window.location.href) === src;
    });
  }

  function isStyleLoaded(href) {
    return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(function (l) {
      return resolveUrl(l.getAttribute("href"), window.location.href) === href;
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadPageStyles(doc, pageUrl) {
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    const newHrefs = new Set();
    const loadPromises = [];

    // 1) 收集新页面所需样式并加载缺失的
    links.forEach(function (link) {
      const hrefAttr = link.getAttribute("href");
      if (!hrefAttr) return;
      const href = resolveUrl(hrefAttr, pageUrl);
      const normalized = normalizeStyleUrl(href);
      newHrefs.add(normalized);

      const existing = findStyleLink(href);
      if (existing) {
        // 已存在：更新生命周期标记（基础样式保持 base，其余标记为当前页面占用）
        if (!isBaseStyle(href)) {
          existing.setAttribute("data-admin-spa", "page");
        }
        return;
      }

      const l = document.createElement("link");
      l.rel = "stylesheet";
      l.href = href;
      l.setAttribute("data-admin-spa", isBaseStyle(href) ? "base" : "page");
      document.head.appendChild(l);

      loadPromises.push(
        new Promise(function (resolve) {
          l.onload = resolve;
          l.onerror = resolve; // 加载失败也不阻塞页面渲染
        })
      );
    });

    // 2) 卸载旧页面专属样式（不在新页面样式列表中且不是基础样式）
    document.querySelectorAll('link[rel="stylesheet"][data-admin-spa="page"]').forEach(function (link) {
      const normalized = normalizeStyleUrl(link.href);
      if (!newHrefs.has(normalized)) {
        link.remove();
      }
    });

    // 3) 迁移新页面 <head> 中的内联 <style>，并清理旧页面的内联样式
    //    （页面直接访问时 head 里的 style 生效；SPA 切换时不会自动带入，需要手动同步）
    document.querySelectorAll('style[data-admin-spa="page-style"]').forEach(function (s) {
      s.remove();
    });
    const inlineStyles = Array.from(doc.querySelectorAll("head > style"));
    inlineStyles.forEach(function (style) {
      const s = document.createElement("style");
      s.textContent = style.textContent;
      s.setAttribute("data-admin-spa", "page-style");
      document.head.appendChild(s);
    });

    return Promise.all(loadPromises);
  }

  async function executePageScripts(doc, pageUrl) {
    const scripts = Array.from(doc.querySelectorAll("script"));
    for (const old of scripts) {
      if (old.hasAttribute("src")) {
        const srcAttr = old.getAttribute("src");
        const src = resolveUrl(srcAttr, pageUrl);
        if (src.indexOf("admin-layout.js") !== -1) continue;
        if (isScriptLoaded(src)) continue;
        await loadScript(src);
      } else {
        const s = document.createElement("script");
        if (old.type) s.type = old.type;
        s.textContent = old.textContent;
        document.head.appendChild(s);
        document.head.removeChild(s);
      }
    }
    // 部分页面脚本（如 chat）在 DOMContentLoaded 中初始化，
    // SPA 替换时该事件早已触发，需要手动补发一次以驱动页面初始化。
    if (document.readyState !== "loading") {
      document.dispatchEvent(new Event("DOMContentLoaded", { bubbles: true, cancelable: true }));
    }
  }

  function updateSidebarActive(activeId) {
    const sidebar = document.getElementById("adminSidebar");
    if (!sidebar) return;

    sidebar.querySelectorAll(".menu-item.active").forEach(function (a) {
      a.classList.remove("active");
    });
    sidebar.querySelectorAll("li.open, li.parent-active").forEach(function (li) {
      li.classList.remove("open", "parent-active");
    });

    if (!activeId) return;
    const target = sidebar.querySelector('a.menu-item[data-menu-id="' + activeId + '"]');
    if (!target) return;

    target.classList.add("active");
    const subLi = target.closest("li");
    const parentLi = subLi && subLi.parentElement ? subLi.parentElement.closest("li") : null;
    if (parentLi) {
      parentLi.classList.add("open", "parent-active");
    }
  }

  function replaceContent(doc) {
    const app = document.getElementById("app");
    const newApp = doc.getElementById("app");
    if (!newApp || !app) return false;

    // 同步新页面 #app 上的 class（如 sticky-actions-page 等页面级布局类）。
    // 否则以 #app class 为祖先条件的页面内联样式在 SPA 进入时会全部失配，
    // 且旧页面的 class 会残留影响后续页面。保留框架自身添加的 admin-app。
    Array.from(app.classList).forEach(function (c) {
      if (c !== "admin-app") app.classList.remove(c);
    });
    (newApp.getAttribute("class") || "").split(/\s+/).forEach(function (c) {
      if (c && c !== "admin-app") app.classList.add(c);
    });

    const activeId = newApp.getAttribute("data-active-menu") || inferActiveMenuId(doc);
    const plain = newApp.getAttribute("data-layout") === "plain";

    // 1. 更新面包屑
    const header = app.querySelector(".admin-header");
    if (header) {
      const oldNav = header.querySelector(".admin-breadcrumb");
      const userArea = header.querySelector(".header-user");
      const newNav = buildBreadcrumb(activeId, doc);
      if (oldNav) {
        header.replaceChild(newNav, oldNav);
      } else if (userArea) {
        header.insertBefore(newNav, userArea);
      } else {
        header.appendChild(newNav);
      }
    }

    // 2. 更新菜单高亮
    updateSidebarActive(activeId);

    // 3. 替换内容区（保留与 initLayout 一致的包装逻辑）
    const content = app.querySelector(".admin-content");
    if (!content) return false;
    content.innerHTML = "";

    const newChildren = Array.from(newApp.childNodes);
    const elementChildren = newChildren.filter(
      (n) => n.nodeType === 1 && n.tagName !== "SCRIPT"
    );
    const hasOwnCard =
      elementChildren.length === 1 &&
      (elementChildren[0].classList.contains("admin-page") ||
        elementChildren[0].classList.contains("page-container") ||
        elementChildren[0].classList.contains("chat-page-wrapper"));

    let body = content;
    if (!plain && !hasOwnCard) {
      const card = document.createElement("div");
      card.className = "admin-page";
      content.appendChild(card);
      body = card;
    }

    newChildren.forEach(function (child) {
      if (child.nodeType === 1 && child.tagName === "SCRIPT") return;
      body.appendChild(document.importNode(child, true));
    });

    return activeId;
  }

  function shouldHandleLink(a) {
    if (!a || a.tagName !== "A") return false;
    if (a.dataset && a.dataset.spa === "false") return false;
    if (a.target && a.target !== "_self") return false;
    if (a.hasAttribute("download")) return false;

    const href = a.getAttribute("href");
    if (!href || href.charAt(0) === "#" || href.indexOf("javascript:") === 0) return false;

    const url = resolveUrl(href, window.location.href);
    if (!url) return false;

    try {
      const parsed = new URL(url);
      if (parsed.origin !== window.location.origin) return false;
      if (!parsed.pathname.endsWith(".html")) return false;
      return parsed.href;
    } catch (e) {
      return false;
    }
  }

  async function navigate(pageUrl, pushState) {
    pushState = pushState !== false;
    try {
      // no-cache：每次都向服务器 revalidate（未变则 304），避免 SPA 拿到旧版缓存 HTML
      // 导致页面内联样式/结构缺失（如 indicator-def-detail 底部操作栏样式错乱）
      const res = await fetch(pageUrl, { cache: "no-cache", headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");

      // 加载新页面样式并卸载旧页面专属样式，等待样式就绪后再渲染
      await loadPageStyles(doc, pageUrl);

      // 替换内容
      const activeId = replaceContent(doc);

      // 先更新地址栏，再执行新页面脚本；否则脚本里 R2.query('id') 读取的是旧 URL 参数
      if (pushState) {
        window.history.pushState({ adminSpaUrl: pageUrl }, "", pageUrl);
      }

      // 执行新页面的脚本
      await executePageScripts(doc, pageUrl);

      // 更新标题
      const title = doc.querySelector("title");
      if (title) document.title = title.textContent;

      // 触发页面初始化脚本
      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent("adminSpa:load", { detail: { url: pageUrl, activeId: activeId } }));
      }
    } catch (err) {
      console.error("[admin-layout] SPA 跳转失败，回退到整页刷新", err);
      window.location.href = pageUrl;
    }
  }

  function onLinkClick(e) {
    const a = e.target.closest && e.target.closest("a");
    const pageUrl = shouldHandleLink(a);
    if (!pageUrl) return;

    e.preventDefault();
    navigate(pageUrl, true);
  }

  function initSpaRouting() {
    document.removeEventListener("click", onLinkClick);
    document.addEventListener("click", onLinkClick);

    window.addEventListener("popstate", function (e) {
      if (e.state && e.state.adminSpaUrl) {
        navigate(e.state.adminSpaUrl, false);
      } else {
        // 兜底：没有 state 时刷新当前页
        window.location.reload();
      }
    });
  }

  // ── 原初始化逻辑 ──

  function initLayout() {
    const app = document.getElementById("app");
    if (!app || app.dataset.layoutReady) return;
    app.dataset.layoutReady = "1";

    // 标记页面初始加载的样式，便于 SPA 切换时区分基础样式与页面专属样式
    markInitialStyles();

    const activeId = inferActiveMenuId();
    const plain = app.getAttribute("data-layout") === "plain";

    let collapsed = false;
    try {
      collapsed = localStorage.getItem("admin_sidebar_collapsed") === "1";
    } catch (e) {}

    const originalChildren = Array.from(app.childNodes);

    const sidebar = buildSidebar(activeId, collapsed);

    const header = document.createElement("header");
    header.className = "admin-header";
    header.appendChild(buildBreadcrumb(activeId));
    header.appendChild(buildUserArea());

    const content = document.createElement("main");
    content.className = "admin-content";

    // 若页面自身已带白卡容器（.admin-page / .page-container）或声明 plain，则不再套卡
    const elementChildren = originalChildren.filter(
      (n) => n.nodeType === 1 && !(n.tagName === "SCRIPT")
    );
    const hasOwnCard =
      elementChildren.length === 1 &&
      (elementChildren[0].classList.contains("admin-page") ||
        elementChildren[0].classList.contains("page-container") ||
        elementChildren[0].classList.contains("chat-page-wrapper"));

    let body = content;
    if (!plain && !hasOwnCard) {
      const card = document.createElement("div");
      card.className = "admin-page";
      content.appendChild(card);
      body = card;
    }

    originalChildren.forEach((child) => body.appendChild(child));

    const main = document.createElement("div");
    main.className = "admin-main";
    main.appendChild(header);
    main.appendChild(content);

    app.innerHTML = "";
    app.classList.add("admin-app");
    app.appendChild(sidebar);
    app.appendChild(main);

    // 初始化 SPA 路由
    initSpaRouting();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initLayout);
  } else {
    initLayout();
  }
})();

/**
 * admin-components.js
 * 职责：通用 UI 组件：Toast、Modal、Confirm、Loading 骨架
 */
const Components = {
  toastContainer: null,

  ensureToastContainer() {
    if (!this.toastContainer) {
      this.toastContainer = document.createElement('div');
      this.toastContainer.className = 'toast-container';
      document.body.appendChild(this.toastContainer);
    }
    return this.toastContainer;
  },

  toast(message, type = 'info', options = {}) {
    const container = this.ensureToastContainer();
    const duration = options.duration || 3000;
    const title = options.title || '';

    const icons = {
      success: 'fa-check-circle',
      warning: 'fa-exclamation-circle',
      error: 'fa-times-circle',
      info: 'fa-info-circle'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <i class="fas ${icons[type] || icons.info}"></i>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${Utils.escapeHtml(title)}</div>` : ''}
        <div>${Utils.escapeHtml(message)}</div>
      </div>
      <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => {
      this.removeToast(toast);
    });

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => this.removeToast(toast), duration);
    }

    return toast;
  },

  removeToast(toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 250);
  },

  modal(options) {
    const title = options.title || '提示';
    const content = options.content || '';
    const showCancel = options.showCancel !== false;
    const cancelText = options.cancelText || '取消';
    const confirmText = options.confirmText || '确定';
    const onConfirm = options.onConfirm || (() => {});
    const onCancel = options.onCancel || (() => {});

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h3 class="modal-title">${Utils.escapeHtml(title)}</h3>
          <button class="modal-close"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">${content}</div>
        <div class="modal-footer">
          ${showCancel ? `<button class="btn btn-default modal-cancel">${Utils.escapeHtml(cancelText)}</button>` : ''}
          <button class="btn btn-primary modal-confirm">${Utils.escapeHtml(confirmText)}</button>
        </div>
      </div>
    `;

    const closeModal = () => {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentElement) {
          overlay.parentElement.removeChild(overlay);
        }
      }, 200);
    };

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        onCancel();
        closeModal();
      }
    });

    overlay.querySelector('.modal-close').addEventListener('click', () => {
      onCancel();
      closeModal();
    });

    if (showCancel) {
      overlay.querySelector('.modal-cancel').addEventListener('click', () => {
        onCancel();
        closeModal();
      });
    }

    overlay.querySelector('.modal-confirm').addEventListener('click', () => {
      onConfirm();
      closeModal();
    });

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    return {
      close: closeModal
    };
  },

  confirm(message, onConfirm, options = {}) {
    return this.modal({
      title: options.title || '确认操作',
      content: `<p>${Utils.escapeHtml(message)}</p>`,
      confirmText: options.confirmText || '确定',
      cancelText: options.cancelText || '取消',
      onConfirm,
      onCancel: options.onCancel || (() => {})
    });
  },

  loading(message = '加载中...') {
    let overlay = document.getElementById('global-loading');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'global-loading';
      overlay.className = 'loading-overlay';
      overlay.innerHTML = `
        <div class="loading-content" style="text-align: center;">
          <div class="loading-spinner"></div>
          <div class="loading-text" style="margin-top: 12px; color: var(--text-secondary);">${Utils.escapeHtml(message)}</div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      overlay.querySelector('.loading-text').textContent = message;
    }
    return {
      show: () => overlay.classList.add('show'),
      hide: () => overlay.classList.remove('show')
    };
  },

  /**
   * 通用分页渲染（Element Plus 风格）
   * @param {string|HTMLElement} container 容器 id 或元素
   * @param {Object} opts
   *   total        总条数
   *   page         当前页（从1开始）
   *   pageSize     每页条数
   *   pageSizes    每页条数选项，默认 [10,20,50]
   *   showTotal    是否显示“共 X 条”，默认 true
   *   showSize     是否显示“X条/页”选择器，默认 true
   *   showJumper   是否显示“前往 X 页”，默认 true
   *   onChange(page)      页码变化回调
   *   onSizeChange(size)  每页条数变化回调
   */
  renderPager(container, opts = {}) {
    const el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;

    const total = parseInt(opts.total || 0, 10);
    const page = parseInt(opts.page || 1, 10);
    const pageSize = parseInt(opts.pageSize || 10, 10);
    const pageSizes = opts.pageSizes || [10, 20, 50];
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    if (total <= 0 || (totalPages <= 1 && opts.showSize === false)) {
      el.innerHTML = '';
      return;
    }

    const showTotal = opts.showTotal !== false;
    const showSize = opts.showSize !== false;
    const showJumper = opts.showJumper !== false;

    let html = '<div class="pagination">';

    if (showTotal) {
      html += `<span class="total-info">共 ${total} 条</span>`;
    }

    if (showSize) {
      html += '<span class="page-sizes"><select class="select" onchange="Components._pagerSizeChange(this)">';
      pageSizes.forEach(ps => {
        html += `<option value="${ps}"${ps === pageSize ? ' selected' : ''}>${ps}条/页</option>`;
      });
      html += '</select></span>';
    }

    html += `<button class="page-btn nav" onclick="Components._pagerGo(this, ${page - 1})"${page <= 1 ? ' disabled' : ''}><i class="fas fa-chevron-left"></i></button>`;

    const pages = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 4) pages.push('...');
      let start = Math.max(2, page - 2);
      let end = Math.min(totalPages - 1, page + 2);
      if (page <= 4) { start = 2; end = Math.min(5, totalPages - 1); }
      else if (page >= totalPages - 3) { start = Math.max(2, totalPages - 4); end = totalPages - 1; }
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 3) pages.push('...');
      pages.push(totalPages);
    }

    pages.forEach(p => {
      if (p === '...') {
        html += '<span class="page-info">…</span>';
      } else {
        html += `<button class="page-number${p === page ? ' active' : ''}" onclick="Components._pagerGo(this, ${p})">${p}</button>`;
      }
    });

    html += `<button class="page-btn nav" onclick="Components._pagerGo(this, ${page + 1})"${page >= totalPages ? ' disabled' : ''}><i class="fas fa-chevron-right"></i></button>`;

    if (showJumper) {
      html += `<span class="page-jumper">前往 <input type="text" value="${page}" onkeydown="if(event.key==='Enter')Components._pagerGo(this, parseInt(this.value)||1)"> 页</span>`;
    }

    html += '</div>';
    el.innerHTML = html;
    el._pagerOpts = opts;
  },

  _pagerGo(el, page) {
    const wrap = el.closest('.pagination').parentElement;
    const opts = wrap._pagerOpts || {};
    const total = parseInt(opts.total || 0, 10);
    const pageSize = parseInt(opts.pageSize || 10, 10);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (page < 1 || page > totalPages) return;
    if (typeof opts.onChange === 'function') opts.onChange(page);
  },

  _pagerSizeChange(el) {
    const wrap = el.closest('.pagination').parentElement;
    const opts = wrap._pagerOpts || {};
    const size = parseInt(el.value, 10);
    if (typeof opts.onSizeChange === 'function') opts.onSizeChange(size);
  }
};

window.Components = Components;

/**
 * Utilidades de interfaz de usuario
 */
const UI = (() => {

  /**
   * Muestra una notificación toast
   */
  function toast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'all 300ms ease';
      setTimeout(() => el.remove(), 300);
    }, duration);
  }

  /**
   * Renderiza una tabla genérica
   */
  function renderTable(container, { columns, rows, emptyMessage = 'Sin datos' }) {
    if (!rows || rows.length === 0) {
      container.innerHTML = `<div class="empty-state">${emptyMessage}</div>`;
      return;
    }

    const html = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(c => `<td>${c.render ? c.render(row) : (row[c.key] ?? '—')}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.innerHTML = html;
  }

  function loading(container, message = 'Cargando...') {
    if (!container) return;
    container.innerHTML = `<div class="loading">${message}</div>`;
  }

  function error(container, message = 'Ocurrió un error') {
    if (!container) return;
    container.innerHTML = `<div class="error-state">⚠️ ${message}</div>`;
  }

  function setActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle('active', el.getAttribute(attr) === value);
    });
  }

  /**
   * Skeleton loader
   */
  function skeleton(container, rows = 5) {
    if (!container) return;
    container.innerHTML = `
      <div class="skeleton-list">
        ${Array.from({ length: rows }).map(() => `
          <div class="skeleton-row">
            <div class="skeleton-bar" style="width:20%"></div>
            <div class="skeleton-bar" style="width:35%"></div>
            <div class="skeleton-bar" style="width:15%"></div>
            <div class="skeleton-bar" style="width:25%"></div>
          </div>`).join('')}
      </div>`;
  }

  /**
   * Estado vacío con ilustración
   */
  function emptyState(container, { icon = '📭', title = 'Sin datos', message = '' } = {}) {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-illustration">
        <div class="empty-icon">${icon}</div>
        <h4>${title}</h4>
        ${message ? `<p>${message}</p>` : ''}
      </div>`;
  }

  /**
   * Paginación simple
   */
  function paginate(items, page, pageSize = 10) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const current = Math.min(Math.max(1, page), totalPages);
    const start = (current - 1) * pageSize;
    return {
      items: items.slice(start, start + pageSize),
      current,
      totalPages,
      total,
      pageSize
    };
  }

  return {
    toast,
    renderTable,
    loading,
    error,
    setActive,
    skeleton,
    emptyState,
    paginate
  };
})();
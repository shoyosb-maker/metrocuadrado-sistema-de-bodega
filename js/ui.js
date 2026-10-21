/**
 * Utilidades de interfaz de usuario
 */
const UI = (() => {

  /**
   * Escapa texto para inserción segura en HTML (text y atributos).
   * Acepta null/undefined → devuelve ''.
   */
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  /**
   * Muestra una notificación toast (usa textContent → seguro por defecto)
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
   * Renderiza una tabla genérica.
   * - Columnas SIN `render` propio: el valor se escapa automáticamente.
   * - Columnas CON `render` propio: el render es responsable de usar `esc()`
   *   en los datos que interpola (debe envolver todo dato de backend).
   */
  function renderTable(container, { columns, rows, emptyMessage = 'Sin datos' }) {
    if (!rows || rows.length === 0) {
      container.innerHTML = `<div class="empty-state">${esc(emptyMessage)}</div>`;
      return;
    }

    const html = `
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>${columns.map(c => `<th>${esc(c.label)}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${columns.map(c => {
                  if (c.render) return `<td>${c.render(row)}</td>`;
                  return `<td>${esc(row[c.key])}</td>`;
                }).join('')}
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
    container.innerHTML = `<div class="loading">${esc(message)}</div>`;
  }

  function error(container, message = 'Ocurrió un error') {
    if (!container) return;
    container.innerHTML = `<div class="error-state">⚠️ ${esc(message)}</div>`;
  }

  function setActive(selector, attr, value) {
    document.querySelectorAll(selector).forEach(el => {
      el.classList.toggle('active', el.getAttribute(attr) === value);
    });
  }

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

  function emptyState(container, { icon = '📭', title = 'Sin datos', message = '' } = {}) {
    if (!container) return;
    container.innerHTML = `
      <div class="empty-illustration">
        <div class="empty-icon">${esc(icon)}</div>
        <h4>${esc(title)}</h4>
        ${message ? `<p>${esc(message)}</p>` : ''}
      </div>`;
  }

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
    esc,
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
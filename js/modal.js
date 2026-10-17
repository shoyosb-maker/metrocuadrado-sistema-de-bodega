const Modal = (() => {
  let root, content, titleEl, footerEl, onCloseCb = null;

  function ensureRoot() {
    if (root) return;
    root = document.createElement('div');
    root.className = 'modal-overlay';
    root.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3 id="modal-title"></h3>
          <button class="modal-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="modal-body"></div>
        <div class="modal-footer"></div>
      </div>`;
    document.body.appendChild(root);

    content = root.querySelector('.modal-body');
    titleEl = root.querySelector('#modal-title');
    footerEl = root.querySelector('.modal-footer');

    root.querySelector('.modal-close').addEventListener('click', () => close());
    root.addEventListener('click', e => { if (e.target === root) close(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.classList.contains('open')) close();
    });
  }

  function open({ title = '', body = '', footer = '', onClose = null }) {
    ensureRoot();
    titleEl.textContent = title;
    content.innerHTML = body;
    footerEl.innerHTML = footer;
    footerEl.style.display = footer ? 'flex' : 'none';
    onCloseCb = onClose;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => root.classList.add('open'));
    return { content, footer: footerEl };
  }

  /**
   * Cierra el modal.
   * @param {boolean} silent - Si es true, NO dispara el callback onClose.
   *                           Se usa cuando el cierre es una acción explícita
   *                           (confirmar/cancelar) para no sobrescribir el resolve.
   */
  function close(silent = false) {
    if (!root) return;
    root.classList.remove('open');
    document.body.style.overflow = '';
    if (!silent && typeof onCloseCb === 'function') {
      onCloseCb();
    }
    onCloseCb = null;
  }

  async function confirm(message, options = {}) {
    const {
      title = 'Confirmar',
      confirmText = 'Aceptar',
      cancelText = 'Cancelar',
      danger = false
    } = options;

    return new Promise(resolve => {
      let resolved = false;

      const { footer } = open({
        title,
        body: `<p class="modal-message">${message}</p>`,
        footer: `
          <button class="btn btn-ghost" data-modal-cancel>${cancelText}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-modal-confirm>${confirmText}</button>
        `,
        // Solo se dispara si el usuario cierra el modal por fuera
        // (overlay, ESC, botón X) — NO cuando pulsa Confirmar/Cancelar
        onClose: () => {
          if (!resolved) {
            resolved = true;
            resolve(false);
          }
        }
      });

      footer.querySelector('[data-modal-cancel]').addEventListener('click', () => {
        if (resolved) return;
        resolved = true;
        close(true);       // cierre silencioso para no llamar a onClose
        resolve(false);
      });

      footer.querySelector('[data-modal-confirm]').addEventListener('click', () => {
        if (resolved) return;
        resolved = true;
        close(true);       // cierre silencioso
        resolve(true);
      });
    });
  }

  return { open, close, confirm };
})();
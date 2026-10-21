const Modal = (() => {
  let root, content, titleEl, footerEl, onCloseCb = null;

  // Helpers de escape (Modal se carga antes que UI, no dependemos de UI.esc)
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

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
    // `title` se escapa; `body` y `footer` son HTML de confianza del llamador
    // (pero cualquier dato interpolado dentro debe venir ya escapado).
    titleEl.textContent = title;
    content.innerHTML = body;
    footerEl.innerHTML = footer;
    footerEl.style.display = footer ? 'flex' : 'none';
    onCloseCb = onClose;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => root.classList.add('open'));
    return { content, footer: footerEl };
  }

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
        body: `<p class="modal-message">${esc(message)}</p>`,
        footer: `
          <button class="btn btn-ghost" data-modal-cancel>${esc(cancelText)}</button>
          <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-modal-confirm>${esc(confirmText)}</button>
        `,
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
        close(true);
        resolve(false);
      });

      footer.querySelector('[data-modal-confirm]').addEventListener('click', () => {
        if (resolved) return;
        resolved = true;
        close(true);
        resolve(true);
      });
    });
  }

  return { open, close, confirm };
})();
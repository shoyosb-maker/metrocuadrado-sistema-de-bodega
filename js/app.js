/**
 * Punto de entrada de la aplicación v11.3
 * - XSS-safe (UI.esc en todo dato de backend)
 * - Filtro de productos inactivos con toggle
 * - Sin importación CSV
 */
const App = (() => {
  const state = {
    products: [], requests: [], users: [], audit: [], movements: [],
    bodegas: [], proveedores: [], ordenes: [], stats: null, user: null, financeStats: null,
    filters: {
      status: '', desde: '', hasta: '', search: '', searchUsers: '',
      searchAudit: '', moveType: '', idBodega: '', filterOC: '',
      showInactiveProducts: false
    },
    pagination: { products: 1, requests: 1 }
  };

  function init() {
    loadTheme();
    bindEvents();
    Auth.init();
    registerRoutes();
    setTimeout(() => { if (!Auth.isAuthenticated()) Auth.tryRestoreSession(); }, 300);
  }

  function bindEvents() {
    document.getElementById('google-login-btn')?.addEventListener('click', Auth.login);
    document.getElementById('logout-btn')?.addEventListener('click', Auth.logout);

    document.getElementById('menu-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebar-backdrop')?.addEventListener('click', closeSidebar);

    document.getElementById('refresh-btn')?.addEventListener('click', async () => {
      UI.toast('Recargando…', 'info', 1200);
      await loadAllData();
      renderRoute(Router.getCurrent());
    });
    document.getElementById('scan-qr-btn')?.addEventListener('click', () => QR.startScanner());
    document.getElementById('gen-oc-btn')?.addEventListener('click', handleGenerarOC);
    document.getElementById('gen-oc-btn-2')?.addEventListener('click', handleGenerarOC);
    document.getElementById('theme-toggle-btn')?.addEventListener('click', toggleTheme);

    document.getElementById('global-bodega-filter')?.addEventListener('change', async (e) => {
      state.filters.idBodega = e.target.value;
      state.pagination.products = 1;
      state.pagination.requests = 1;
      await loadAllData();
      renderRoute(Router.getCurrent());
    });

    document.getElementById('request-form')?.addEventListener('submit', handleCreateRequest);
    document.getElementById('req-product')?.addEventListener('change', updateStockHint);

    document.getElementById('search-products')?.addEventListener('input', debounce(e => {
      state.filters.search = e.target.value.toLowerCase();
      state.pagination.products = 1;
      renderProductsTable();
    }, 250));

    // Toggle "Ver inactivos"
    document.getElementById('show-inactive-products')?.addEventListener('change', e => {
      state.filters.showInactiveProducts = e.target.checked;
      state.pagination.products = 1;
      renderProductsTable();
    });

    document.getElementById('filter-status')?.addEventListener('change', e => { state.filters.status = e.target.value; state.pagination.requests = 1; renderRequestsTable(); });
    document.getElementById('filter-desde')?.addEventListener('change', e => { state.filters.desde = e.target.value; renderRequestsTable(); });
    document.getElementById('filter-hasta')?.addEventListener('change', e => { state.filters.hasta = e.target.value; renderRequestsTable(); });
    document.getElementById('filter-oc-estado')?.addEventListener('change', e => { state.filters.filterOC = e.target.value; renderOrdenesTable(); });

    document.getElementById('new-product-btn')?.addEventListener('click', () => openProductForm());
    document.getElementById('new-bodega-btn')?.addEventListener('click', () => openBodegaForm());
    document.getElementById('new-proveedor-btn')?.addEventListener('click', () => openProveedorForm());
    document.getElementById('new-oc-btn')?.addEventListener('click', () => openOrdenForm());
    document.getElementById('new-user-btn')?.addEventListener('click', () => openUserForm());
    document.getElementById('new-movement-btn')?.addEventListener('click', () => openMovementForm());
    document.getElementById('transfer-btn')?.addEventListener('click', () => openTransferForm());

    document.getElementById('export-csv-btn')?.addEventListener('click', handleExportCSV);
    document.getElementById('export-pdf-btn')?.addEventListener('click', handleExportPDF);

    document.getElementById('search-users')?.addEventListener('input', debounce(e => { state.filters.searchUsers = e.target.value.toLowerCase(); renderUsersTable(); }, 250));
    document.getElementById('filter-move-type')?.addEventListener('change', e => { state.filters.moveType = e.target.value; renderMovementsTable(); });
    document.getElementById('search-audit')?.addEventListener('input', debounce(e => { state.filters.searchAudit = e.target.value.toLowerCase(); renderAuditTable(); }, 250));

    window.addEventListener('hashchange', () => { closeSidebar(); });
  }

  function toggleSidebar() {
    const sb = document.getElementById('sidebar');
    const bd = document.getElementById('sidebar-backdrop');
    if (!sb || !bd) return;
    if (sb.classList.contains('open')) {
      closeSidebar();
    } else {
      sb.classList.add('open');
      bd.classList.add('active');
      document.body.classList.add('sidebar-open');
    }
  }

  function closeSidebar() {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-backdrop')?.classList.remove('active');
    document.body.classList.remove('sidebar-open');
  }

  function loadTheme() {
    const saved = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (systemPrefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
  }

  function updateThemeIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }

  async function onLoginSuccess(user) {
    state.user = user;
    document.getElementById('user-name').textContent = user.name || 'Usuario';
    document.getElementById('user-email').textContent = user.email || '';
    document.getElementById('user-avatar').src = user.picture || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.name || 'U');

    try {
      const r = await API.getUserRole({ email: user.email });
      if (!r.activo) {
        UI.toast('Tu cuenta está inactiva. Contacta al administrador.', 'error', 6000);
        Auth.logout();
        return;
      }
      Permissions.set(r.rol, r.activo);
    } catch (e) { Permissions.set('visualizador', false); }

    document.getElementById('login-view').classList.remove('active');
    document.getElementById('app-view').classList.add('active');
    await loadAllData();
    Router.init();
  }

  function onLogout() {
    Object.assign(state, {
      user: null, products: [], requests: [], users: [], audit: [], movements: [],
      bodegas: [], proveedores: [], ordenes: [], stats: null, financeStats: null
    });
    // Resetear UI del toggle para que no quede desincronizado
    const toggle = document.getElementById('show-inactive-products');
    if (toggle) toggle.checked = false;
    state.filters.showInactiveProducts = false;

    document.getElementById('app-view').classList.remove('active');
    document.getElementById('login-view').classList.add('active');
    window.location.hash = '';
    closeSidebar();
  }

  async function loadAllData() {
    try {
      try { const bg = await API.getBodegas(); state.bodegas = (bg.bodegas || []).filter(b => b.Activo !== false && b.Activo !== 'FALSE'); populateBodegaFilter(); } catch (e) { state.bodegas = []; }
      try { const pv = await API.getProveedores(); state.proveedores = (pv.proveedores || []).filter(p => p.Activo !== false && p.Activo !== 'FALSE'); } catch (e) { state.proveedores = []; }

      const apiFilter = state.filters.idBodega ? { idBodega: state.filters.idBodega } : {};
      const [pr, rq, st] = await Promise.all([API.getProducts(apiFilter), API.getRequests(apiFilter), API.getDashboardStats(apiFilter)]);
      state.products = pr.products || [];
      state.requests = rq.requests || [];
      state.stats = st;

      try { const mv = await API.getMovements({ limit: 500, idBodega: state.filters.idBodega || undefined }); state.movements = mv.movements || []; } catch (e) {}
      try { const oc = await API.getOrdenesCompra({ limit: 300 }); state.ordenes = oc.ordenes || []; } catch (e) {}

      try { const fin = await API.getFinanceStats({}); state.financeStats = fin; } catch (e) { console.warn('Error finanzas', e); }

      if (Permissions.isAdmin()) {
        try {
          const [us, au] = await Promise.all([API.getUsers(), API.getAudit({ limit: 500 })]);
          state.users = us.users || [];
          state.audit = au.audit || [];
        } catch (e) {}
      }
    } catch (err) { UI.toast('Error cargando datos: ' + err.message, 'error'); }
  }

  function populateBodegaFilter() {
    const sel = document.getElementById('global-bodega-filter');
    if (!sel) return;
    const current = state.filters.idBodega || sel.value || '';
    sel.innerHTML = '<option value="">Todas las bodegas</option>' +
      state.bodegas.map(b => `<option value="${UI.esc(b.ID)}">${UI.esc(b.Nombre)}</option>`).join('');
    sel.value = current;
  }

  function getBodegaName(id) { if (!id) return '—'; const b = state.bodegas.find(x => String(x.ID) === String(id)); return b ? b.Nombre : String(id); }
  function getProveedorName(id) { if (!id) return '—'; const p = state.proveedores.find(x => String(x.ID) === String(id)); return p ? p.Nombre : String(id); }

  function registerRoutes() {
    Router.register('dashboard', renderDashboard);
    Router.register('productos', renderProductos);
    Router.register('solicitudes', renderSolicitudes);
    Router.register('nueva-solicitud', renderNuevaSolicitud);
    Router.register('bodegas', renderBodegas);
    Router.register('proveedores', renderProveedores);
    Router.register('ordenes', renderOrdenes);
    Router.register('movimientos', renderMovimientos);
    Router.register('usuarios', renderUsuarios);
    Router.register('auditoria', renderAuditoria);
    Router.register('producto', renderProducto);
    Router.register('eventos', () => { renderRoute('eventos'); Eventos.renderList(); });
    Router.register('evento-detalle', (params) => { renderRoute('evento-detalle'); Eventos.renderDetail(params[0]); });
  }

  function renderRoute(route) {
    document.querySelectorAll('.route-view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${route}`)?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.route === route));
    const titles = {
      dashboard: 'Dashboard', productos: 'Productos', solicitudes: 'Solicitudes', 'nueva-solicitud': 'Nueva Solicitud',
      bodegas: 'Bodegas', proveedores: 'Proveedores', ordenes: 'Órdenes de Compra', movimientos: 'Movimientos',
      usuarios: 'Usuarios', auditoria: 'Auditoría', producto: 'Detalle de Producto',
      eventos: 'Eventos y Alquiler', 'evento-detalle': 'Detalle del Evento'
    };
    document.getElementById('page-title').textContent = titles[route] || 'App';
    Permissions.apply();
    closeSidebar();
    const content = document.getElementById('content');
    if (content) content.scrollTop = 0;
  }

  async function renderDashboard() {
    renderRoute('dashboard');
    const st = state.stats || {};
    document.getElementById('stat-total-products').textContent = st.totalProducts ?? '—';
    document.getElementById('stat-total-stock').textContent = st.totalStock ?? '—';
    document.getElementById('stat-low-stock').textContent = st.lowStock ?? '—';
    document.getElementById('stat-pending-requests').textContent = st.pendingRequests ?? '—';
    document.getElementById('stat-ordenes-activas').textContent = st.ordenesActivas ?? '—';
    document.getElementById('stat-eventos-activos').textContent = st.eventosActivos ?? '—';
    document.getElementById('stat-materiales-calle').textContent = st.materialesEnCalle ?? '—';

    if (st.topProducts && window.Charts) Charts.renderTopProducts('chart-top-products', st.topProducts);
    if (st.byStatus && window.Charts) Charts.renderStatusDoughnut('chart-status', st.byStatus);

    if (state.financeStats && window.Charts && Permissions.canSeeFinance()) {
      Charts.renderFinanceChart('chart-finance', state.financeStats);
    }

    const low = state.products.filter(p =>
      (p.Activo !== false && p.Activo !== 'FALSE') &&
      Number(p.Stock) <= Number(p.Stock_Min)
    );
    const container = document.getElementById('low-stock-list');
    if (low.length === 0) {
      UI.emptyState(container, { icon: '✅', title: 'Todo en orden', message: 'No hay productos con bajo stock' });
    } else {
      UI.renderTable(container, {
        columns: [
          { key: 'Nombre', label: 'Producto' },
          { key: 'SKU', label: 'SKU' },
          { key: 'ID_Bodega', label: 'Bodega', render: r => UI.esc(getBodegaName(r.ID_Bodega)) },
          { key: 'Stock', label: 'Actual' },
          { key: 'Stock_Min', label: 'Mínimo' },
          { label: 'Estado', render: () => '<span class="badge badge-warning">Reponer</span>' }
        ],
        rows: low
      });
    }
  }

  function renderProductos() { renderRoute('productos'); renderProductsTable(); }

  function renderProductsTable() {
    const container = document.getElementById('products-table-container');
    const showInactive = !!state.filters.showInactiveProducts;

    const filtered = state.products.filter(p => {
      // 1) Excluir inactivos si no están visibles
      const inactivo = (p.Activo === false || p.Activo === 'FALSE');
      if (!showInactive && inactivo) return false;

      // 2) Búsqueda
      const s = state.filters.search;
      if (!s) return true;
      return (p.Nombre || '').toLowerCase().includes(s) ||
             (p.SKU || '').toLowerCase().includes(s) ||
             (p.Categoria || '').toLowerCase().includes(s) ||
             (p.Codigo_Barras || '').toLowerCase().includes(s);
    });

    if (filtered.length === 0) {
      const hasAny = state.products.length > 0;
      UI.emptyState(container, {
        icon: '📦',
        title: hasAny ? 'Sin resultados' : 'Sin productos',
        message: hasAny
          ? 'Ajusta la búsqueda o activa "Ver inactivos" si buscas desactivados.'
          : 'Crea el primero con "Nuevo producto"'
      });
      return;
    }

    const pg = UI.paginate(filtered, state.pagination.products, 10);
    state.pagination.products = pg.current;

    const columns = [
      { key: 'ID', label: 'ID', render: r => `<a href="#/producto/${UI.esc(r.ID)}" style="color:var(--color-primary);text-decoration:underline">${UI.esc(r.ID)}</a>` },
      { key: 'Nombre', label: 'Nombre' },
      { key: 'SKU', label: 'SKU' },
      { key: 'Codigo_Barras', label: 'Cód. Barras', render: r => UI.esc(r.Codigo_Barras || '—') },
      { key: 'Tipo_Producto', label: 'Tipo', render: r => {
        const tipo = r.Tipo_Producto || 'Venta';
        const cls = tipo === 'Alquiler' ? 'warning' : 'info';
        return `<span class="badge badge-${cls}">${UI.esc(tipo)}</span>`;
      }},
      { key: 'Unidad_Medida', label: 'UoM' },
      { key: 'Ubicacion_Fisica', label: 'Ubicación' },
      { key: 'ID_Bodega', label: 'Bodega', render: r => UI.esc(getBodegaName(r.ID_Bodega)) },
      { key: 'ID_Proveedor', label: 'Proveedor', render: r => UI.esc(getProveedorName(r.ID_Proveedor)) },
      { key: 'Stock', label: 'Stock' },
      { key: 'Costo_Unitario', label: 'Costo', render: r => `$${Number(r.Costo_Unitario || 0).toLocaleString()}` },
      { key: 'Precio_Alquiler', label: 'Precio Alq.', render: r => r.Precio_Alquiler ? `$${Number(r.Precio_Alquiler).toLocaleString()}` : '—' },
      { label: 'Estado', render: r => {
        const s = Number(r.Stock), m = Number(r.Stock_Min);
        if (r.Activo === false || r.Activo === 'FALSE') return '<span class="badge badge-secondary">Inactivo</span>';
        if (s <= 0) return '<span class="badge badge-danger">Agotado</span>';
        if (s <= m) return '<span class="badge badge-warning">Bajo</span>';
        return '<span class="badge badge-success">Disponible</span>';
      }},
      { label: 'Acciones', render: r => {
        const inactivo = (r.Activo === false || r.Activo === 'FALSE');
        const idEsc = UI.esc(r.ID);
        if (inactivo) {
          return `
            <div class="row-actions" data-perm="admin, bodega">
              <button class="btn btn-sm btn-success" data-reactivate="${idEsc}" title="Reactivar">♻️</button>
              <button class="btn btn-sm btn-ghost" data-edit="${idEsc}" title="Editar">✏️</button>
            </div>`;
        }
        return `
          <div class="row-actions" data-perm="admin, bodega">
            <button class="btn btn-sm btn-ghost" data-qr="${idEsc}" title="Ver QR">📱</button>
            <button class="btn btn-sm btn-ghost" data-edit="${idEsc}" title="Editar">✏️</button>
            <button class="btn btn-sm btn-danger" data-del="${idEsc}" title="Desactivar">🗑</button>
          </div>`;
      }}
    ];

    UI.renderTable(container, { columns, rows: pg.items, emptyMessage: 'Sin productos' });
    appendPagination(container, pg, 'products', renderProductsTable);

    container.querySelectorAll('[data-qr]').forEach(b => b.addEventListener('click', () => {
      const p = state.products.find(x => String(x.ID) === String(b.dataset.qr));
      if (p) QR.showProductQR(p, getBodegaName(p.ID_Bodega));
    }));
    container.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => openProductForm(b.dataset.edit)));
    container.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => handleDeleteProduct(b.dataset.del)));
    container.querySelectorAll('[data-reactivate]').forEach(b => b.addEventListener('click', () => handleReactivateProduct(b.dataset.reactivate)));
    Permissions.apply();
  }

  function appendPagination(container, pg, stateKey, onPage) {
    if (pg.totalPages <= 1) return;
    const nav = document.createElement('div'); nav.className = 'pagination';
    nav.innerHTML = `<button class="btn btn-ghost btn-sm" ${pg.current === 1 ? 'disabled' : ''} data-pg="prev">← Anterior</button><span>Página ${pg.current} de ${pg.totalPages} · ${pg.total} registros</span><button class="btn btn-ghost btn-sm" ${pg.current === pg.totalPages ? 'disabled' : ''} data-pg="next">Siguiente →</button>`;
    container.appendChild(nav);
    nav.querySelector('[data-pg="prev"]')?.addEventListener('click', () => { state.pagination[stateKey]--; onPage(); });
    nav.querySelector('[data-pg="next"]')?.addEventListener('click', () => { state.pagination[stateKey]++; onPage(); });
  }

  function openProductForm(id = null) {
    const editing = !!id;
    const p = editing ? state.products.find(x => String(x.ID) === String(id)) : {};
    if (editing && !p) { UI.toast('Producto no encontrado', 'error'); return; }

    const bodOpts = state.bodegas.map(b => `<option value="${UI.esc(b.ID)}" ${String(p.ID_Bodega) === String(b.ID) ? 'selected' : ''}>${UI.esc(b.Nombre)}</option>`).join('');
    const provOpts = state.proveedores.map(pr => `<option value="${UI.esc(pr.ID)}" ${String(p.ID_Proveedor) === String(pr.ID) ? 'selected' : ''}>${UI.esc(pr.Nombre)}</option>`).join('');

    const body = `
      <form id="product-form" class="form">
        <div class="form-row">
          <div class="form-group"><label>Nombre *</label><input name="Nombre" class="input" required value="${UI.esc(p.Nombre || '')}" /></div>
          <div class="form-group"><label>SKU</label><input name="SKU" class="input" value="${UI.esc(p.SKU || '')}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Tipo de Producto *</label>
            <select name="Tipo_Producto" class="input" required>
              <option value="Venta" ${p.Tipo_Producto === 'Venta' ? 'selected' : ''}>Venta (Consumible)</option>
              <option value="Alquiler" ${p.Tipo_Producto === 'Alquiler' ? 'selected' : ''}>Alquiler (Retornable)</option>
            </select>
          </div>
          <div class="form-group"><label>Precio Venta</label><input name="Precio" type="number" class="input" min="0" step="0.01" value="${UI.esc(p.Precio || 0)}" /></div>
          <div class="form-group"><label>Precio Alquiler (Día/Evento)</label><input name="Precio_Alquiler" type="number" class="input" min="0" step="0.01" value="${UI.esc(p.Precio_Alquiler || 0)}" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Stock</label><input name="Stock" type="number" class="input" min="0" value="${UI.esc(p.Stock || 0)}" /></div>
          <div class="form-group"><label>Stock mínimo</label><input name="Stock_Min" type="number" class="input" min="0" value="${UI.esc(p.Stock_Min || 0)}" /></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label>Unidad de Medida</label>
            <select name="Unidad_Medida" class="input">
              <option value="Unidad" ${p.Unidad_Medida === 'Unidad' ? 'selected' : ''}>Unidad</option>
              <option value="Caja" ${p.Unidad_Medida === 'Caja' ? 'selected' : ''}>Caja</option>
              <option value="Kilo" ${p.Unidad_Medida === 'Kilo' ? 'selected' : ''}>Kilo</option>
              <option value="Litro" ${p.Unidad_Medida === 'Litro' ? 'selected' : ''}>Litro</option>
              <option value="Metro" ${p.Unidad_Medida === 'Metro' ? 'selected' : ''}>Metro</option>
            </select>
          </div>
          <div class="form-group"><label>Costo Unitario (Compra)</label><input name="Costo_Unitario" type="number" step="0.01" class="input" value="${UI.esc(p.Costo_Unitario || 0)}" /></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label>Ubicación Física</label><input name="Ubicacion_Fisica" class="input" placeholder="Ej: Pasillo A, Estante 3" value="${UI.esc(p.Ubicacion_Fisica || '')}" /></div>
          <div class="form-group"><label>Código de Barras (EAN/UPC)</label><input name="Codigo_Barras" class="input" placeholder="Ej: 123456789012" value="${UI.esc(p.Codigo_Barras || '')}" /></div>
        </div>

        <div class="form-row">
          <div class="form-group"><label>Categoría</label><input name="Categoria" class="input" value="${UI.esc(p.Categoria || '')}" /></div>
          <div class="form-group"><label>Bodega *</label><select name="ID_Bodega" class="input" required><option value="">Selecciona</option>${bodOpts}</select></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Proveedor</label><select name="ID_Proveedor" class="input"><option value="">Sin proveedor</option>${provOpts}</select></div>
          <div class="form-group"><label>Activo</label>
            <select name="Activo" class="input"><option value="true" ${p.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${p.Activo === false ? 'selected' : ''}>No</option></select>
          </div>
        </div>
        <div class="form-group"><label>Descripción</label><textarea name="Descripcion" class="input" rows="2">${UI.esc(p.Descripcion || '')}</textarea></div>
        <div class="form-group">
          <label>Imagen</label>
          <input type="file" id="product-image" accept="image/*" />
          <input type="hidden" name="Imagen_URL" value="${UI.esc(p.Imagen_URL || '')}" />
          <div id="image-preview" class="image-preview">${p.Imagen_URL ? `<img src="${UI.esc(p.Imagen_URL)}" />` : ''}</div>
        </div>
      </form>`;

    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="product-save-btn">Guardar</button>`;
    const { footer: footerEl } = Modal.open({ title: editing ? 'Editar producto' : 'Nuevo producto', body, footer });

    footerEl.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));

    document.getElementById('product-image').addEventListener('change', e => {
      const f = e.target.files[0]; if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => { document.getElementById('image-preview').innerHTML = `<img src="${UI.esc(ev.target.result)}" />`; };
      reader.readAsDataURL(f);
    });

    footerEl.querySelector('#product-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('product-form');
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload.Activo = payload.Activo === 'true';

      const fileInput = document.getElementById('product-image');
      const file = fileInput.files[0];
      const btn = footerEl.querySelector('#product-save-btn');
      btn.disabled = true; btn.textContent = 'Guardando…';

      try {
        if (file) {
          const base64 = await fileToBase64(file);
          const up = await API.uploadFile({ fileName: `product-${Date.now()}-${file.name}`, mimeType: file.type, base64 });
          if (up.directUrl) payload.Imagen_URL = up.directUrl;
        }
        if (editing) { payload.ID = p.ID; await API.updateProduct(payload); } else { await API.createProduct(payload); }
        UI.toast(editing ? 'Producto actualizado' : 'Producto creado', 'success');
        Modal.close(true); await loadAllData(); renderProductsTable();
      } catch (err) { UI.toast('Error: ' + err.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
    });
  }

  async function handleDeleteProduct(id) {
    const p = state.products.find(x => String(x.ID) === String(id));
    const nombre = p ? p.Nombre : id;
    const ok = await Modal.confirm(
      `¿Desactivar "${nombre}"?\n\nEl producto dejará de aparecer en el catálogo, pero se conserva el historial de movimientos, solicitudes y eventos.`,
      { title: 'Desactivar producto', confirmText: 'Desactivar', danger: true }
    );
    if (!ok) return;
    try {
      await API.deleteProduct({ ID: id });
      UI.toast('Producto desactivado', 'success');
      await loadAllData();
      renderProductsTable();
    } catch (e) {
      UI.toast('Error: ' + e.message, 'error');
    }
  }

  async function handleReactivateProduct(id) {
    try {
      await API.updateProduct({ ID: id, Activo: true });
      UI.toast('Producto reactivado', 'success');
      await loadAllData();
      renderProductsTable();
    } catch (e) {
      UI.toast('Error: ' + e.message, 'error');
    }
  }

  function renderProducto(params) {
    renderRoute('producto');
    const container = document.getElementById('product-detail-container');
    const id = params && params[0];
    if (!id) { UI.emptyState(container, { icon: '❓', title: 'Producto no especificado', message: 'Escanea un QR o selecciona un producto' }); return; }
    const p = state.products.find(x => String(x.ID) === String(id));
    if (!p) { UI.emptyState(container, { icon: '🔍', title: 'Producto no encontrado', message: 'El ID ' + id + ' no existe' }); return; }

    const bodegaName = getBodegaName(p.ID_Bodega);
    const stockNum = Number(p.Stock) || 0;
    const minNum = Number(p.Stock_Min) || 0;
    const estado = (p.Activo === false || p.Activo === 'FALSE') ? 'Inactivo' : stockNum <= 0 ? 'Agotado' : stockNum <= minNum ? 'Bajo' : 'Disponible';
    const estadoBadge = { Inactivo: 'badge-secondary', Agotado: 'badge-danger', Bajo: 'badge-warning', Disponible: 'badge-success' }[estado];

    const movs = state.movements.filter(m => String(m.ID_Producto) === String(id)).slice(0, 15);
    const reqs = state.requests.filter(r => String(r.ID_Producto) === String(id)).slice(0, 10);
    const ocs = state.ordenes.filter(o => String(o.ID_Producto) === String(id)).slice(0, 10);

    const movRows = movs.length ? movs.map(m => `
      <tr>
        <td>${UI.esc(new Date(m.Fecha).toLocaleString())}</td>
        <td><span class="badge ${m.Tipo === 'Entrada' ? 'badge-success' : m.Tipo === 'Salida' ? 'badge-warning' : 'badge-info'}">${UI.esc(m.Tipo)}</span></td>
        <td>${UI.esc(m.Cantidad)}</td><td>${UI.esc(m.Stock_Antes)} → ${UI.esc(m.Stock_Despues)}</td>
        <td>${UI.esc(m.Lote || '—')}</td><td>${m.Fecha_Vencimiento ? UI.esc(new Date(m.Fecha_Vencimiento).toLocaleDateString()) : '—'}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="muted-sm" style="text-align:center;padding:20px">Sin movimientos</td></tr>';

    const reqRows = reqs.length ? reqs.map(r => `
      <tr><td>${UI.esc(r.ID_Solicitud)}</td><td>${r.Fecha ? UI.esc(new Date(r.Fecha).toLocaleDateString()) : '—'}</td><td>${UI.esc(r.Cantidad)}</td><td>${UI.esc(r.ID_Usuario || '—')}</td><td><span class="badge ${r.Estado === 'Aprobada' ? 'badge-success' : r.Estado === 'Rechazada' ? 'badge-danger' : 'badge-warning'}">${UI.esc(r.Estado || '—')}</span></td></tr>`).join('') : '<tr><td colspan="5" class="muted-sm" style="text-align:center;padding:20px">Sin solicitudes</td></tr>';

    const ocRows = ocs.length ? ocs.map(o => `
      <tr><td>${UI.esc(o.ID)}</td><td>${o.Fecha ? UI.esc(new Date(o.Fecha).toLocaleDateString()) : '—'}</td><td>${UI.esc(getProveedorName(o.ID_Proveedor))}</td><td>${UI.esc(o.Cantidad)}</td><td><span class="badge ${o.Estado === 'Recibida' ? 'badge-success' : o.Estado === 'Cancelada' ? 'badge-danger' : o.Estado === 'Enviada' ? 'badge-info' : 'badge-secondary'}">${UI.esc(o.Estado || '—')}</span></td></tr>`).join('') : '<tr><td colspan="5" class="muted-sm" style="text-align:center;padding:20px">Sin órdenes</td></tr>';

    container.innerHTML = `
      <div class="product-detail-grid">
        <div class="card">
          <div class="card-body" style="text-align:center">
            ${p.Imagen_URL ? `<img src="${UI.esc(p.Imagen_URL)}" alt="${UI.esc(p.Nombre)}" class="product-detail-img" />` : `<div class="product-detail-img product-detail-img-placeholder">📦</div>`}
            <h3 style="margin-top:12px">${UI.esc(p.Nombre)}</h3>
            <p class="form-hint">SKU: ${UI.esc(p.SKU || '—')} | Cód. Barras: ${UI.esc(p.Codigo_Barras || '—')}</p>
            <div style="margin-top:12px">
              <span class="badge ${estadoBadge}">${UI.esc(estado)}</span>
              <span class="badge badge-info" style="margin-left:6px">${UI.esc(bodegaName)}</span>
            </div>
            <div style="margin-top:18px;display:flex;flex-wrap:wrap;gap:8px;justify-content:center">
              <button class="btn btn-ghost btn-sm" id="pd-qr-btn">📱 Códigos</button>
              <button class="btn btn-ghost btn-sm" id="pd-edit-btn" data-perm="admin, bodega">✏️ Editar</button>
              <button class="btn btn-primary btn-sm" id="pd-move-btn" data-perm="admin, bodega">➕ Movimiento</button>
              <button class="btn btn-ghost btn-sm" id="pd-request-btn">📝 Solicitar</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Información</h3></div>
          <div class="card-body">
            <div class="info-grid">
              <div><span class="stat-label">Tipo</span><span class="info-value">${UI.esc(p.Tipo_Producto || 'Venta')}</span></div>
              <div><span class="stat-label">Stock actual</span><span class="info-value">${UI.esc(stockNum)} ${UI.esc(p.Unidad_Medida || 'Unidades')}</span></div>
              <div><span class="stat-label">Stock mínimo</span><span class="info-value">${UI.esc(minNum)}</span></div>
              <div><span class="stat-label">Costo Promedio</span><span class="info-value">$${Number(p.Costo_Unitario || 0).toLocaleString()}</span></div>
              <div><span class="stat-label">Precio Venta</span><span class="info-value">$${Number(p.Precio || 0).toLocaleString()}</span></div>
              <div><span class="stat-label">Precio Alquiler</span><span class="info-value">$${Number(p.Precio_Alquiler || 0).toLocaleString()}</span></div>
              <div><span class="stat-label">Ubicación Física</span><span class="info-value">${UI.esc(p.Ubicacion_Fisica || '—')}</span></div>
              <div><span class="stat-label">Bodega</span><span class="info-value">${UI.esc(bodegaName)}</span></div>
              <div><span class="stat-label">Proveedor</span><span class="info-value">${UI.esc(getProveedorName(p.ID_Proveedor))}</span></div>
            </div>
            ${p.Descripcion ? `<div style="margin-top:14px"><span class="stat-label">Descripción</span><p style="margin-top:4px">${UI.esc(p.Descripcion)}</p></div>` : ''}
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Movimientos recientes</h3></div>
        <div class="card-body"><div class="table-wrapper">
          <table><thead><tr><th>Fecha</th><th>Tipo</th><th>Cant.</th><th>Stock</th><th>Lote</th><th>Vence</th></tr></thead><tbody>${movRows}</tbody></table>
        </div></div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Solicitudes recientes</h3></div>
        <div class="card-body"><div class="table-wrapper">
          <table><thead><tr><th>ID</th><th>Fecha</th><th>Cant.</th><th>Solicitante</th><th>Estado</th></tr></thead><tbody>${reqRows}</tbody></table>
        </div></div>
      </div>

      <div class="card" style="margin-top:16px">
        <div class="card-header"><h3>Órdenes de compra</h3></div>
        <div class="card-body"><div class="table-wrapper">
          <table><thead><tr><th>OC</th><th>Fecha</th><th>Proveedor</th><th>Cant.</th><th>Estado</th></tr></thead><tbody>${ocRows}</tbody></table>
        </div></div>
      </div>

      <div style="margin-top:16px"><button class="btn btn-ghost" id="pd-back-btn">← Volver</button></div>
    `;

    document.getElementById('pd-qr-btn').addEventListener('click', () => QR.showProductQR(p, bodegaName));
    document.getElementById('pd-edit-btn')?.addEventListener('click', () => openProductForm(p.ID));
    document.getElementById('pd-move-btn')?.addEventListener('click', () => openMovementForm(p.ID));
    document.getElementById('pd-request-btn').addEventListener('click', () => {
      Router.navigate('nueva-solicitud');
      setTimeout(() => { const sel = document.getElementById('req-product'); if (sel) { sel.value = p.ID; sel.dispatchEvent(new Event('change')); } }, 120);
    });
    document.getElementById('pd-back-btn').addEventListener('click', () => Router.navigate('productos'));
    Permissions.apply();
  }

  function renderBodegas() { renderRoute('bodegas'); renderBodegasTable(); }
  function renderBodegasTable() {
    const container = document.getElementById('bodegas-table-container');
    if (!state.bodegas.length) { UI.emptyState(container, { icon: '🏢', title: 'Sin bodegas', message: 'Crea la primera' }); return; }
    UI.renderTable(container, {
      columns: [
        { key: 'ID', label: 'ID' },
        { key: 'Nombre', label: 'Nombre' },
        { key: 'Ubicacion', label: 'Ubicación' },
        { key: 'Responsable', label: 'Responsable' },
        { label: 'Productos', render: b => UI.esc(state.products.filter(p => String(p.ID_Bodega) === String(b.ID) && (p.Activo === true || p.Activo === 'TRUE')).length) },
        { label: 'Estado', render: b => (b.Activo === false || b.Activo === 'FALSE') ? '<span class="badge badge-danger">Inactiva</span>' : '<span class="badge badge-success">Activa</span>' },
        { label: 'Acciones', render: b => `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-edit-bodega="${UI.esc(b.ID)}">✏️</button><button class="btn btn-sm btn-danger" data-del-bodega="${UI.esc(b.ID)}">🗑</button></div>` }
      ],
      rows: state.bodegas
    });
    container.querySelectorAll('[data-edit-bodega]').forEach(btn => btn.addEventListener('click', () => openBodegaForm(btn.dataset.editBodega)));
    container.querySelectorAll('[data-del-bodega]').forEach(btn => btn.addEventListener('click', () => handleDeleteBodega(btn.dataset.delBodega)));
  }
  function openBodegaForm(id = null) {
    const editing = !!id; const b = editing ? state.bodegas.find(x => String(x.ID) === String(id)) : {};
    if (editing && !b) { UI.toast('Bodega no encontrada', 'error'); return; }
    const body = `
      <form id="bodega-form" class="form">
        <div class="form-group"><label>Nombre *</label><input name="Nombre" class="input" required value="${UI.esc(b.Nombre || '')}" /></div>
        <div class="form-group"><label>Ubicación</label><input name="Ubicacion" class="input" value="${UI.esc(b.Ubicacion || '')}" /></div>
        <div class="form-group"><label>Responsable</label><input name="Responsable" class="input" value="${UI.esc(b.Responsable || '')}" /></div>
        <div class="form-group"><label>Activa</label><select name="Activo" class="input"><option value="true" ${b.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${b.Activo === false ? 'selected' : ''}>No</option></select></div>
        <div class="form-group"><label>Notas</label><textarea name="Notas" class="input" rows="2">${UI.esc(b.Notas || '')}</textarea></div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="bodega-save-btn">Guardar</button>`;
    const { footer: f } = Modal.open({ title: editing ? 'Editar bodega' : 'Nueva bodega', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    f.querySelector('#bodega-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('bodega-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.Activo = payload.Activo === 'true'; if (editing) payload.ID = b.ID;
      const btn = f.querySelector('#bodega-save-btn'); btn.disabled = true; btn.textContent = 'Guardando…';
      try { await API.saveBodega(payload); UI.toast(editing ? 'Bodega actualizada' : 'Bodega creada', 'success'); Modal.close(true); await loadAllData(); renderBodegasTable(); }
      catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
    });
  }
  async function handleDeleteBodega(id) {
    const ok = await Modal.confirm('¿Desactivar esta bodega?', { title: 'Desactivar', confirmText: 'Desactivar', danger: true }); if (!ok) return;
    try { await API.deleteBodega({ ID: id }); UI.toast('Bodega desactivada', 'success'); await loadAllData(); renderBodegasTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }

  function renderProveedores() { renderRoute('proveedores'); renderProveedoresTable(); }
  function renderProveedoresTable() {
    const container = document.getElementById('proveedores-table-container');
    if (!state.proveedores.length) { UI.emptyState(container, { icon: '🚚', title: 'Sin proveedores', message: 'Crea el primero' }); return; }
    UI.renderTable(container, {
      columns: [
        { key: 'ID', label: 'ID' },
        { key: 'Nombre', label: 'Nombre' },
        { key: 'Contacto', label: 'Contacto' },
        { key: 'Email', label: 'Email' },
        { key: 'Telefono', label: 'Teléfono' },
        { label: 'Productos', render: p => UI.esc(state.products.filter(x => String(x.ID_Proveedor) === String(p.ID)).length) },
        { label: 'Acciones', render: p => `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-edit-prov="${UI.esc(p.ID)}">✏️</button><button class="btn btn-sm btn-danger" data-del-prov="${UI.esc(p.ID)}">🗑</button></div>` }
      ],
      rows: state.proveedores
    });
    container.querySelectorAll('[data-edit-prov]').forEach(b => b.addEventListener('click', () => openProveedorForm(b.dataset.editProv)));
    container.querySelectorAll('[data-del-prov]').forEach(b => b.addEventListener('click', () => handleDeleteProveedor(b.dataset.delProv)));
  }
  function openProveedorForm(id = null) {
    const editing = !!id; const p = editing ? state.proveedores.find(x => String(x.ID) === String(id)) : {};
    if (editing && !p) { UI.toast('Proveedor no encontrado', 'error'); return; }
    const body = `
      <form id="proveedor-form" class="form">
        <div class="form-group"><label>Nombre *</label><input name="Nombre" class="input" required value="${UI.esc(p.Nombre || '')}" /></div>
        <div class="form-row"><div class="form-group"><label>Contacto</label><input name="Contacto" class="input" value="${UI.esc(p.Contacto || '')}" /></div><div class="form-group"><label>Email</label><input name="Email" type="email" class="input" value="${UI.esc(p.Email || '')}" /></div></div>
        <div class="form-row"><div class="form-group"><label>Teléfono</label><input name="Telefono" class="input" value="${UI.esc(p.Telefono || '')}" /></div><div class="form-group"><label>Activo</label><select name="Activo" class="input"><option value="true" ${p.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${p.Activo === false ? 'selected' : ''}>No</option></select></div></div>
        <div class="form-group"><label>Notas</label><textarea name="Notas" class="input" rows="2">${UI.esc(p.Notas || '')}</textarea></div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="prov-save-btn">Guardar</button>`;
    const { footer: f } = Modal.open({ title: editing ? 'Editar proveedor' : 'Nuevo proveedor', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    f.querySelector('#prov-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('proveedor-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.Activo = payload.Activo === 'true'; if (editing) payload.ID = p.ID;
      const btn = f.querySelector('#prov-save-btn'); btn.disabled = true; btn.textContent = 'Guardando…';
      try { await API.saveProveedor(payload); UI.toast(editing ? 'Proveedor actualizado' : 'Proveedor creado', 'success'); Modal.close(true); await loadAllData(); renderProveedoresTable(); }
      catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Guardar'; }
    });
  }
  async function handleDeleteProveedor(id) {
    const ok = await Modal.confirm('¿Desactivar este proveedor?', { title: 'Desactivar', confirmText: 'Desactivar', danger: true }); if (!ok) return;
    try { await API.deleteProveedor({ ID: id }); UI.toast('Proveedor desactivado', 'success'); await loadAllData(); renderProveedoresTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }

  function renderOrdenes() { renderRoute('ordenes'); renderOrdenesTable(); }
  function renderOrdenesTable() {
    const container = document.getElementById('ordenes-table-container');
    let list = state.ordenes;
    if (state.filters.filterOC) list = list.filter(o => o.Estado === state.filters.filterOC);
    if (!list.length) { UI.emptyState(container, { icon: '🛒', title: 'Sin órdenes', message: 'Usa "Auto-generar"' }); return; }

    UI.renderTable(container, {
      columns: [
        { key: 'ID', label: 'OC' },
        { key: 'Fecha', label: 'Fecha', render: r => r.Fecha ? UI.esc(new Date(r.Fecha).toLocaleDateString()) : '—' },
        { label: 'Producto', render: r => {
          const p = state.products.find(x => String(x.ID) === String(r.ID_Producto));
          return UI.esc(p ? p.Nombre : r.ID_Producto);
        }},
        { key: 'ID_Proveedor', label: 'Proveedor', render: r => UI.esc(getProveedorName(r.ID_Proveedor)) },
        { key: 'Cantidad', label: 'Cant.' },
        { label: 'Estado', render: r => {
          const m = { Borrador: 'badge-secondary', Enviada: 'badge-info', Recibida: 'badge-success', Cancelada: 'badge-danger' };
          return `<span class="badge ${m[r.Estado] || 'badge-secondary'}">${UI.esc(r.Estado || '—')}</span>`;
        }},
        { label: 'Auto', render: r => (r.Generada_Auto === true || r.Generada_Auto === 'TRUE') ? '⚙️' : '—' },
        { label: 'Acciones', render: r => {
          const btns = [];
          const idEsc = UI.esc(r.ID);
          if (r.Estado === 'Borrador') { btns.push(`<button class="btn btn-sm btn-primary" data-send="${idEsc}" title="Enviar">📤</button>`); btns.push(`<button class="btn btn-sm btn-ghost" data-edit-oc="${idEsc}" title="Editar">✏️</button>`); }
          if (r.Estado === 'Enviada') { btns.push(`<button class="btn btn-sm btn-success" data-receive="${idEsc}" title="Recibir">📥</button>`); }
          if (r.Estado !== 'Recibida' && r.Estado !== 'Cancelada') { btns.push(`<button class="btn btn-sm btn-danger" data-cancel-oc="${idEsc}" title="Cancelar">✕</button>`); }
          return `<div class="row-actions" data-perm="admin, bodega">${btns.join('') || '<span class="muted-sm">—</span>'}</div>`;
        }}
      ],
      rows: list.slice(0, 200)
    });
    container.querySelectorAll('[data-edit-oc]').forEach(b => b.addEventListener('click', () => openOrdenForm(b.dataset.editOc)));
    container.querySelectorAll('[data-send]').forEach(b => b.addEventListener('click', () => handleEnviarOC(b.dataset.send)));
    container.querySelectorAll('[data-receive]').forEach(b => b.addEventListener('click', () => handleRecibirOC(b.dataset.receive)));
    container.querySelectorAll('[data-cancel-oc]').forEach(b => b.addEventListener('click', () => handleCancelarOC(b.dataset.cancelOc)));
    Permissions.apply();
  }

  function openOrdenForm(id = null) {
    const editing = !!id; const oc = editing ? state.ordenes.find(x => String(x.ID) === String(id)) : {};
    if (editing && !oc) { UI.toast('Orden no encontrada', 'error'); return; }
    const prodOpts = state.products.filter(p => p.Activo !== false && p.Activo !== 'FALSE').map(p => `<option value="${UI.esc(p.ID)}" data-proveedor="${UI.esc(p.ID_Proveedor || '')}" data-costo="${UI.esc(p.Costo_Unitario || 0)}" ${String(oc.ID_Producto) === String(p.ID) ? 'selected' : ''}>${UI.esc(p.Nombre)} (Stock: ${UI.esc(p.Stock)})</option>`).join('');
    const provOpts = state.proveedores.map(p => `<option value="${UI.esc(p.ID)}" ${String(oc.ID_Proveedor) === String(p.ID) ? 'selected' : ''}>${UI.esc(p.Nombre)}</option>`).join('');
    const body = `
      <form id="orden-form" class="form">
        <div class="form-group"><label>Producto *</label><select name="ID_Producto" class="input" required id="oc-producto"><option value="">Selecciona</option>${prodOpts}</select></div>
        <div class="form-group"><label>Proveedor</label><select name="ID_Proveedor" class="input" id="oc-proveedor"><option value="">Sin proveedor</option>${provOpts}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Cantidad *</label><input name="Cantidad" type="number" min="1" class="input" required value="${UI.esc(oc.Cantidad || '')}" /></div>
          <div class="form-group"><label>Costo Unitario</label><input name="Costo_Unitario" type="number" min="0" step="0.01" class="input" id="oc-costo" value="${UI.esc(oc.Costo_Unitario || 0)}" /></div>
        </div>
        <div class="form-group"><label>Notas</label><textarea name="Notas" class="input" rows="2">${UI.esc(oc.Notas || '')}</textarea></div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="oc-save-btn">${editing ? 'Guardar' : 'Crear'}</button>`;
    const { footer: f } = Modal.open({ title: editing ? 'Editar OC' : 'Nueva OC', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    document.getElementById('oc-producto').addEventListener('change', e => {
      const opt = e.target.options[e.target.selectedIndex];
      if (opt.dataset.proveedor) document.getElementById('oc-proveedor').value = opt.dataset.proveedor;
      if (opt.dataset.costo) document.getElementById('oc-costo').value = opt.dataset.costo;
    });
    f.querySelector('#oc-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('orden-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.Cantidad = Number(payload.Cantidad); payload.Costo_Unitario = Number(payload.Costo_Unitario) || 0;
      const btn = f.querySelector('#oc-save-btn'); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        if (editing) { payload.ID = oc.ID; await API.updateOrdenCompra(payload); UI.toast('OC actualizada', 'success'); }
        else { await API.createOrdenCompra(payload); UI.toast('OC creada', 'success'); }
        Modal.close(true); await loadAllData(); renderOrdenesTable();
      } catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = editing ? 'Guardar' : 'Crear'; }
    });
  }

  async function handleEnviarOC(id) {
    const ok = await Modal.confirm(`¿Enviar la orden ${id}?`, { confirmText: 'Enviar' }); if (!ok) return;
    try { await API.enviarOrdenCompra({ ID: id }); UI.toast('Orden enviada', 'success'); await loadAllData(); renderOrdenesTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }
  async function handleRecibirOC(id) {
    const ok = await Modal.confirm(`¿Marcar la orden ${id} como recibida?`, { confirmText: 'Recibir' }); if (!ok) return;
    try { await API.recibirOrdenCompra({ ID: id }); UI.toast('Orden recibida', 'success'); await loadAllData(); renderOrdenesTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }
  async function handleCancelarOC(id) {
    const ok = await Modal.confirm(`¿Cancelar la orden ${id}?`, { confirmText: 'Cancelar', danger: true }); if (!ok) return;
    try { await API.cancelarOrdenCompra({ ID: id }); UI.toast('Orden cancelada', 'success'); await loadAllData(); renderOrdenesTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }
  async function handleGenerarOC() {
    const ok = await Modal.confirm('¿Generar órdenes de compra automáticas para bajo stock?', { title: 'Auto-generar OC', confirmText: 'Generar' }); if (!ok) return;
    try { const r = await API.generarOrdenesAuto({}); UI.toast(r.mensaje || `Órdenes: ${r.count}`, r.count > 0 ? 'success' : 'info', 4000); await loadAllData(); if (Router.getCurrent() === 'ordenes') renderOrdenesTable(); if (Router.getCurrent() === 'dashboard') renderDashboard(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }

  function renderSolicitudes() { renderRoute('solicitudes'); renderRequestsTable(); }
  function renderRequestsTable() {
    const container = document.getElementById('requests-table-container');
    let filtered = state.requests;
    const f = state.filters;
    if (f.status) filtered = filtered.filter(r => r.Estado === f.status);
    if (f.desde) filtered = filtered.filter(r => new Date(r.Fecha) >= new Date(f.desde));
    if (f.hasta) filtered = filtered.filter(r => new Date(r.Fecha) <= new Date(f.hasta));
    if (!filtered.length) { UI.emptyState(container, { icon: '📝', title: 'Sin solicitudes' }); return; }

    const pg = UI.paginate(filtered, state.pagination.requests, 10); state.pagination.requests = pg.current;
    const columns = [
      { key: 'ID_Solicitud', label: 'ID' },
      { key: 'Fecha', label: 'Fecha', render: r => r.Fecha ? UI.esc(new Date(r.Fecha).toLocaleDateString()) : '—' },
      { label: 'Producto', render: r => {
        const p = state.products.find(x => String(x.ID) === String(r.ID_Producto));
        return UI.esc(p ? p.Nombre : r.ID_Producto);
      }},
      { key: 'ID_Bodega', label: 'Bodega', render: r => UI.esc(getBodegaName(r.ID_Bodega)) },
      { key: 'Cantidad', label: 'Cant.' },
      { key: 'Estado', label: 'Estado', render: r => {
        const m = { Pendiente: 'badge-warning', Aprobada: 'badge-success', Rechazada: 'badge-danger' };
        return `<span class="badge ${m[r.Estado] || 'badge-secondary'}">${UI.esc(r.Estado || '—')}</span>`;
      }},
      { key: 'ID_Usuario', label: 'Solicitante' },
      { label: 'Acciones', render: r => {
        if (r.Estado !== 'Pendiente') return '<span class="muted-sm">—</span>';
        return `<div class="row-actions" data-perm="admin"><button class="btn btn-sm btn-success" data-approve="${UI.esc(r.ID_Solicitud)}">✓</button><button class="btn btn-sm btn-danger" data-reject="${UI.esc(r.ID_Solicitud)}">✗</button></div>`;
      }}
    ];
    UI.renderTable(container, { columns, rows: pg.items });
    appendPagination(container, pg, 'requests', renderRequestsTable);
    container.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => handleUpdateStatus(b.dataset.approve, 'Aprobada')));
    container.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => handleUpdateStatus(b.dataset.reject, 'Rechazada')));
    Permissions.apply();
  }

  async function handleUpdateStatus(id, estado) {
    const ok = await Modal.confirm(`¿${estado === 'Aprobada' ? 'Aprobar' : 'Rechazar'} la solicitud ${id}?`, { confirmText: estado, danger: estado === 'Rechazada' }); if (!ok) return;
    try { await API.updateRequestStatus({ ID_Solicitud: id, Estado: estado, Aprobado_Por: (state.user && state.user.email) || 'sistema' }); UI.toast(`Solicitud ${estado.toLowerCase()}`, 'success'); await loadAllData(); renderRequestsTable(); } catch (err) { UI.toast('Error: ' + err.message, 'error'); }
  }

  function renderNuevaSolicitud() {
    renderRoute('nueva-solicitud');
    const select = document.getElementById('req-product');
    const disponibles = state.products.filter(p => Number(p.Stock) > 0 && p.Activo !== false && p.Activo !== 'FALSE');
    select.innerHTML = '<option value="">Selecciona un producto</option>' +
      disponibles.map(p => `<option value="${UI.esc(p.ID)}" data-stock="${UI.esc(p.Stock)}" data-bodega="${UI.esc(p.ID_Bodega)}">${UI.esc(p.Nombre)} [${UI.esc(getBodegaName(p.ID_Bodega))}] (Stock: ${UI.esc(p.Stock)})</option>`).join('');
    document.getElementById('request-form').reset(); document.getElementById('stock-hint').textContent = '';
  }
  function updateStockHint() {
    const s = document.getElementById('req-product'); const opt = s.options[s.selectedIndex]; const hint = document.getElementById('stock-hint');
    if (opt && opt.dataset.stock) { hint.textContent = `Disponible: ${opt.dataset.stock} unidades`; document.getElementById('req-quantity').max = opt.dataset.stock; }
    else { hint.textContent = ''; document.getElementById('req-quantity').removeAttribute('max'); }
  }
  async function handleCreateRequest(e) {
    e.preventDefault(); const form = e.target; const btn = form.querySelector('button[type="submit"]'); const opt = form.ID_Producto.options[form.ID_Producto.selectedIndex];
    const data = { ID_Producto: form.ID_Producto.value, Cantidad: Number(form.Cantidad.value), Comentarios: form.Comentarios.value, ID_Usuario: (state.user && state.user.email) || 'desconocido', ID_Bodega: (opt && opt.dataset.bodega) || '' };
    if (!data.ID_Producto || data.Cantidad < 1) { UI.toast('Completa los campos', 'warning'); return; }
    btn.disabled = true; btn.textContent = 'Enviando…';
    try { await API.createRequest(data); UI.toast('✅ Solicitud enviada', 'success'); form.reset(); await loadAllData(); Router.navigate('solicitudes'); }
    catch (err) { UI.toast('Error: ' + err.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Enviar Solicitud'; }
  }

  function renderMovimientos() { renderRoute('movimientos'); renderMovementsTable(); }
  function renderMovementsTable() {
    const container = document.getElementById('movements-table-container');
    let list = state.movements; if (state.filters.moveType) list = list.filter(m => m.Tipo === state.filters.moveType);
    if (!list.length) { UI.emptyState(container, { icon: '🔄', title: 'Sin movimientos' }); return; }
    UI.renderTable(container, {
      columns: [
        { key: 'ID', label: 'ID' },
        { key: 'Fecha', label: 'Fecha', render: r => r.Fecha ? UI.esc(new Date(r.Fecha).toLocaleString()) : '—' },
        { label: 'Producto', render: r => {
          const p = state.products.find(x => String(x.ID) === String(r.ID_Producto));
          return p ? `<a href="#/producto/${UI.esc(p.ID)}" style="color:var(--color-primary);text-decoration:underline">${UI.esc(p.Nombre)}</a>` : UI.esc(r.ID_Producto);
        }},
        { key: 'ID_Bodega', label: 'Bodega', render: r => UI.esc(getBodegaName(r.ID_Bodega)) },
        { key: 'Tipo', label: 'Tipo', render: r => {
          const m = { Entrada: 'badge-success', Salida: 'badge-warning', Ajuste: 'badge-info' };
          return `<span class="badge ${m[r.Tipo] || 'badge-secondary'}">${UI.esc(r.Tipo || '—')}</span>`;
        }},
        { key: 'Cantidad', label: 'Cant.' },
        { key: 'Stock_Antes', label: 'Antes' },
        { key: 'Stock_Despues', label: 'Después' },
        { key: 'Lote', label: 'Lote' },
        { key: 'Fecha_Vencimiento', label: 'Vence', render: r => r.Fecha_Vencimiento ? UI.esc(new Date(r.Fecha_Vencimiento).toLocaleDateString()) : '—' }
      ],
      rows: list.slice(0, 200)
    });
  }

  function openMovementForm(prefillProductId) {
    const opts = state.products.filter(p => p.Activo !== false && p.Activo !== 'FALSE').map(p => `<option value="${UI.esc(p.ID)}" data-stock="${UI.esc(p.Stock)}" data-bodega="${UI.esc(p.ID_Bodega)}" ${String(p.ID) === String(prefillProductId) ? 'selected' : ''}>${UI.esc(p.Nombre)} [${UI.esc(getBodegaName(p.ID_Bodega))}] (Stock: ${UI.esc(p.Stock)})</option>`).join('');
    const body = `
      <form id="movement-form" class="form">
        <div class="form-group"><label>Producto *</label><select name="ID_Producto" class="input" required><option value="">Selecciona</option>${opts}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Tipo *</label><select name="Tipo" class="input" id="move-type" required><option value="Entrada">Entrada</option><option value="Salida">Salida</option><option value="Ajuste">Ajuste</option></select></div>
          <div class="form-group"><label>Cantidad *</label><input name="Cantidad" type="number" min="1" class="input" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Costo Unitario (Entradas)</label><input name="Costo_Unitario" type="number" min="0" step="0.01" class="input" placeholder="Opcional" /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Lote (Opcional)</label><input name="Lote" class="input" placeholder="Ej: LOTE-2024-X" /></div>
          <div class="form-group"><label>Fecha de Vencimiento</label><input name="Fecha_Vencimiento" type="date" class="input" /></div>
        </div>
        <div class="form-group"><label>Motivo</label><input name="Motivo" class="input" placeholder="Compra, merma, corrección…" /></div>
        <div class="form-group"><label>Referencia</label><input name="Referencia" class="input" placeholder="Nº factura, OC, etc." /></div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="movement-save-btn">Registrar</button>`;
    const { footer: f } = Modal.open({ title: 'Registrar movimiento', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    f.querySelector('#movement-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('movement-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries());
      payload.Cantidad = Number(payload.Cantidad); if (payload.Costo_Unitario) payload.Costo_Unitario = Number(payload.Costo_Unitario);
      const btn = f.querySelector('#movement-save-btn'); btn.disabled = true; btn.textContent = 'Guardando…';
      try { const r = await API.createMovement(payload); UI.toast(`Movimiento OK. Stock: ${r.stockAntes} → ${r.stockDespues}`, 'success'); Modal.close(true); await loadAllData(); renderMovementsTable(); }
      catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Registrar'; }
    });
  }

  function openTransferForm() {
    const prods = state.products.filter(p => (p.Activo === true || p.Activo === 'TRUE') && Number(p.Stock) > 0);
    const opts = prods.map(p => `<option value="${UI.esc(p.ID)}" data-bodega="${UI.esc(p.ID_Bodega)}" data-stock="${UI.esc(p.Stock)}">${UI.esc(p.Nombre)} [${UI.esc(getBodegaName(p.ID_Bodega))}] — Stock: ${UI.esc(p.Stock)}</option>`).join('');
    const bods = state.bodegas.map(b => `<option value="${UI.esc(b.ID)}">${UI.esc(b.Nombre)}</option>`).join('');
    const body = `
      <form id="transfer-form" class="form">
        <div class="form-group"><label>Producto origen *</label><select name="ID_ProductoOrigen" class="input" required><option value="">Selecciona</option>${opts}</select></div>
        <div class="form-group"><label>Bodega destino *</label><select name="ID_BodegaDestino" class="input" required><option value="">Selecciona</option>${bods}</select></div>
        <div class="form-group"><label>Cantidad *</label><input name="Cantidad" type="number" min="1" class="input" required /></div>
        <div class="form-group"><label>Referencia</label><input name="Referencia" class="input" placeholder="Nº guía, remisión…" /></div>
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="transfer-save-btn">Transferir</button>`;
    const { footer: f } = Modal.open({ title: 'Transferir stock', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    f.querySelector('#transfer-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('transfer-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.Cantidad = Number(payload.Cantidad);
      const btn = f.querySelector('#transfer-save-btn'); btn.disabled = true; btn.textContent = 'Transfiriendo…';
      try { await API.transferStock(payload); UI.toast('Transferencia completada', 'success'); Modal.close(true); await loadAllData(); renderRoute(Router.getCurrent()); }
      catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = 'Transferir'; }
    });
  }

  function renderUsuarios() { renderRoute('usuarios'); renderUsersTable(); }
  function renderUsersTable() {
    const container = document.getElementById('users-table-container');
    const term = state.filters.searchUsers || '';
    const filtered = state.users.filter(u => { if (!term) return true; return (u.Email || '').toLowerCase().includes(term) || (u.Nombre || '').toLowerCase().includes(term) || (u.Rol || '').toLowerCase().includes(term); });
    if (!filtered.length) { UI.emptyState(container, { icon: '👥', title: 'Sin usuarios' }); return; }
    UI.renderTable(container, {
      columns: [
        { key: 'Email', label: 'Email' },
        { key: 'Nombre', label: 'Nombre' },
        { key: 'Rol', label: 'Rol', render: r => {
          const m = { superuser: 'badge-danger', admin: 'badge-success', bodega: 'badge-info', visualizador: 'badge-secondary', solicitante: 'badge-secondary' };
          let lbl = r.Rol === 'solicitante' ? 'visualizador' : r.Rol;
          return `<span class="badge ${m[lbl] || 'badge-secondary'}">${UI.esc(lbl || '—')}</span>`;
        }},
        { label: 'Estado', render: r => (r.Activo === false || r.Activo === 'FALSE') ? '<span class="badge badge-danger">Inactivo</span>' : '<span class="badge badge-success">Activo</span>' },
        { key: 'Ultimo_Acceso', label: 'Último acceso', render: r => r.Ultimo_Acceso ? UI.esc(new Date(r.Ultimo_Acceso).toLocaleDateString()) : '—' },
        { label: 'Acciones', render: r => `<div class="row-actions"><button class="btn btn-sm btn-ghost" data-edit-user="${UI.esc(r.Email)}">✏️</button><button class="btn btn-sm btn-danger" data-del-user="${UI.esc(r.Email)}">🗑</button></div>` }
      ],
      rows: filtered
    });
    container.querySelectorAll('[data-edit-user]').forEach(b => b.addEventListener('click', () => openUserForm(b.dataset.editUser)));
    container.querySelectorAll('[data-del-user]').forEach(b => b.addEventListener('click', () => handleDeleteUser(b.dataset.delUser)));
  }
  function openUserForm(email = null) {
    const editing = !!email; const u = editing ? state.users.find(x => x.Email === email) : {};
    if (editing && !u) { UI.toast('Usuario no encontrado', 'error'); return; }
    const body = `
      <form id="user-form" class="form">
        <div class="form-group"><label>Email *</label><input name="Email" type="email" class="input" required value="${UI.esc(u.Email || '')}" ${editing ? 'readonly' : ''} /></div>
        <div class="form-group"><label>Nombre</label><input name="Nombre" class="input" value="${UI.esc(u.Nombre || '')}" /></div>
        <div class="form-group"><label>Rol</label>
          <select name="Rol" class="input">
            <option value="visualizador" ${(u.Rol === 'visualizador' || u.Rol === 'solicitante') ? 'selected' : ''}>Visualizador (Solo lectura)</option>
            <option value="bodega" ${u.Rol === 'bodega' ? 'selected' : ''}>Bodega</option>
            <option value="admin" ${u.Rol === 'admin' ? 'selected' : ''}>Admin</option>
            <option value="superuser" ${u.Rol === 'superuser' ? 'selected' : ''}>Super User (Dev)</option>
          </select>
        </div>
        <div class="form-group"><label>Activo</label><select name="Activo" class="input"><option value="true" ${u.Activo !== false ? 'selected' : ''}>Sí</option><option value="false" ${u.Activo === false ? 'selected' : ''}>No</option></select></div>
        ${!editing ? `<div class="form-group"><label><input type="checkbox" id="send-invite" checked /> Enviar email de invitación</label></div>` : ''}
      </form>`;
    const footer = `<button class="btn btn-ghost" data-modal-cancel>Cancelar</button><button class="btn btn-primary" id="user-save-btn">${editing ? 'Guardar' : 'Invitar'}</button>`;
    const { footer: f } = Modal.open({ title: editing ? 'Editar usuario' : 'Invitar usuario', body, footer });
    f.querySelector('[data-modal-cancel]').addEventListener('click', () => Modal.close(true));
    f.querySelector('#user-save-btn').addEventListener('click', async () => {
      const form = document.getElementById('user-form'); if (!form.reportValidity()) return;
      const fd = new FormData(form); const payload = Object.fromEntries(fd.entries()); payload.Activo = payload.Activo === 'true';
      const sendInvite = document.getElementById('send-invite')?.checked;
      const btn = f.querySelector('#user-save-btn'); btn.disabled = true; btn.textContent = 'Guardando…';
      try {
        if (!editing && sendInvite) { payload.appUrl = window.location.origin; await API.inviteUser(payload); }
        else { await API.saveUser(payload); }
        UI.toast(editing ? 'Usuario actualizado' : 'Usuario invitado', 'success'); Modal.close(true); await loadAllData(); renderUsersTable();
      } catch (e) { UI.toast('Error: ' + e.message, 'error'); } finally { btn.disabled = false; btn.textContent = editing ? 'Guardar' : 'Invitar'; }
    });
  }
  async function handleDeleteUser(email) {
    const ok = await Modal.confirm(`¿Desactivar al usuario ${email}?`, { title: 'Desactivar', confirmText: 'Desactivar', danger: true }); if (!ok) return;
    try { await API.deleteUser({ Email: email }); UI.toast('Usuario desactivado', 'success'); await loadAllData(); renderUsersTable(); } catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }

  function renderAuditoria() { renderRoute('auditoria'); renderAuditTable(); }
  function renderAuditTable() {
    const container = document.getElementById('audit-table-container');
    const term = state.filters.searchAudit || '';
    let list = state.audit;
    if (term) { list = list.filter(a => (a.Usuario || '').toLowerCase().includes(term) || (a.Accion || '').toLowerCase().includes(term) || (a.Entidad || '').toLowerCase().includes(term)); }
    if (!list.length) { UI.emptyState(container, { icon: '📋', title: 'Sin registros' }); return; }
    UI.renderTable(container, {
      columns: [
        { key: 'Fecha', label: 'Fecha', render: r => r.Fecha ? UI.esc(new Date(r.Fecha).toLocaleString()) : '—' },
        { key: 'Usuario', label: 'Usuario' },
        { key: 'Accion', label: 'Acción', render: r => `<code>${UI.esc(r.Accion || '—')}</code>` },
        { key: 'Entidad', label: 'Entidad' },
        { key: 'Entidad_ID', label: 'ID' },
        { key: 'Detalle', label: 'Detalle', render: r => { const d = String(r.Detalle || ''); return UI.esc(d.length > 80 ? d.slice(0, 80) + '…' : d); } }
      ],
      rows: list.slice(0, 300)
    });
  }

  async function handleExportCSV() {
    try { const { csv, count } = await API.exportRequestsCSV(state.filters); if (!count) { UI.toast('No hay datos para exportar', 'warning'); return; } Exporter.downloadCSV(csv, `solicitudes-${Date.now()}.csv`); UI.toast(`Exportadas ${count} solicitudes`, 'success'); }
    catch (e) { UI.toast('Error: ' + e.message, 'error'); }
  }
  function handleExportPDF() {
    const cols = ['ID', 'Fecha', 'Producto', 'Bodega', 'Cantidad', 'Solicitante', 'Estado'];
    const rows = state.requests.map(r => { const p = state.products.find(x => String(x.ID) === String(r.ID_Producto)); return [r.ID_Solicitud, r.Fecha ? new Date(r.Fecha).toLocaleDateString() : '', p ? p.Nombre : r.ID_Producto, getBodegaName(r.ID_Bodega), r.Cantidad, r.ID_Usuario, r.Estado]; });
    Exporter.downloadPDF('Reporte de Solicitudes', cols, rows);
  }

  function debounce(fn, delay) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), delay); }; }
  function fileToBase64(file) { return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result.split(',')[1]); r.onerror = reject; r.readAsDataURL(file); }); }

  return { init, onLoginSuccess, onLogout, loadAllData, state };
})();

document.addEventListener('DOMContentLoaded', App.init);
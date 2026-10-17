const Permissions = (() => {
  let role = 'visualizador'; // Rol por defecto
  let active = false;

  function set(newRole, activo) {
    // Mapear 'solicitante' antiguo a 'visualizador' si existe
    if (newRole === 'solicitante') newRole = 'visualizador';
    role = newRole || 'visualizador';
    active = !!activo;
    apply();
  }

  function is(rol) { return role === rol; }
  function isAdmin() { return role === 'admin' || role === 'superuser'; }
  function isSuperUser() { return role === 'superuser'; }
  function canManageProducts() { return role === 'admin' || role === 'bodega' || role === 'superuser'; }
  function canApprove() { return role === 'admin' || role === 'superuser'; }
  function canSeeFinance() { return role === 'admin' || role === 'superuser'; }
  function isActive() { return active; }
  function getRole() { return role; }

  function apply() {
    // 1. Ocultar elementos según data-perm
    document.querySelectorAll('[data-perm]').forEach(el => {
      const required = el.dataset.perm.split(',').map(s => s.trim());
      
      // Si el elemento pide "admin" y somos "superuser", también se muestra.
      let visible = required.includes(role);
      if (!visible && role === 'superuser' && required.includes('admin')) visible = true;
      
      el.style.display = visible ? '' : 'none';
    });

    // 2. Mostrar badge del rol en topbar
    const badge = document.getElementById('role-badge');
    if (badge) {
      const labels = { superuser: 'Dev', admin: 'Admin', bodega: 'Bodega', visualizador: 'Lector' };
      const colors = { superuser: 'badge-danger', admin: 'badge-success', bodega: 'badge-info', visualizador: 'badge-secondary' };
      badge.textContent = labels[role] || role;
      badge.className = 'badge ' + (colors[role] || 'badge-secondary');
    }

    // 3. Ocultar el gráfico financiero si no es Admin/Superuser
    const financeChart = document.getElementById('finance-card-container');
    if (financeChart) {
      financeChart.style.display = canSeeFinance() ? 'block' : 'none';
    }
  }

  return { set, is, isAdmin, isSuperUser, canManageProducts, canApprove, canSeeFinance, isActive, getRole, apply };
})();
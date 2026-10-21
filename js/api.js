/**
 * Capa de comunicación con el backend de Google Apps Script
 */
const API = (() => {

  async function call(action, data = null) {
  if (!Auth.isAuthenticated()) throw new Error('No autenticado');

  // Renueva token si está por expirar (margen 5 min)
  try {
    await Auth.ensureFreshToken();
  } catch (e) {
    console.warn('No se pudo renovar token, se intenta igual:', e);
  }

  const payload = {
    action: action,
    data: data,
    actor: (Auth.getUser() && Auth.getUser().email) || 'desconocido',
    token: Auth.getToken()
  };

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      redirect: 'follow'
    });

    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

    const text = await response.text();
    let result;
    try { result = JSON.parse(text); }
    catch (e) { throw new Error('El servidor no devolvió JSON válido'); }
    if (result && result.error) throw new Error(result.error);

    return result;
  } catch (err) {
    console.error(`Error en acción "${action}":`, err);
    throw err;
  }
}

  return {
    // ===== Productos =====
    getProducts:    (f) => call('getProducts', f),
    createProduct:  (d) => call('createProduct', d),
    updateProduct:  (d) => call('updateProduct', d),
    deleteProduct:  (d) => call('deleteProduct', d),
    importProducts: (d) => call('importProducts', d),

    // ===== Bodegas =====
    getBodegas:   () => call('getBodegas'),
    saveBodega:   (d) => call('saveBodega', d),
    deleteBodega: (d) => call('deleteBodega', d),

    // ===== Proveedores =====
    getProveedores:  () => call('getProveedores'),
    saveProveedor:   (d) => call('saveProveedor', d),
    deleteProveedor: (d) => call('deleteProveedor', d),

    // ===== Órdenes de compra =====
    getOrdenesCompra:    (f) => call('getOrdenesCompra', f),
    createOrdenCompra:   (d) => call('createOrdenCompra', d),
    updateOrdenCompra:   (d) => call('updateOrdenCompra', d),
    enviarOrdenCompra:   (d) => call('enviarOrdenCompra', d),
    recibirOrdenCompra:  (d) => call('recibirOrdenCompra', d),
    cancelarOrdenCompra: (d) => call('cancelarOrdenCompra', d),
    generarOrdenesAuto:  (d) => call('generarOrdenesAuto', d),

    // ===== Solicitudes =====
    getRequests:         (f) => call('getRequests', f),
    createRequest:       (d) => call('createRequest', d),
    updateRequestStatus: (d) => call('updateRequestStatus', d),

    // ===== Dashboard =====
    getDashboardStats: (f) => call('getDashboardStats', f),

    // ===== Archivos =====
    uploadFile: (d) => call('uploadFile', d),

    // ===== Usuarios =====
    getUsers:    () => call('getUsers'),
    getUserRole: (d) => call('getUserRole', d),
    saveUser:    (d) => call('saveUser', d),
    deleteUser:  (d) => call('deleteUser', d),
    inviteUser:  (d) => call('inviteUser', d),
    touchUser:   (d) => call('touchUser', d),

    // ===== Extras =====
    exportRequestsCSV: (d) => call('exportRequestsCSV', d),
    sendNotification:  (d) => call('sendNotification', d),
    checkLowStock:     (d) => call('checkLowStock', d),

    // ===== Auditoría y movimientos =====
    getAudit:       (f) => call('getAudit', f),
    getMovements:   (f) => call('getMovements', f),
    createMovement: (d) => call('createMovement', d),

    // ===== Transferencias =====
    transferStock: (d) => call('transferStock', d),

    // ===== Eventos y Finanzas =====
    getEventos:        (f) => call('getEventos', f),
    createEvento:      (d) => call('createEvento', d),
    getEventoDetalle:  (d) => call('getEventoDetalle', d),
    deleteEvento:      (d) => call('deleteEvento', d),
    getFinanceStats:   (f) => call('getFinanceStats', f),

    // ===== Operaciones de Eventos (NUEVAS) =====
    checkDisponibilidad: (d) => call('checkDisponibilidad', d),
    despacharEvento:     (d) => call('despacharEvento', d),
    devolverEvento:      (d) => call('devolverEvento', d)
  };
})();
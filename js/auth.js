/**
 * Módulo de autenticación con Google Identity Services (GIS)
 * 
 * - Fuerza la selección de cuenta en cada login (prompt: 'select_account').
 * - Restaura sesiones previas si el token sigue siendo válido.
 * - Renueva tokens próximos a expirar.
 */

const Auth = (() => {
  let tokenClient = null;
  let accessToken = null;
  let userInfo = null;

  /**
   * Inicializa el cliente de OAuth de Google.
   * Espera a que GIS esté cargado (por el async/defer del script).
   */
  function init() {
    if (isGISReady()) {
      createTokenClient();
      return;
    }

    let attempts = 0;
    const maxAttempts = 100; // 10 segundos
    const interval = setInterval(() => {
      attempts++;
      if (isGISReady()) {
        clearInterval(interval);
        createTokenClient();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        console.error('Google Identity Services no se pudo cargar después de 10s.');
        if (window.UI && UI.toast) {
          UI.toast('No se pudo cargar el servicio de Google. Recarga la página.', 'error', 6000);
        }
      }
    }, 100);
  }

  function isGISReady() {
    return typeof google !== 'undefined' &&
           google.accounts &&
           google.accounts.oauth2 &&
           typeof google.accounts.oauth2.initTokenClient === 'function';
  }

  function createTokenClient() {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CONFIG.CLIENT_ID,
      scope: CONFIG.SCOPES,
      callback: handleTokenResponse,
      error_callback: (err) => {
        console.error('Error en OAuth:', err);
        if (err && err.type === 'popup_closed') return; // El usuario cerró la ventana
        UI.toast('Error de autenticación: ' + (err.message || err.type || 'desconocido'), 'error');
      }
    });
    console.log('✅ Google Identity Services inicializado');
  }

  async function handleTokenResponse(response) {
    if (!response || response.error) {
      UI.toast('Error al iniciar sesión: ' + ((response && response.error) || 'desconocido'), 'error');
      return;
    }

    accessToken = response.access_token;
    sessionStorage.setItem('access_token', accessToken);

    const expiresAt = Date.now() + (response.expires_in || 3600) * 1000;
    sessionStorage.setItem('access_token_expires', String(expiresAt));

    try {
      await loadUserInfo();
      App.onLoginSuccess(userInfo);
      try {
        await API.touchUser({ email: userInfo.email });
      } catch (e) {
        console.warn('No se pudo registrar último acceso:', e);
      }
    } catch (err) {
      console.error('Error tras el login:', err);
      UI.toast('Error al obtener el perfil del usuario', 'error');
    }
  }

  /**
   * Abre el popup de Google para iniciar sesión.
   * prompt: 'select_account' FUERZA a que siempre pregunte qué cuenta usar.
   */
  function login() {
    if (!tokenClient) {
      UI.toast('Servicio de autenticación no disponible. Recarga la página.', 'error');
      return;
    }
    try {
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      console.error('Error solicitando token:', err);
      UI.toast('No se pudo abrir el login de Google', 'error');
    }
  }

  function logout() {
    if (accessToken && isGISReady()) {
      google.accounts.oauth2.revoke(accessToken, () => {
        console.log('🔒 Token revocado');
      });
    }
    accessToken = null;
    userInfo = null;
    sessionStorage.removeItem('access_token');
    sessionStorage.removeItem('access_token_expires');
    App.onLogout();
  }

  async function loadUserInfo() {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) throw new Error(`No se pudo obtener la información del usuario (${res.status})`);
      userInfo = await res.json();
      return userInfo;
    } catch (err) {
      console.error('Error cargando usuario:', err);
      userInfo = { name: 'Usuario', email: '', picture: '' };
      return userInfo;
    }
  }

  async function tryRestoreSession() {
    const storedToken = sessionStorage.getItem('access_token');
    const expiresAt = Number(sessionStorage.getItem('access_token_expires') || 0);

    if (!storedToken) return false;
    if (expiresAt && Date.now() > expiresAt) {
      sessionStorage.removeItem('access_token');
      sessionStorage.removeItem('access_token_expires');
      return false;
    }

    accessToken = storedToken;
    try {
      await loadUserInfo();
      App.onLoginSuccess(userInfo);
      try { await API.touchUser({ email: userInfo.email }); } catch (e) {}
      return true;
    } catch (err) {
      console.warn('No se pudo restaurar la sesión:', err);
      accessToken = null;
      sessionStorage.removeItem('access_token');
      return false;
    }
  }

  /**
   * Renueva el token si está próximo a expirar (margen de 5 min)
   */
  async function ensureFreshToken() {
    const expiresAt = Number(sessionStorage.getItem('access_token_expires') || 0);
    const fiveMin = 5 * 60 * 1000;

    if (!accessToken || Date.now() > expiresAt - fiveMin) {
      console.warn('Token próximo a expirar, renovando…');
      return new Promise((resolve, reject) => {
        if (!tokenClient) return reject(new Error('Token client no disponible'));
        let done = false;
        const check = setInterval(() => {
          if (done) return;
          if (accessToken && Date.now() < Number(sessionStorage.getItem('access_token_expires') || 0) - fiveMin) {
            done = true;
            clearInterval(check);
            resolve(accessToken);
          }
        }, 200);
        setTimeout(() => { 
          if (!done) { 
            clearInterval(check); 
            reject(new Error('Timeout renovando token')); 
          } 
        }, 15000);
        
        // También forzamos select_account al renovar para evitar logins silenciosos
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      });
    }
    return accessToken;
  }

  // ===== API PÚBLICA =====
  function isAuthenticated() { return !!accessToken; }
  function getToken() { return accessToken; }
  function getUser() { return userInfo; }

  return {
    init,
    login,
    logout,
    isAuthenticated,
    getToken,
    getUser,
    tryRestoreSession,
    ensureFreshToken
  };
})();
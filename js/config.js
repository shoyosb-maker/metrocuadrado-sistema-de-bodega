/**
 * Configuración central de la aplicación
 * 
 * ⚠️ IMPORTANTE: 
 * - El CLIENT_ID es público por diseño (va en el frontend, es normal).
 * - El CLIENT SECRET NO debe ir nunca en el frontend. Para flujos OAuth
 *   con JavaScript puro (Google Identity Services) el secret no se usa.
 *   Guárdalo solo si en el futuro haces un backend con Node/Python.
 */

const CONFIG = {
  // ===== Google OAuth 2.0 =====
  CLIENT_ID: '525026378833-plloqmffak7bt5timmsa1mphnuthivvo.apps.googleusercontent.com',
  
  SCOPES: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.profile',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' '),

  // ===== Backend (Google Apps Script Web App) =====
  API_URL: 'https://script.google.com/macros/s/AKfycbypggZGjF_oKP2mhR5WJsoLmpFL61IVXSzqAhbQHrRIUv_j-16-0U33DlLsS_wEkYvp/exec',

  // ===== Rutas =====
  DEFAULT_ROUTE: 'dashboard',

  // ===== UI =====
  TOAST_DURATION: 3500,
  CACHE_TTL: 60 * 1000 // 1 minuto
};
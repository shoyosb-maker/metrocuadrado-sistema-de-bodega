/**
 * Router simple basado en hash
 */
const Router = (() => {
  const routes = {};
  let currentRoute = null;

  function register(path, handler) {
    routes[path] = handler;
  }

  function navigate(path) {
    window.location.hash = `#/${path}`;
  }

  function handle() {
    const hash = window.location.hash.replace(/^#\/?/, '') || CONFIG.DEFAULT_ROUTE;
    const [route, ...params] = hash.split('/');
    
    if (!routes[route]) {
      navigate(CONFIG.DEFAULT_ROUTE);
      return;
    }

    currentRoute = route;
    routes[route](params);
  }

  function init() {
    window.addEventListener('hashchange', handle);
    handle();
  }

  function getCurrent() { return currentRoute; }

  return { register, navigate, init, getCurrent };
})();
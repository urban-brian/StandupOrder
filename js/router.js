// js/router.js — Hash-based SPA router

const routes = new Map();
let currentRoute = null;

export function register(path, handler) {
  routes.set(path, handler);
}

export function navigate(path) {
  location.hash = path;
}

function matchRoute(hash) {
  // Remove leading #/
  const path = hash.replace(/^#\/?/, '') || '';
  // Exact match first
  if (routes.has('/' + path)) return { handler: routes.get('/' + path), params: {} };
  if (routes.has(path)) return { handler: routes.get(path), params: {} };
  // Prefix match for nested routes like /admin/recipes
  for (const [route, handler] of routes) {
    if (route.includes(':')) {
      const routeParts = route.split('/');
      const pathParts = ('/' + path).split('/');
      if (routeParts.length !== pathParts.length) continue;
      const params = {};
      let match = true;
      for (let i = 0; i < routeParts.length; i++) {
        if (routeParts[i].startsWith(':')) {
          params[routeParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
        } else if (routeParts[i] !== pathParts[i]) {
          match = false; break;
        }
      }
      if (match) return { handler, params };
    }
  }
  return null;
}

export function start() {
  async function handleRoute() {
    const hash = location.hash || '#/';
    const match = matchRoute(hash);
    if (match) {
      currentRoute = hash;
      try {
        await match.handler(match.params);
      } catch (e) {
        console.error('Route error:', e);
      }
    } else {
      // Default to landing
      navigate('/');
    }
  }

  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

export function getCurrentRoute() { return currentRoute; }

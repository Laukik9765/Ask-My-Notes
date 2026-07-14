/**
 * router.js — Minimal History-API client router (~40 lines core)
 * Maps URL paths to page module loaders and handles navigation.
 */

const routes = {};
let currentPath = null;
let viewContainer = null;
let onNavigate = null;

/**
 * Register a route.
 * @param {string} path  - URL path (e.g. '/', '/chat')
 * @param {() => Promise<{render: (container: HTMLElement) => void}>} loader
 */
export function addRoute(path, loader) {
  routes[path] = loader;
}

/**
 * Navigate to a path using the History API.
 * @param {string} path
 * @param {boolean} [replace=false] - use replaceState instead of pushState
 */
export function navigate(path, replace = false) {
  if (path === currentPath) return;
  if (replace) {
    history.replaceState(null, '', path);
  } else {
    history.pushState(null, '', path);
  }
  renderRoute(path);
}

/**
 * Resolve the current path and render the matching page.
 */
async function renderRoute(path) {
  currentPath = path;

  // Exact match first, then strip query/hash, then fallback to '/'
  let loader = routes[path] || routes[path.split('?')[0].split('#')[0]];
  if (!loader) loader = routes['/'];

  if (!viewContainer) {
    viewContainer = document.getElementById('view-container');
  }

  // Signal navigation
  if (onNavigate) onNavigate(path);

  try {
    viewContainer.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;color:var(--text-secondary);font-size:var(--text-sm);">Loading…</div>';
    const mod = await loader();
    viewContainer.innerHTML = '';
    await mod.render(viewContainer);
  } catch (err) {
    console.error('[Router] Failed to render route', path, err);
    viewContainer.innerHTML = `<div style="padding:48px;text-align:center;color:var(--danger);">
      <div style="font-size:24px;margin-bottom:8px;">⚠️</div>
      <div>Failed to load page: ${err.message}</div>
    </div>`;
  }
}

/**
 * Initialise the router.
 * @param {{ onNavigate?: (path: string) => void }} opts
 */
export function initRouter(opts = {}) {
  viewContainer = document.getElementById('view-container');
  onNavigate = opts.onNavigate || null;

  // Intercept popstate (back/forward)
  window.addEventListener('popstate', () => renderRoute(location.pathname));

  // Intercept all [data-route] attribute clicks globally
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-route]');
    if (target) {
      e.preventDefault();
      navigate(target.dataset.route);
    }
  });

  // Render the initial route
  renderRoute(location.pathname);
}

/**
 * Returns the current active path.
 */
export function getCurrentPath() {
  return currentPath;
}

/**
 * router.js — Hash-based client router
 * Maps URL hash paths (e.g. #/chat) to page module loaders and handles navigation.
 * Prevents 404 errors on server refresh.
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
 * Navigate to a path.
 * @param {string} path
 * @param {boolean} [replace=false] - use replace instead of push
 */
export function navigate(path, replace = false) {
  const hashPath = path.startsWith('/') ? '#' + path : path;
  if (replace) {
    location.replace(hashPath);
  } else {
    location.hash = hashPath;
  }
}

/**
 * Resolve the current path and render the matching page.
 */
async function renderRoute(hash) {
  // Normalize hash path to standard format (e.g., '#/chat?id=123' -> '/chat?id=123')
  let path = hash;
  if (path.startsWith('#')) path = path.slice(1);
  if (!path.startsWith('/')) path = '/' + path;

  // Extract base path for matching routes (strip query parameters)
  const base = path.split('?')[0].split('#')[0];
  let loader = routes[path] || routes[base];
  if (!loader) loader = routes['/'];

  currentPath = path;

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

  // Listen to hashchange events (popstate is not needed for hash routing)
  window.addEventListener('hashchange', () => {
    renderRoute(location.hash || '/');
  });

  // Intercept all [data-route] attribute clicks globally
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-route]');
    if (target) {
      e.preventDefault();
      navigate(target.dataset.route);
    }
  });

  // Render the initial route based on the current hash
  renderRoute(location.hash || '/');
}

/**
 * Returns the current active path.
 */
export function getCurrentPath() {
  return currentPath;
}

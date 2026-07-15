/**
 * main.js — App bootstrap (Section 6.1)
 * Initialises: theme, state from storage, router, nav rail, KB switcher,
 * keyboard shortcuts, service worker, and command palette.
 */

import { getState, setState, subscribe } from './state/store.js';
import { addRoute, initRouter, navigate, getCurrentPath } from './router.js';
import { openDB, getAllKnowledgeBases, getAllSettings } from './lib/vectorStore.js';
import { initShortcuts } from './lib/shortcuts.js';
import { openCommandPalette, closeCommandPalette } from './components/CommandPalette.js';
import { toast } from './components/Toast.js';

/* ─── Register routes ────────────────────────────────────── */
addRoute('/',        () => import('./pages/dashboard.js'));
addRoute('/chat',    () => import('./pages/chat.js'));
addRoute('/upload',  () => import('./pages/upload.js'));
addRoute('/kb',      () => import('./pages/kbManager.js'));
addRoute('/settings',() => import('./pages/settings.js'));
addRoute('/about',   () => import('./pages/about.js'));

/* ─── Bootstrap ──────────────────────────────────────────── */
async function bootstrap() {
  // 1. Open IndexedDB
  await openDB().catch((err) => {
    console.error('IndexedDB failed to open:', err);
    toast.error('Storage error', 'Could not open local database. Some features may not work.');
  });

  // 2. Restore persisted settings
  const stored = await getAllSettings().catch(() => ({}));
  const kbs    = await getAllKnowledgeBases().catch(() => []);
  const savedKbId = localStorage.getItem('activeKbId');

  setState({
    knowledgeBases: kbs,
    activeKbId:     (savedKbId && kbs.some((k) => k.id === savedKbId)) ? savedKbId : (kbs[0]?.id || null),
    settings: {
      provider:      stored.provider      || 'ollama',
      ollamaModel:   stored.ollamaModel   || 'llama3.2:3b',
      ollamaUrl:     stored.ollamaUrl     || 'http://localhost:11434',
      geminiKey:     stored.geminiKey     || '',
      geminiModel:   stored.geminiModel   || 'gemini-1.5-flash',
      topK:          stored.topK          ?? 5,
      threshold:     (stored.threshold === 0.35 || stored.threshold === 0.25 || stored.threshold === undefined) ? 0.20 : stored.threshold,
      chunkSize:     stored.chunkSize     ?? 2000,
      chunkOverlap:  stored.chunkOverlap  ?? 300,
      contextBudget: stored.contextBudget ?? 6000,
      maxFileSize:   stored.maxFileSize   ?? 26214400,
    },
  });

  // 3. Theme (from localStorage, then prefers-color-scheme)
  const savedTheme = localStorage.getItem('theme') || 'system';
  applyTheme(savedTheme);
  setState({ theme: savedTheme });

  // 4. Populate nav KB switcher
  populateNavKbSelect();
  subscribe(() => {
    populateNavKbSelect();
  });

  // 5. Init router
  initRouter({
    onNavigate: (path) => {
      updateActiveNav(path);
      updateTopbarTitle(path);
      // Restore landing page main layout
      const isLanding = path === '/landing';
      const navRail   = document.getElementById('nav-rail');
      const mainContent = document.getElementById('main-content');
      const topbar    = document.getElementById('topbar');
      const mobileNav = document.getElementById('mobile-nav');
      if (navRail)    navRail.style.display    = isLanding ? 'none' : '';
      if (mainContent) mainContent.style.marginLeft = isLanding ? '0' : '';
      if (topbar)     topbar.style.display     = isLanding ? 'none' : '';
      if (mobileNav)  mobileNav.style.display  = isLanding ? 'none' : '';
    },
  });

  // 6. Wire nav rail controls
  wireNavRail();

  // 7. Keyboard shortcuts
  initShortcuts({
    openSearch:    () => openCommandPalette(),
    closeAll:      () => {
      closeCommandPalette();
      document.getElementById('context-panel')?.classList.remove('open');
      // Close any open dialogs
      document.querySelectorAll('dialog[open]').forEach((d) => {
        if (d.id !== 'confirm-dialog' && d.id !== 'command-palette-dialog') d.close();
      });
    },
    newChat:       () => navigate('/chat?new=1'),
    toggleSidebar: () => {
      const rail = document.getElementById('nav-rail');
      rail?.classList.toggle('collapsed');
      const main = document.getElementById('main-content');
      main?.classList.toggle('rail-collapsed');
    },
  });

  // 8. Search button
  document.getElementById('search-btn')?.addEventListener('click', openCommandPalette);

  // 9. Service Worker
  registerServiceWorker();

  // 10. Mobile menu
  wireMobileMenu();

  // 11. Responsive: show mobile menu button on small screens
  handleResponsive();
  window.addEventListener('resize', handleResponsive);
}

/* ─── Theme ──────────────────────────────────────────────── */

function applyTheme(value) {
  const effective = value === 'system'
    ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
    : value;
  document.documentElement.setAttribute('data-theme', effective);
  updateThemeIcons(effective);

  // Update highlight.js theme
  const hlTheme = document.getElementById('hljs-theme');
  if (hlTheme) {
    hlTheme.href = effective === 'light'
      ? 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css'
      : 'https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github-dark.min.css';
  }
}

function updateThemeIcons(effective) {
  const dark  = document.getElementById('theme-icon-dark');
  const light = document.getElementById('theme-icon-light');
  const label = document.getElementById('theme-label');
  if (dark)  dark.style.display  = effective === 'dark'  ? 'block' : 'none';
  if (light) light.style.display = effective === 'light' ? 'block' : 'none';
  if (label) label.textContent   = effective === 'dark'  ? 'Light mode' : 'Dark mode';
}

/* ─── Nav rail ───────────────────────────────────────────── */

function wireNavRail() {
  // Collapse/expand button
  document.getElementById('rail-collapse-btn')?.addEventListener('click', () => {
    document.getElementById('nav-rail')?.classList.toggle('collapsed');
    document.getElementById('main-content')?.classList.toggle('rail-collapsed');
  });

  // Theme toggle button
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    const current  = getState().theme;
    const themeMap = { dark: 'light', light: 'system', system: 'dark' };
    const next     = themeMap[current] || 'dark';
    applyTheme(next);
    setState({ theme: next });
    localStorage.setItem('theme', next);
  });

  // KB switcher
  document.getElementById('nav-kb-select')?.addEventListener('change', (e) => {
    const kbId = e.target.value;
    if (!kbId) return;
    setState({ activeKbId: kbId });
    localStorage.setItem('activeKbId', kbId);
    // If on chat page, reload it
    if (getCurrentPath() === '/chat') navigate('/chat');
  });
}

function populateNavKbSelect() {
  const sel = document.getElementById('nav-kb-select');
  if (!sel) return;
  const { knowledgeBases, activeKbId } = getState();
  sel.innerHTML = '<option value="">— Select KB —</option>';
  knowledgeBases.forEach((kb) => {
    const opt = document.createElement('option');
    opt.value = kb.id;
    opt.textContent = kb.name;
    if (kb.id === activeKbId) opt.selected = true;
    sel.appendChild(opt);
  });
}

/* ─── Active nav ─────────────────────────────────────────── */

const routeLabels = {
  '/':        'Dashboard',
  '/chat':    'Chat',
  '/upload':  'Upload',
  '/kb':      'Knowledge Base',
  '/settings':'Settings',
  '/about':   'About',
};

function updateActiveNav(path) {
  document.querySelectorAll('.nav-link[data-route], .mobile-nav-item[data-route]').forEach((el) => {
    const route = el.dataset.route;
    const match = path === route || (route !== '/' && path.startsWith(route));
    el.classList.toggle('active', match);
    el.setAttribute('aria-current', match ? 'page' : 'false');
  });
}

function updateTopbarTitle(path) {
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = routeLabels[path] || routeLabels['/'];
}

/* ─── Mobile menu ────────────────────────────────────────── */

function wireMobileMenu() {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const navRail = document.getElementById('nav-rail');
  const overlay = document.getElementById('nav-overlay');

  menuBtn?.addEventListener('click', () => {
    navRail?.classList.toggle('mobile-open');
    overlay?.classList.toggle('visible');
  });

  overlay?.addEventListener('click', () => {
    navRail?.classList.remove('mobile-open');
    overlay.classList.remove('visible');
  });
}

function handleResponsive() {
  const isMobile = window.innerWidth < 1024;
  const menuBtn  = document.getElementById('mobile-menu-btn');
  if (menuBtn) menuBtn.style.display = isMobile ? 'flex' : 'none';
}

/* ─── Service Worker ─────────────────────────────────────── */

function registerServiceWorker() {
  // Disable Service Worker on localhost/127.0.0.1 for easier local development and update recovery
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    console.log('[SW] Bypassed for local development.');
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        for (const reg of regs) {
          reg.unregister().then(() => console.log('[SW] Unregistered existing worker.'));
        }
      });
    }
    if ('caches' in window) {
      caches.keys().then((keys) => {
        for (const key of keys) {
          caches.delete(key).then(() => console.log('[Cache] Deleted:', key));
        }
      });
    }
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      .then((reg) => {
        console.log('[SW] Registered, scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[SW] Registration failed:', err);
      });
  }
}

/* ─── Start ──────────────────────────────────────────────── */

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal error:', err);
  document.getElementById('view-container').innerHTML = `
    <div style="padding:48px;text-align:center;color:var(--danger)">
      <div style="font-size:24px;margin-bottom:8px">⚠️</div>
      <strong>Application failed to start</strong><br>
      <span style="font-size:14px;color:var(--text-secondary)">${err.message}</span>
    </div>`;
});

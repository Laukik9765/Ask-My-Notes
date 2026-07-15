/**
 * service-worker.js — App shell + CDN cache strategy (Section 9, Section 6.7)
 * Precaches the app shell and caches CDN resources on first use.
 * After first load, the full ingestion/retrieval pipeline works offline.
 */

const CACHE_VERSION = 'notesmind-v7';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const CDN_CACHE       = `${CACHE_VERSION}-cdn`;

const APP_SHELL_FILES = [
  '/',
  '/index.html',
  '/styles/tokens.css',
  '/styles/base.css',
  '/styles/layout.css',
  '/styles/components/button.css',
  '/styles/components/card.css',
  '/styles/components/chat-bubble.css',
  '/styles/components/dialog.css',
  '/styles/components/toast.css',
  '/styles/components/dropzone.css',
  '/styles/components/badge.css',
  '/styles/components/table.css',
  '/styles/pages/landing.css',
  '/styles/pages/dashboard.css',
  '/styles/pages/chat.css',
  '/styles/pages/settings.css',
  '/styles/pages/kb-manager.css',
  '/styles/pages/about.css',
  '/src/main.js',
  '/src/router.js',
  '/src/state/store.js',
  '/src/lib/vectorStore.js',
  '/src/lib/uploadQueue.js',
  '/src/lib/sanitizer.js',
  '/src/lib/exportChat.js',
  '/src/lib/shortcuts.js',
  '/src/lib/parsers/pdfParser.js',
  '/src/lib/parsers/docxParser.js',
  '/src/lib/parsers/txtParser.js',
  '/src/lib/parsers/markdownParser.js',
  '/src/lib/llm/OllamaProvider.js',
  '/src/lib/llm/GeminiProvider.js',
  '/src/lib/llm/RetrievalOnlyProvider.js',
  '/src/rag/ragEngine.js',
  '/src/rag/chunker.js',
  '/src/rag/similarity.js',
  '/src/rag/promptBuilder.js',
  '/src/workers/embedding.worker.js',
  '/src/pages/dashboard.js',
  '/src/pages/chat.js',
  '/src/pages/upload.js',
  '/src/pages/kbManager.js',
  '/src/pages/settings.js',
  '/src/pages/about.js',
  '/src/components/Toast.js',
  '/src/components/ConfirmDialog.js',
  '/src/components/CommandPalette.js',
  '/manifest.webmanifest',
];

// CDN resources — cached on first fetch, served from cache thereafter
const CDN_ORIGINS = [
  'cdn.jsdelivr.net',
  'huggingface.co',
];

/* ─── Install ────────────────────────────────────────────── */
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      cache.addAll(APP_SHELL_FILES).catch((err) => {
        console.warn('[SW] Some shell files failed to cache:', err);
      })
    ).then(() => self.skipWaiting())
  );
});

/* ─── Activate ───────────────────────────────────────────── */
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('notesmind-') && k !== APP_SHELL_CACHE && k !== CDN_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ─── Fetch ──────────────────────────────────────────────── */
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Skip non-GET and chrome-extension requests
  if (e.request.method !== 'GET' || url.protocol === 'chrome-extension:') return;

  // Ollama API — never intercept (must go to localhost)
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return;

  // CDN resources — cache-first with network fallback
  if (CDN_ORIGINS.some((origin) => url.hostname.includes(origin))) {
    e.respondWith(cdnFirst(e.request));
    return;
  }

  // App shell — network-first with cache fallback
  if (url.origin === self.location.origin) {
    e.respondWith(networkFirst(e.request));
    return;
  }
});

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const fallback = await caches.match('/index.html');
      if (fallback) return fallback;
    }
    return new Response('Offline', { status: 503 });
  }
}

async function cdnFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CDN_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('CDN resource unavailable offline', { status: 503 });
  }
}

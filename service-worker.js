// service-worker.js — ChemReact PWA offline shell.
// Cache-first strategy for app-shell + JSON. Network-first for HTML navigations.
// Cross-origin requests (e.g. three.js CDN) fall through to the network.
//
// Bump CACHE_VERSION whenever the shell list below changes — the activate handler
// wipes any cache whose name doesn't match, which forces a fresh fetch on update.

const CACHE_VERSION = 'chemreact-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './main.js',
  // styles
  './styles/tokens.css',
  './styles/figma.css',
  './styles/base.css',
  './styles/primitives.css',
  './styles/screens.css',
  './styles/components.css',
  './styles/screens/splash.css',
  './styles/screens/home.css',
  './styles/screens/scan.css',
  './styles/screens/reaction.css',
  './styles/screens/library.css',
  './styles/screens/elementDetail.css',
  './styles/screens/journal.css',
  // data
  './data/elements.json',
  './data/compounds.json',
  './data/reactions.json',
  './data/molecules.json',
  // icons
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-icon.png',
  './assets/icons/icon.svg'
  // three.js CDN — intentionally NOT cached, falls through to network
];

// ── INSTALL ───────────────────────────────────────────────────────────────
// Pre-cache the app shell. We use individual cache.put calls inside
// Promise.allSettled so that ONE missing/404 asset doesn't abort the whole
// install — the SW will still activate with whatever it managed to cache.
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_VERSION);
    const results = await Promise.allSettled(
      APP_SHELL.map(async (url) => {
        try {
          const res = await fetch(url, { cache: 'reload' });
          if (!res || !res.ok) throw new Error(`bad response ${res && res.status}`);
          await cache.put(url, res.clone());
        } catch (err) {
          // Swallow per-asset errors so install can still finish.
          console.warn('[sw] failed to pre-cache', url, err);
          throw err;
        }
      })
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed) console.warn(`[sw] install: ${failed}/${APP_SHELL.length} assets failed to cache`);
    await self.skipWaiting();
  })());
});

// ── ACTIVATE ──────────────────────────────────────────────────────────────
// Wipe any caches that aren't the current version, then claim open clients
// so this SW controls existing tabs immediately.
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── FETCH ─────────────────────────────────────────────────────────────────
// - Same-origin static assets: cache-first, fall back to network, then cache.
// - Same-origin HTML navigations: network-first, fall back to cached index.
// - Cross-origin (CDN, etc.): network-first, fall back to cache if we have it.
// - Skip non-http(s) schemes entirely (chrome-extension://, file://, blob:, etc.).
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET. POST/PUT/etc. always hit the network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip non-http(s) schemes (chrome-extension, file, data, blob, etc.).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    // Network-first for HTML so users get fresh content when online,
    // but still get the app shell offline.
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE_VERSION);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req) ||
                       await caches.match('./index.html') ||
                       await caches.match('./');
        return cached || new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })());
    return;
  }

  if (isSameOrigin) {
    // Cache-first for same-origin static assets.
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) return cached;
      try {
        const fresh = await fetch(req);
        // Only cache successful basic responses.
        if (fresh && fresh.ok && fresh.type !== 'opaque') {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(req, fresh.clone()).catch(() => {});
        }
        return fresh;
      } catch (err) {
        // Final graceful failure.
        return new Response('', { status: 504, statusText: 'Offline' });
      }
    })());
    return;
  }

  // Cross-origin (e.g. three.js CDN): network-first, cache fallback if any.
  event.respondWith((async () => {
    try {
      return await fetch(req);
    } catch {
      const cached = await caches.match(req);
      if (cached) return cached;
      return new Response('', { status: 504, statusText: 'Offline (cross-origin)' });
    }
  })());
});

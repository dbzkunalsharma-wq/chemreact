// service-worker.js — ChemReact PWA offline shell.
// Strategy summary:
//   - App shell (HTML, JS, CSS, icons): cache-first w/ network fallback.
//   - Data JSON (./data/*.json):        stale-while-revalidate.
//   - CDN libs (Three.js, MindAR):      network-first w/ cache fallback.
//   - HTML navigations:                 network-first w/ cached index fallback.
//   - Cross-origin fonts (Google Fonts): stale-while-revalidate.
//
// Bump CACHE_VERSION whenever the shell list below changes — the activate handler
// wipes any cache whose name doesn't match, which forces a fresh fetch on update.
//
// Counterpart in main.js: on localhost the SW is auto-unregistered so dev edits
// never get masked by a stale shell. Anything below assumes a deployed origin.

const CACHE_VERSION = 'chemreact-v3';
const RUNTIME_CACHE = 'chemreact-runtime-v3';
const CDN_CACHE     = 'chemreact-cdn-v3';

// All same-origin assets the PWA needs to launch offline. JSON data files are
// listed here too so the first visit primes them — subsequent visits use
// stale-while-revalidate to keep them current.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './main.js',

  // styles — flat
  './styles/tokens.css',
  './styles/figma.css',
  './styles/base.css',
  './styles/primitives.css',
  './styles/screens.css',
  './styles/components.css',

  // styles — per-screen (loaded via @import barrel)
  './styles/screens/splash.css',
  './styles/screens/home.css',
  './styles/screens/scan.css',
  './styles/screens/reaction.css',
  './styles/screens/library.css',
  './styles/screens/elementDetail.css',
  './styles/screens/journal.css',
  './styles/screens/onboarding.css',
  './styles/screens/cardAR.css',
  './styles/screens/_glassOverrides.css',

  // styles — per-component (loaded via @import barrel)
  './styles/components/bloomBg.css',
  './styles/components/mascot.css',
  './styles/components/mascotBubble.css',
  './styles/components/confetti.css',
  './styles/components/levelUpOverlay.css',
  './styles/components/glitchReveal.css',
  './styles/components/periodicTile.css',

  // core
  './core/state.js',
  './core/eventBus.js',
  './core/nav.js',
  './core/trackerMock.js',
  './core/trackerMindAR.js',
  './core/IAudio.js',
  './core/ITracker.js',
  './core/audioBridge.js',
  './core/audioFile.js',
  './core/audioMock.js',
  './core/cardRenderer.js',
  './core/demoMode.js',
  './core/mindARSession.js',
  './core/moleculeRenderer.js',
  './core/ARTransformProvider.js',
  './core/arTransformMindAR.js',
  './core/arTransformMock.js',
  './core/arBootstrap.js',

  // screens
  './screens/splash.js',
  './screens/home.js',
  './screens/scan.js',
  './screens/reaction.js',
  './screens/library.js',
  './screens/elementDetail.js',
  './screens/journal.js',
  './screens/onboarding.js',
  './screens/cardAR.js',

  // components
  './components/moleculeViewer.js',
  './components/toast.js',
  './components/devPanel.js',
  './components/bottomNav.js',
  './components/celebration.js',
  './components/bloomBg.js',
  './components/cardARView.js',
  './components/chemAsciiBg.js',
  './components/confetti.js',
  './components/elementChip.js',
  './components/glitchReveal.js',
  './components/levelUpOverlay.js',
  './components/mascot.js',
  './components/mascotBubble.js',
  './components/molMark.js',
  './components/periodicTile.js',
  './components/reactionCard.js',

  // primitives
  './components/primitives/index.js',
  './components/primitives/Button.js',
  './components/primitives/Card.js',
  './components/primitives/IconButton.js',
  './components/primitives/Input.js',
  './components/primitives/Layout.js',
  './components/primitives/Pill.js',
  './components/primitives/Text.js',

  // 3d
  './3d/effectsManager.js',
  './3d/materialFactory.js',
  './3d/animators/index.js',
  './3d/animators/attract.js',
  './3d/animators/breathe.js',
  './3d/animators/drift.js',
  './3d/animators/glow.js',
  './3d/animators/jitter.js',
  './3d/animators/ripple.js',
  './3d/animators/rotate.js',
  './3d/animators/shimmer.js',
  './3d/animators/spark.js',
  './3d/animators/sparkle.js',
  './3d/effects/IEffect.js',
  './3d/effects/index.js',
  './3d/effects/crystalSparkle.js',
  './3d/effects/cymaticBloom.js',
  './3d/effects/dust.js',
  './3d/effects/flame.js',
  './3d/effects/gasBubble.js',
  './3d/effects/glowPulse.js',
  './3d/effects/shimmer.js',
  './3d/effects/smoke.js',
  './3d/effects/sparks.js',
  './3d/effects/waterRipple.js',
  './3d/materials/crystal.js',
  './3d/materials/glass.js',
  './3d/materials/metal.js',
  './3d/materials/plasma.js',

  // data
  './data/elements.json',
  './data/compounds.json',
  './data/reactions.json',
  './data/molecules.json',

  // mindAR target manifest
  './assets/targets/index.json',

  // icons
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/maskable-icon.png',
  './assets/icons/icon.svg'
];

// Hosts whose responses we treat as CDN libraries (network-first, cache fallback).
const CDN_HOSTS = [
  'cdn.jsdelivr.net',
  'unpkg.com',
  'cdnjs.cloudflare.com'
];

const FONT_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

// ── INSTALL ───────────────────────────────────────────────────────────────
// Pre-cache the app shell. Each asset is fetched individually inside an
// allSettled so a single 404 doesn't abort the whole install — the SW will
// still activate with whatever was cacheable.
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
// Wipe any caches that aren't part of the current version set, then claim
// open clients so this SW controls existing tabs immediately.
self.addEventListener('activate', (event) => {
  const KEEP = new Set([CACHE_VERSION, RUNTIME_CACHE, CDN_CACHE]);
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !KEEP.has(k)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

// ── MESSAGE ───────────────────────────────────────────────────────────────
// Allow the page to trigger an immediate skipWaiting (used for "update
// available" prompts in main.js if/when one is added).
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── FETCH STRATEGIES ──────────────────────────────────────────────────────

// stale-while-revalidate: respond from cache instantly, refresh in background.
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type !== 'opaque') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  }).catch(() => null);
  return cached || network || new Response('', { status: 504, statusText: 'Offline' });
}

// network-first with cache fallback (used for CDN libs + HTML navigations).
async function networkFirst(req, cacheName, opts = {}) {
  const cache = await caches.open(cacheName);
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type !== 'opaque') {
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    const cached = await cache.match(req) || (opts.fallback && await caches.match(opts.fallback));
    return cached || new Response('', { status: 504, statusText: 'Offline' });
  }
}

// cache-first with network fallback + revalidation (used for the app shell).
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh && fresh.ok && fresh.type !== 'opaque') {
      const cache = await caches.open(cacheName);
      cache.put(req, fresh.clone()).catch(() => {});
    }
    return fresh;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // GET only — POST/PUT/etc. always hit the network.
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip non-http(s) schemes (chrome-extension, file, data, blob, etc.).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isNavigation = req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  // 1) HTML navigations: network-first, fall back to cached index.
  if (isNavigation) {
    event.respondWith(networkFirst(req, CACHE_VERSION, { fallback: './index.html' }));
    return;
  }

  // 2) Same-origin JSON data: stale-while-revalidate.
  if (isSameOrigin && /\/data\/.+\.json$/.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
    return;
  }

  // 3) Same-origin static shell: cache-first.
  if (isSameOrigin) {
    event.respondWith(cacheFirst(req, CACHE_VERSION));
    return;
  }

  // 4) CDN libraries (Three.js, MindAR, etc.): network-first w/ cache fallback.
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(networkFirst(req, CDN_CACHE));
    return;
  }

  // 5) Google Fonts: stale-while-revalidate (cheap repeat visits).
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, CDN_CACHE));
    return;
  }

  // 6) Anything else cross-origin: network-first w/ cache fallback.
  event.respondWith(networkFirst(req, CDN_CACHE));
});

// arBootstrap.js — single decision point for "real MindAR vs mock" at app boot.
//
// Behaviour:
//   1. URL override: `?ar=1` forces real, `?ar=0` forces mock — overrides
//      auto-detect.
//   2. Auto-detect (no flag): HEAD-fetch `./assets/targets/cards.mind`. If 200,
//      use real MindAR. Otherwise mock.
//   3. Fail-safe: if real AR is selected but anything goes wrong (file 404,
//      MindAR CDN blocked, index.json missing), surface a toast via
//      bus.emit(EVENTS.TOAST, ...) and fall back to mock without crashing.
//
// The chosen tracker + arTransform are returned and wired into deps once.
// Screens NEVER import implementations directly — they read deps.tracker /
// deps.arTransform.
//
// Usage from main.js:
//   const { tracker, arTransform, mode } = await bootstrapAR({ bus, EVENTS });
//
// Note: real AR's start() is async — it loads the MindAR CDN script, opens
// the camera, calls controller.setup() / dummyRun(). The caller should
// `await tracker.start()` (or fire-and-forget with a TOAST on rejection).

import { trackerMock }     from './trackerMock.js';
import { arTransformMock } from './arTransformMock.js';

const MIND_FILE_URL  = './assets/targets/cards.mind';
const INDEX_FILE_URL = './assets/targets/index.json';

/** Read the `?ar=` flag. Returns 'real' | 'mock' | null (no override). */
function readUrlOverride() {
  try {
    const params = new URLSearchParams(window.location.search);
    const v = params.get('ar');
    if (v === '1' || v === 'real') return 'real';
    if (v === '0' || v === 'mock') return 'mock';
  } catch (_e) { /* SSR / non-browser — ignore */ }
  return null;
}

/** HEAD-fetch a URL. Returns true if 2xx, false on any error or non-ok. */
async function probeFile(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch (_e) {
    return false;
  }
}

/** Tiny helper — emit a toast if the bus is wired, else log. */
function toast(busRef, EVENTS, message, type = 'info') {
  if (busRef && EVENTS && EVENTS.TOAST) {
    busRef.emit(EVENTS.TOAST, { message, type });
  } else {
    console.info('[arBootstrap]', message);
  }
}

/**
 * Pick tracker + arTransform once at boot.
 *
 * @param {object}  ctx
 * @param {object}  ctx.bus      eventBus singleton (optional — for fallback toasts)
 * @param {object}  ctx.EVENTS   EVENTS map (optional — for TOAST event name)
 * @returns {Promise<{ tracker, arTransform, mode: 'real' | 'mock' }>}
 */
export async function bootstrapAR({ bus, EVENTS } = {}) {
  const override = readUrlOverride();

  // ── Decide intent ──
  // - explicit override wins
  // - else auto-detect: real if .mind file is present, else mock
  let want;            // 'real' | 'mock'
  let reason;          // human-readable for console
  if (override === 'real') {
    want = 'real';
    reason = 'forced by ?ar=1';
  } else if (override === 'mock') {
    want = 'mock';
    reason = 'forced by ?ar=0';
  } else {
    const hasMind = await probeFile(MIND_FILE_URL);
    want = hasMind ? 'real' : 'mock';
    reason = hasMind ? 'cards.mind present' : 'no cards.mind — using mock';
  }
  console.info(`[arBootstrap] intent=${want} (${reason})`);

  // ── Realize the choice (with fallback for 'real') ──
  if (want === 'real') {
    // Re-probe even if override forced 'real' — we want a clear toast if the
    // file is missing rather than waiting for trackerMindAR.start() to throw.
    const okMind  = await probeFile(MIND_FILE_URL);
    const okIndex = await probeFile(INDEX_FILE_URL);
    if (!okMind || !okIndex) {
      const missing = !okMind ? 'cards.mind' : 'index.json';
      const msg = `AR target missing (${missing}) — using mock tracker.`;
      console.warn('[arBootstrap]', msg);
      toast(bus, EVENTS, msg, 'warn');
      return { tracker: trackerMock, arTransform: arTransformMock, mode: 'mock' };
    }

    // Lazily import the real impls so the MindAR CDN script tag isn't even
    // referenced unless we're actually going to use it.
    try {
      const [{ trackerMindAR }, { arTransformMindAR }] = await Promise.all([
        import('./trackerMindAR.js'),
        import('./arTransformMindAR.js')
      ]);
      return { tracker: trackerMindAR, arTransform: arTransformMindAR, mode: 'real' };
    } catch (err) {
      console.warn('[arBootstrap] real impl import failed, falling back to mock', err);
      toast(bus, EVENTS, 'AR module load failed — using mock tracker.', 'warn');
      return { tracker: trackerMock, arTransform: arTransformMock, mode: 'mock' };
    }
  }

  // 'mock'
  return { tracker: trackerMock, arTransform: arTransformMock, mode: 'mock' };
}

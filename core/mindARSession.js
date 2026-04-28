// mindARSession.js — singleton that loads MindAR + manages the camera and
// controller. Powers both trackerMindAR (high-level element events) and
// arTransformMindAR (per-frame matrices) so they share one camera/controller.
//
// MindAR is dynamically loaded from CDN — no build step required, no entry
// added to package.json. The library exposes globals on `window.MINDAR`.
//
// Usage:
//   const session = await getMindARSession({
//     imageTargetSrc: './assets/targets/cards.mind',
//     videoContainer: someDiv
//   });
//   session.onTargetFound((data) => { ... });   // { targetIndex, worldMatrix }
//   session.onTargetLost((data) => { ... });    // { targetIndex }
//   session.onMatrixUpdate((data) => { ... });  // { targetIndex, worldMatrix }
//   await session.start();
//   ...
//   session.stop();
//
// IMPORTANT — this module is the ONLY place that talks to MindAR.
// Higher-level wrappers (trackerMindAR, arTransformMindAR) consume this
// session's events and translate them into the project's API contracts.

const MINDAR_VERSION = '1.2.5';
const MINDAR_CDN = `https://cdn.jsdelivr.net/npm/mind-ar@${MINDAR_VERSION}/dist/mindar-image.prod.js`;

let _libPromise = null;
function loadMindARLib() {
  if (_libPromise) return _libPromise;
  _libPromise = new Promise((resolve, reject) => {
    if (window.MINDAR?.IMAGE?.Controller) return resolve(window.MINDAR);
    const script = document.createElement('script');
    script.src = MINDAR_CDN;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload  = () => {
      if (window.MINDAR?.IMAGE?.Controller) resolve(window.MINDAR);
      else reject(new Error('[mindar] script loaded but window.MINDAR.IMAGE.Controller missing'));
    };
    script.onerror = () => reject(new Error(`[mindar] failed to load from ${MINDAR_CDN}`));
    document.head.appendChild(script);
  });
  return _libPromise;
}

let _activeSession = null;

/**
 * Build (or return cached) MindAR session. Only one session can be active
 * at a time — calling this with different opts while running stops the
 * previous session first.
 *
 * Opts:
 *   imageTargetSrc   URL to compiled .mind file (required)
 *   videoContainer   Element to host the <video> (defaults to document.body, hidden)
 *   maxTrack         Concurrent targets (default 4)
 *   filterMinCF      MindAR filter — keep default unless tuning (default 0.0001)
 *   filterBeta       MindAR filter (default 0.001)
 *   warmupTolerance  Frames before "found" fires (default 5)
 *   missTolerance    Frames before "lost" fires (default 5)
 */
export async function getMindARSession(opts = {}) {
  if (_activeSession && _activeSession.opts.imageTargetSrc === opts.imageTargetSrc) {
    return _activeSession;
  }
  if (_activeSession) {
    await _activeSession.stop();
    _activeSession = null;
  }

  const MINDAR = await loadMindARLib();
  const Controller = MINDAR.IMAGE.Controller;

  const handlers = { found: [], lost: [], update: [] };
  function _detach(arr, h) { const i = arr.indexOf(h); if (i >= 0) arr.splice(i, 1); }

  // Hidden video element — MindAR needs raw frames; renderers draw the
  // processed result in their own canvases. If videoContainer is provided
  // we attach there so app code can size/position it; else hidden offscreen.
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('muted', '');
  video.muted = true;
  Object.assign(video.style, {
    position: 'absolute', inset: '0',
    width: '100%', height: '100%', objectFit: 'cover',
    pointerEvents: 'none'
  });
  if (opts.videoContainer) {
    opts.videoContainer.appendChild(video);
  } else {
    Object.assign(video.style, { width: '1px', height: '1px', opacity: '0' });
    document.body.appendChild(video);
  }

  let stream = null;
  let controller = null;
  let running = false;

  async function _openCamera() {
    if (stream) return stream;
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width:  { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    return stream;
  }

  function _closeCamera() {
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }

  async function start() {
    if (running) return;
    if (!opts.imageTargetSrc) throw new Error('[mindar] imageTargetSrc is required');

    await _openCamera();

    controller = new Controller({
      inputWidth:      video.videoWidth || 1280,
      inputHeight:     video.videoHeight || 720,
      imageTargetSrc:  opts.imageTargetSrc,
      filterMinCF:     opts.filterMinCF      ?? 0.0001,
      filterBeta:      opts.filterBeta       ?? 0.001,
      warmupTolerance: opts.warmupTolerance  ?? 5,
      missTolerance:   opts.missTolerance    ?? 5,
      maxTrack:        opts.maxTrack         ?? 4,
      onUpdate: (data) => {
        if (!data) return;
        if (data.type === 'updateMatrix') {
          for (const h of handlers.update) {
            try { h({ targetIndex: data.targetIndex, worldMatrix: data.worldMatrix }); }
            catch (e) { console.warn('[mindar] update handler', e); }
          }
        } else if (data.type === 'targetFound') {
          for (const h of handlers.found) {
            try { h({ targetIndex: data.targetIndex }); }
            catch (e) { console.warn('[mindar] found handler', e); }
          }
        } else if (data.type === 'targetLost') {
          for (const h of handlers.lost) {
            try { h({ targetIndex: data.targetIndex }); }
            catch (e) { console.warn('[mindar] lost handler', e); }
          }
        }
      }
    });

    await controller.setup();
    await controller.dummyRun(video);
    controller.processVideo(video);
    running = true;
  }

  async function stop() {
    if (!running) return;
    running = false;
    try { controller?.stopProcessVideo?.(); } catch (_e) {}
    controller = null;
    _closeCamera();
    try { video.remove(); } catch (_e) {}
  }

  _activeSession = {
    opts,
    video,
    get running() { return running; },
    onTargetFound(h)  { handlers.found.push(h);  return () => _detach(handlers.found, h); },
    onTargetLost(h)   { handlers.lost.push(h);   return () => _detach(handlers.lost, h); },
    onMatrixUpdate(h) { handlers.update.push(h); return () => _detach(handlers.update, h); },
    start,
    stop
  };
  return _activeSession;
}

/** Test the load path without starting the camera. Resolves true if the lib
 *  can be fetched, false if blocked (offline, CSP, etc.). */
export async function probeMindAR() {
  try {
    await loadMindARLib();
    return true;
  } catch (_e) {
    return false;
  }
}

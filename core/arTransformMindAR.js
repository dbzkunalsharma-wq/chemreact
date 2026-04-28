// arTransformMindAR.js — real AR transform provider.
//
// Implements the ARTransformProvider contract (see ./ARTransformProvider.js).
// Same shape as arTransformMock.js so swapping is one import line in the
// cardAR screen / wherever the provider is used.
//
// Behaviour:
//   - Loads `assets/targets/index.json` for targetIndex → targetId mapping.
//     `targetId` here uses the same ELEMENT IDs as trackerMindAR for
//     consistency (both layers share the same physical cards).
//   - Subscribes to mindARSession's matrix updates and forwards each frame's
//     4×4 worldMatrix to registered handlers as a Float32Array.
//   - Handlers receive { targetId, matrix } — matrix is column-major (Three.js
//     convention).
//
// If the .mind file or index.json cannot be loaded, start() rejects and the
// caller is expected to fall back to arTransformMock.

import { getMindARSession } from './mindARSession.js';

const DEFAULT_TARGETS_DIR = './assets/targets';
const DEFAULT_MIND_FILE   = `${DEFAULT_TARGETS_DIR}/cards.mind`;
const DEFAULT_INDEX_FILE  = `${DEFAULT_TARGETS_DIR}/index.json`;

function _detach(arr, h) { const i = arr.indexOf(h); if (i >= 0) arr.splice(i, 1); }

export function createARTransformMindAR(opts = {}) {
  const config = {
    imageTargetSrc: opts.imageTargetSrc || DEFAULT_MIND_FILE,
    indexFile:      opts.indexFile      || DEFAULT_INDEX_FILE,
    videoContainer: opts.videoContainer || null
  };

  let indexMap = null;
  let session = null;
  let running = false;
  let unsubs = [];
  const handlers = { found: [], lost: [], update: [] };
  // Track which targetIndices we've already emitted "found" for so we can
  // also emit a synthetic "found" on the FIRST matrix update of a target
  // (some MindAR builds send updateMatrix before targetFound).
  const seenFound = new Set();

  async function loadIndex() {
    if (indexMap) return indexMap;
    const res = await fetch(config.indexFile);
    if (!res.ok) throw new Error(`[arTransformMindAR] index load failed: ${res.status}`);
    const data = await res.json();
    indexMap = new Map();
    for (const entry of data.targets || []) {
      if (typeof entry.index === 'number' && entry.elementId) {
        indexMap.set(entry.index, entry.elementId);
      }
    }
    return indexMap;
  }

  return {
    get _running() { return running; },

    async start() {
      if (running) return;
      await loadIndex();
      session = await getMindARSession({
        imageTargetSrc: config.imageTargetSrc,
        videoContainer: config.videoContainer,
        maxTrack: indexMap.size || 4
      });

      unsubs.push(session.onTargetFound(({ targetIndex }) => {
        const targetId = indexMap.get(targetIndex);
        if (!targetId) return;
        seenFound.add(targetIndex);
        // Found event fires before the first matrix in some builds — pass
        // a snapshot identity matrix as a placeholder so consumers can mount
        // their renderable group at the origin until the first real update.
        const placeholder = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
        for (const h of handlers.found) {
          try { h({ targetId, matrix: placeholder }); }
          catch (e) { console.warn('[arTransformMindAR] found handler', e); }
        }
      }));

      unsubs.push(session.onTargetLost(({ targetIndex }) => {
        const targetId = indexMap.get(targetIndex);
        if (!targetId) return;
        seenFound.delete(targetIndex);
        for (const h of handlers.lost) {
          try { h({ targetId }); }
          catch (e) { console.warn('[arTransformMindAR] lost handler', e); }
        }
      }));

      unsubs.push(session.onMatrixUpdate(({ targetIndex, worldMatrix }) => {
        const targetId = indexMap.get(targetIndex);
        if (!targetId) return;
        // Emit synthetic "found" if matrix arrived before the targetFound event.
        if (!seenFound.has(targetIndex)) {
          seenFound.add(targetIndex);
          const matrix = new Float32Array(worldMatrix);
          for (const h of handlers.found) {
            try { h({ targetId, matrix }); }
            catch (e) { console.warn('[arTransformMindAR] found handler', e); }
          }
        }
        // Per-frame update — fresh Float32Array since handlers may keep refs.
        const matrix = new Float32Array(worldMatrix);
        for (const h of handlers.update) {
          try { h({ targetId, matrix }); }
          catch (e) { console.warn('[arTransformMindAR] update handler', e); }
        }
      }));

      await session.start();
      running = true;
    },

    async stop() {
      if (!running) return;
      running = false;
      unsubs.forEach(u => { try { u(); } catch (_e) {} });
      unsubs = [];
      if (session) {
        await session.stop();
        session = null;
      }
      // Synthesise lost events for anything still in seenFound.
      for (const targetIndex of seenFound) {
        const targetId = indexMap?.get(targetIndex);
        if (!targetId) continue;
        for (const h of handlers.lost) {
          try { h({ targetId }); } catch (_e) {}
        }
      }
      seenFound.clear();
    },

    onTargetFound(h)  { handlers.found.push(h);  return () => _detach(handlers.found, h); },
    onTargetLost(h)   { handlers.lost.push(h);   return () => _detach(handlers.lost, h); },
    onMatrixUpdate(h) { handlers.update.push(h); return () => _detach(handlers.update, h); }
  };
}

export const arTransformMindAR = createARTransformMindAR();

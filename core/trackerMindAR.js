// trackerMindAR.js — real AR tracker. Implements the ITracker contract.
// Same shape as trackerMock.js so swapping is one import line in main.js.
//
// Element-id mapping comes from `assets/targets/index.json`:
//   { "version": 1, "targets": [
//       { "index": 0, "elementId": "H"  },
//       { "index": 1, "elementId": "O"  },
//       ...
//   ] }
//
// The .mind file (compiled image targets) lives at `assets/targets/cards.mind`.
// Compile it via the MindAR online compiler from your physical card photos:
//   https://hiukim.github.io/mind-ar-js-doc/tools/compile/
//
// Distance estimation: we read each target's worldMatrix translation vector
// and compute Euclidean distance between active pairs every frame. When two
// known elements drop below a threshold (default 0.6 world units ≈ ~30cm
// depending on target size), we emit DISTANCE_CHANGE so the COMBINE logic
// can bind them.

import { bus, EVENTS } from './eventBus.js';
import { getMindARSession } from './mindARSession.js';

const DEFAULT_TARGETS_DIR = './assets/targets';
const DEFAULT_MIND_FILE   = `${DEFAULT_TARGETS_DIR}/cards.mind`;
const DEFAULT_INDEX_FILE  = `${DEFAULT_TARGETS_DIR}/index.json`;

// Below this world-distance, two cards are considered "close" (proximity
// reaction trigger). MindAR world units depend on the physical card width;
// typically tuned per project once you've measured.
const PROXIMITY_THRESHOLD = 0.6;

/** Pull the translation [x,y,z] out of a column-major 4×4 worldMatrix. */
function translationFromMatrix(m) {
  return { x: m[12], y: m[13], z: m[14] };
}

/** Euclidean distance between two {x,y,z}. */
function dist(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

/** Build the tracker. Lazily loads the index map + MindAR on first start(). */
export function createTrackerMindAR(opts = {}) {
  const config = {
    imageTargetSrc: opts.imageTargetSrc || DEFAULT_MIND_FILE,
    indexFile:      opts.indexFile      || DEFAULT_INDEX_FILE,
    proximityThreshold: opts.proximityThreshold ?? PROXIMITY_THRESHOLD,
    videoContainer: opts.videoContainer || null
  };

  let indexMap = null;       // targetIndex → elementId
  let positions = new Map(); // elementId → {x,y,z}
  let active = new Set();    // currently-detected elementIds
  let session = null;
  let unsubs = [];
  let lastEmittedDistance = new Map(); // pairKey → distance (to avoid event spam)

  function pairKey(a, b) { return a < b ? `${a}|${b}` : `${b}|${a}`; }

  async function loadIndex() {
    if (indexMap) return indexMap;
    const res = await fetch(config.indexFile);
    if (!res.ok) throw new Error(`[trackerMindAR] failed to load ${config.indexFile}: ${res.status}`);
    const data = await res.json();
    indexMap = new Map();
    for (const entry of data.targets || []) {
      if (typeof entry.index === 'number' && entry.elementId) {
        indexMap.set(entry.index, entry.elementId);
      }
    }
    return indexMap;
  }

  /** Recompute pairwise distances, emit DISTANCE_CHANGE when a new pair drops
   *  below threshold or moves more than 5cm from its last emitted value. */
  function emitDistances() {
    const ids = [...active];
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i], b = ids[j];
        const pa = positions.get(a), pb = positions.get(b);
        if (!pa || !pb) continue;
        const cm = dist(pa, pb) * 100; // approx — assumes 1 world unit ≈ 1m
        const key = pairKey(a, b);
        const last = lastEmittedDistance.get(key);
        if (last == null || Math.abs(last - cm) > 5 || (cm <= config.proximityThreshold * 100) !== (last <= config.proximityThreshold * 100)) {
          lastEmittedDistance.set(key, cm);
          bus.emit(EVENTS.DISTANCE_CHANGE, { a, b, cm });
        }
      }
    }
  }

  return {
    async start() {
      await loadIndex();
      session = await getMindARSession({
        imageTargetSrc: config.imageTargetSrc,
        videoContainer: config.videoContainer,
        maxTrack: indexMap.size || 4
      });

      unsubs.push(session.onTargetFound(({ targetIndex }) => {
        const elementId = indexMap.get(targetIndex);
        if (!elementId || active.has(elementId)) return;
        active.add(elementId);
        const pos = positions.get(elementId) || { x: 0, y: 0, z: 0 };
        bus.emit(EVENTS.ELEMENT_DETECTED, {
          elementId, position: pos, confidence: 1.0
        });
      }));

      unsubs.push(session.onTargetLost(({ targetIndex }) => {
        const elementId = indexMap.get(targetIndex);
        if (!elementId || !active.has(elementId)) return;
        active.delete(elementId);
        positions.delete(elementId);
        // Drop any cached pair distances involving this element.
        for (const key of [...lastEmittedDistance.keys()]) {
          if (key.includes(elementId)) lastEmittedDistance.delete(key);
        }
        bus.emit(EVENTS.ELEMENT_LOST, { elementId });
      }));

      unsubs.push(session.onMatrixUpdate(({ targetIndex, worldMatrix }) => {
        const elementId = indexMap.get(targetIndex);
        if (!elementId) return;
        positions.set(elementId, translationFromMatrix(worldMatrix));
        // Throttle distance recompute to once per target update — proximity
        // logic doesn't need sub-frame precision.
        emitDistances();
      }));

      await session.start();
    },

    async stop() {
      unsubs.forEach(u => { try { u(); } catch (_e) {} });
      unsubs = [];
      if (session) {
        await session.stop();
        session = null;
      }
      // Mirror trackerMock: emit ELEMENT_LOST for every active card.
      for (const id of active) bus.emit(EVENTS.ELEMENT_LOST, { elementId: id });
      active.clear();
      positions.clear();
      lastEmittedDistance.clear();
    },

    getActive() { return [...active]; },

    /** Real AR can't simulate detection — but we keep the method to match
     *  the contract. In dev, prefer trackerMock for synthetic events. */
    simulate(_spec) {
      console.warn('[trackerMindAR] simulate() is a no-op on real AR. Use trackerMock for dev.');
    }
  };
}

// Default export — lazily created so opts can be customised before first use.
export const trackerMindAR = createTrackerMindAR();

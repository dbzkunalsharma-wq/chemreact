// arTransformMock.js — simulated AR transform provider.
//
// Implements the ARTransformProvider contract (see ./ARTransformProvider.js).
// Emits per-frame matrices for 1..N "fake cards" that drift with a gentle sway,
// so the CardRenderer can be developed/previewed without a camera or MindAR.
//
// Test helpers:
//   addTarget(targetId, basePosition?)  — start simulating a card
//   removeTarget(targetId)              — stop simulating a card
//
// `basePosition` is [x, y, z] in world units (Three.js camera looks down -Z).
// A reasonable default is [0, 0, -3] — three units in front of the camera.

const THREE = window.THREE;

// Reused scratch objects so the per-frame loop allocates nothing.
const _scratchMatrix = new THREE.Matrix4();
const _scratchPos = new THREE.Vector3();
const _scratchQuat = new THREE.Quaternion();
const _scratchScale = new THREE.Vector3(1, 1, 1);
const _scratchEuler = new THREE.Euler();

/**
 * Build a column-major Float32Array(16) for `target` at time `t` (seconds).
 * The position has a vertical bob; the rotation has a gentle Y-axis yaw.
 */
function buildMatrix(target, t) {
  const swayY = Math.sin(t * 0.6 + (target.phase || 0)) * 0.05;
  const yawY  = Math.sin(t * 0.4 + (target.phase || 0)) * 0.10;

  _scratchPos.set(
    target.x,
    target.y + swayY,
    target.z
  );
  _scratchEuler.set(
    target.rx,
    target.ry + yawY,
    target.rz,
    'XYZ'
  );
  _scratchQuat.setFromEuler(_scratchEuler);
  _scratchMatrix.compose(_scratchPos, _scratchQuat, _scratchScale);

  // Return a fresh Float32Array snapshot — handlers may store these.
  return new Float32Array(_scratchMatrix.elements);
}

function _detach(arr, h) {
  const i = arr.indexOf(h);
  if (i >= 0) arr.splice(i, 1);
}

export const arTransformMock = {
  _running: false,
  _targets: new Map(), // targetId → { x, y, z, rx, ry, rz, t0, phase }
  _handlers: { found: [], lost: [], update: [] },
  _rafId: null,

  start() {
    if (this._running) return;
    this._running = true;
    this._tick();
  },

  stop() {
    this._running = false;
    if (this._rafId != null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  },

  onTargetFound(h) {
    this._handlers.found.push(h);
    return () => _detach(this._handlers.found, h);
  },
  onTargetLost(h) {
    this._handlers.lost.push(h);
    return () => _detach(this._handlers.lost, h);
  },
  onMatrixUpdate(h) {
    this._handlers.update.push(h);
    return () => _detach(this._handlers.update, h);
  },

  /**
   * Add a simulated card target. If basePosition omitted, defaults to a sensible
   * spot in front of the camera. Phase offset gives different cards distinct sway.
   */
  addTarget(targetId, basePosition = [0, 0, -3]) {
    if (this._targets.has(targetId)) return;
    const tgt = {
      x: basePosition[0],
      y: basePosition[1],
      z: basePosition[2],
      rx: 0, ry: 0, rz: 0,
      t0: performance.now(),
      phase: this._targets.size * 1.3 // each new card phase-shifts the sway
    };
    this._targets.set(targetId, tgt);
    const matrix = buildMatrix(tgt, performance.now() / 1000);
    for (const h of this._handlers.found) {
      try { h({ targetId, matrix }); } catch (e) { console.warn('[arMock] found handler error', e); }
    }
  },

  removeTarget(targetId) {
    if (!this._targets.has(targetId)) return;
    this._targets.delete(targetId);
    for (const h of this._handlers.lost) {
      try { h({ targetId }); } catch (e) { console.warn('[arMock] lost handler error', e); }
    }
  },

  /** Test helper — list current target ids. */
  getTargets() {
    return Array.from(this._targets.keys());
  },

  _tick() {
    if (!this._running) return;
    const t = performance.now() / 1000;
    for (const [id, tgt] of this._targets) {
      const matrix = buildMatrix(tgt, t);
      for (const h of this._handlers.update) {
        try { h({ targetId: id, matrix }); }
        catch (e) { console.warn('[arMock] update handler error', e); }
      }
    }
    this._rafId = requestAnimationFrame(() => this._tick());
  }
};

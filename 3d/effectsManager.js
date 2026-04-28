// effectsManager.js — central manager for active particle effects.
//
// Owns the lifecycle of every spawned effect: construct → attach group →
// per-frame update → dispose. The renderer (or whoever owns the scene)
// calls `add()` to spawn an effect, attaches the returned `group` to the
// scene, and pumps `update(dt)` once per frame.
//
// Usage:
//   import { EffectsManager } from './3d/effectsManager.js';
//   const fxManager = new EffectsManager();
//   const handle = fxManager.add('flame', { intensity: 1.0, position: [0, 0, 0] });
//   if (handle) scene.add(handle.group);
//   // …each frame:
//   fxManager.update(dt);
//   // …when done:
//   fxManager.remove(handle.id);

import { spawnEffect } from './effects/index.js';

export class EffectsManager {
  constructor() {
    /** @type {Map<number, {group: THREE.Group, update: Function, dispose: Function}>} */
    this.active = new Map();
    this._lastId = 0;
  }

  /**
   * Spawn an effect by name.
   * @param {string} name  registry key
   * @param {Object} [opts] {color, intensity, scale, position}
   * @returns {{id: number, group: THREE.Group} | null}
   */
  add(name, opts) {
    const fx = spawnEffect(name, opts);
    if (!fx) return null;
    const id = ++this._lastId;
    this.active.set(id, fx);
    return { id, group: fx.group };
  }

  /** Remove and dispose a specific effect by id. */
  remove(id) {
    const fx = this.active.get(id);
    if (!fx) return;
    // Detach from parent if attached — caller may still hold a reference to the group.
    if (fx.group && fx.group.parent) fx.group.parent.remove(fx.group);
    fx.dispose();
    this.active.delete(id);
  }

  /** Pump each active effect. dt is seconds. */
  update(dt) {
    for (const fx of this.active.values()) {
      try { fx.update(dt); }
      catch (e) { console.warn('[fx] update error:', e); }
    }
  }

  /** Number of currently active effects. */
  get count() { return this.active.size; }

  /** Dispose every active effect and clear the manager. */
  disposeAll() {
    for (const fx of this.active.values()) {
      if (fx.group && fx.group.parent) fx.group.parent.remove(fx.group);
      fx.dispose();
    }
    this.active.clear();
  }
}

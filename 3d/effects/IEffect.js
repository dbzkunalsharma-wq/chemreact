// IEffect.js — interface contract for ChemReact particle effects.
//
// Every effect file in this folder exports a class named `Effect` that
// implements this contract. The contract is enforced by convention only —
// JS has no formal interfaces — but every Effect MUST provide the four
// members below or the EffectsManager will misbehave.
//
// Effects are short-lived visual flourishes that play UNDER the 3D molecule
// (the molecule is rendered separately by core/moleculeRenderer.js). The
// EffectsManager owns the lifecycle: it constructs the effect, attaches the
// returned `group` to the scene, calls `update(dt)` every frame, and calls
// `dispose()` when the effect is removed.
//
// Authoring rules:
//  - Allocate ALL particle buffers in the constructor (Float32Array etc.).
//    Never allocate per-frame.
//  - Cap each effect at ~100 particles. Mid-range Android phones must
//    sustain 60fps with several effects active simultaneously.
//  - Use BasicMaterial wherever possible. No lighting cost, no shadow cost.
//  - Always dispose() geometries, materials, and textures.
//  - Drive every animation from the dt argument to update(). Do not use
//    setInterval / setTimeout.
//
// The actual class below is documentation-only — concrete effects do NOT
// extend it; they just match its shape. We export it so importers have a
// single source of truth for the contract.

const THREE = window.THREE;

export class Effect {
  /**
   * @param {Object} [opts]
   * @param {string|number} [opts.color]       CSS / hex color used as accent.
   * @param {number}        [opts.intensity]   0..1 multiplier for particle count, speed, brightness.
   * @param {number}        [opts.scale]       Uniform scale multiplier for the whole effect.
   * @param {number[]}      [opts.position]    [x, y, z] offset for the effect group.
   */
  constructor(opts = {}) {
    this._opts = opts;
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) {
      this._group.position.set(opts.position[0] || 0, opts.position[1] || 0, opts.position[2] || 0);
    }
    if (typeof opts.scale === 'number') {
      this._group.scale.setScalar(opts.scale);
    }
  }

  /** The THREE.Group containing all particle meshes/points. Attach this to your scene. */
  get group() { return this._group; }

  /** Called once per frame. dt is in seconds (already clamped by the renderer). */
  update(/* dt */) {}

  /** Free GPU resources. Called when the effect is removed. */
  dispose() {
    this._group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }
}

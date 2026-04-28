// glowPulse.js — flat circle meshes pulsing outward in the XZ plane.
// Used as a background "energy ping" under exothermic reactions / aura accents.

const THREE = window.THREE;

const PULSE_COUNT   = 3;        // 1-3 staggered pulses
const STAGGER       = 1.0;      // seconds between pulses
const LIFE          = PULSE_COUNT * STAGGER;
const MIN_RADIUS    = 0.5;
const MAX_RADIUS    = 2.5;
const Y_OFFSET      = -0.85;
const DEFAULT_COLOR = 0x6FE7FF;

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    // Unit-radius circle, scaled per-pulse — one geometry shared by all.
    this._geom = new THREE.CircleGeometry(1, 48);
    this._pulses = [];

    for (let i = 0; i < PULSE_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const m = new THREE.Mesh(this._geom, mat);
      m.rotation.x = -Math.PI / 2;     // lie flat in XZ
      m.position.y = Y_OFFSET;
      m.userData.phase = (i * STAGGER) % LIFE;
      this._pulses.push(m);
      this._group.add(m);
    }
  }

  get group() { return this._group; }

  update(dt) {
    for (const p of this._pulses) {
      p.userData.phase = (p.userData.phase + dt) % LIFE;
      const t = p.userData.phase / LIFE;
      const r = MIN_RADIUS + t * (MAX_RADIUS - MIN_RADIUS);
      p.scale.setScalar(r);
      // Strong fade-in, smooth fade-out, capped at 0.5 so it stays glow-ish.
      const fadeIn = Math.min(1, t * 5);
      p.material.opacity = 0.5 * fadeIn * (1 - t) * (1 - t);
    }
  }

  dispose() {
    this._geom.dispose();
    for (const p of this._pulses) p.material.dispose();
    this._pulses.length = 0;
  }
}

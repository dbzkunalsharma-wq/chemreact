// shimmer.js — golden tetrahedra in arc patterns sweeping across the bottom.
// Used under precious-metal / noble-gas glow / shiny-coating reactions.

const THREE = window.THREE;

const PARTICLE_COUNT = 30;
const LIFESPAN       = 2.0;
const ARC_RADIUS     = 1.3;
const Y_OFFSET       = -0.85;
const TET_RADIUS     = 0.05;
const DEFAULT_COLOR  = 0xFFC857;

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    // One geom + one material — particles share both.
    this._geom = new THREE.TetrahedronGeometry(TET_RADIUS, 0);
    this._mat  = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false
    });

    this._particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const m = new THREE.Mesh(this._geom, this._mat);
      m.userData.age      = Math.random() * LIFESPAN;
      m.userData.arcAngle = (i / PARTICLE_COUNT) * Math.PI * 2;
      m.userData.arcSpeed = 0.4 + Math.random() * 0.5;     // radians/sec drift
      m.userData.bobPhase = Math.random() * Math.PI * 2;
      m.userData.spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      m.userData.spinSpeed = 1.0 + Math.random() * 1.5;
      this._particles.push(m);
      this._group.add(m);
    }
    // Per-particle opacity is faked by toggling visibility-style scale to zero
    // when faded; we drive a single material opacity for cheap blend.
  }

  get group() { return this._group; }

  update(dt) {
    let opacitySum = 0;
    for (const p of this._particles) {
      p.userData.age += dt;
      if (p.userData.age >= LIFESPAN) {
        p.userData.age = 0;
        p.userData.arcAngle = Math.random() * Math.PI * 2;
      }
      p.userData.arcAngle += p.userData.arcSpeed * dt;

      const t = p.userData.age / LIFESPAN;
      const ang = p.userData.arcAngle;
      // Sweep along arc + slight bob in Y for life.
      const x = Math.cos(ang) * ARC_RADIUS;
      const z = Math.sin(ang) * ARC_RADIUS;
      const y = Y_OFFSET + Math.sin(p.userData.bobPhase + p.userData.age * 2) * 0.15;
      p.position.set(x, y, z);
      p.rotateOnAxis(p.userData.spinAxis, p.userData.spinSpeed * dt);

      // Smooth fade in → out across life (sine bell).
      const fade = Math.sin(t * Math.PI);
      p.scale.setScalar(0.6 + fade * 0.6);
      opacitySum += fade;
    }
    this._mat.opacity = Math.min(1, opacitySum / PARTICLE_COUNT * 1.5);
  }

  dispose() {
    this._geom.dispose();
    this._mat.dispose();
    this._particles.length = 0;
  }
}

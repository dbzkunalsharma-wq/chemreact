// gasBubble.js — translucent spheres rising in a column with a sin wobble.
// Used under gas-evolution reactions (CO2 release, fizzing, electrolysis H2/O2).

const THREE = window.THREE;

const BUBBLE_COUNT = 15;
const RADIUS       = 0.08;
const LIFESPAN     = 1.8;
const RISE_SPEED   = 1.0;
const Y_OFFSET     = -0.9;
const COLUMN_RADIUS = 0.25;

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(0xffffff);

    // Single low-poly sphere geom shared by all bubbles. Cheap on GPU.
    this._geom = new THREE.SphereGeometry(RADIUS, 10, 8);
    this._mat  = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.4,
      depthWrite: false
    });

    this._bubbles = [];
    for (let i = 0; i < BUBBLE_COUNT; i++) {
      const m = new THREE.Mesh(this._geom, this._mat);
      m.userData.age      = Math.random() * LIFESPAN;
      m.userData.angle    = Math.random() * Math.PI * 2;     // angular position around column
      m.userData.radius   = Math.random() * COLUMN_RADIUS;
      m.userData.wobble   = 0.04 + Math.random() * 0.06;
      m.userData.phase    = Math.random() * Math.PI * 2;
      m.userData.scaleVar = 0.7 + Math.random() * 0.6;
      this._bubbles.push(m);
      this._group.add(m);
    }
  }

  get group() { return this._group; }

  update(dt) {
    for (const b of this._bubbles) {
      b.userData.age += dt;
      if (b.userData.age >= LIFESPAN) {
        b.userData.age = 0;
        b.userData.angle = Math.random() * Math.PI * 2;
        b.userData.radius = Math.random() * COLUMN_RADIUS;
      }
      const t = b.userData.age / LIFESPAN;
      const baseX = Math.cos(b.userData.angle) * b.userData.radius;
      const baseZ = Math.sin(b.userData.angle) * b.userData.radius;
      const wob = Math.sin(b.userData.phase + b.userData.age * 4) * b.userData.wobble;
      b.position.set(baseX + wob, Y_OFFSET + t * RISE_SPEED * LIFESPAN, baseZ + wob);
      // Bubbles grow slightly as they rise, then pop (scale to 0 in last 10%).
      const pop = t > 0.9 ? (1 - (t - 0.9) * 10) : 1;
      b.scale.setScalar(b.userData.scaleVar * (0.6 + t * 0.4) * pop);
    }
  }

  dispose() {
    this._geom.dispose();
    this._mat.dispose();
    this._bubbles.length = 0;
  }
}

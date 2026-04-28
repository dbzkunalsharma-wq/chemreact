// dust.js — rust-colored Points falling slowly with a horizontal drift.
// Used under oxidation / rust formation, weathering, decay reactions.

const THREE = window.THREE;

const PARTICLE_COUNT = 30;
const SPAWN_Y        = 0.8;
const FLOOR_Y        = -1.0;
const FALL_SPEED     = 0.45;
const SPREAD_X       = 1.6;
const SPREAD_Z       = 1.6;
const DEFAULT_COLOR  = 0xa04f1f;

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    this._positions  = new Float32Array(PARTICLE_COUNT * 3);
    this._velocities = new Float32Array(PARTICLE_COUNT * 3);

    for (let i = 0; i < PARTICLE_COUNT; i++) this._spawn(i, true);

    this._geom = new THREE.BufferGeometry();
    this._geom.setAttribute('position', new THREE.BufferAttribute(this._positions, 3));

    this._mat = new THREE.PointsMaterial({
      color,
      size: 0.07,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      sizeAttenuation: true
    });

    this._points = new THREE.Points(this._geom, this._mat);
    this._group.add(this._points);
  }

  _spawn(i, randomY) {
    this._positions[i * 3]     = (Math.random() - 0.5) * SPREAD_X;
    this._positions[i * 3 + 1] = randomY
      ? FLOOR_Y + Math.random() * (SPAWN_Y - FLOOR_Y)
      : SPAWN_Y;
    this._positions[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;
    // Slight horizontal drift varies per particle for natural motion.
    this._velocities[i * 3]     = (Math.random() - 0.5) * 0.15;
    this._velocities[i * 3 + 1] = -FALL_SPEED * (0.7 + Math.random() * 0.5);
    this._velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.15;
  }

  update(dt) {
    let aliveSum = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this._positions[i * 3]     += this._velocities[i * 3]     * dt;
      this._positions[i * 3 + 1] += this._velocities[i * 3 + 1] * dt;
      this._positions[i * 3 + 2] += this._velocities[i * 3 + 2] * dt;
      if (this._positions[i * 3 + 1] <= FLOOR_Y) {
        this._spawn(i, false);
      }
      // Particles near the floor count less toward overall opacity → cheap fade.
      const y = this._positions[i * 3 + 1];
      const fade = (y - FLOOR_Y) / (SPAWN_Y - FLOOR_Y);
      aliveSum += Math.max(0, Math.min(1, fade));
    }
    this._mat.opacity = 0.85 * (aliveSum / PARTICLE_COUNT);
    this._geom.attributes.position.needsUpdate = true;
  }

  dispose() {
    this._geom.dispose();
    this._mat.dispose();
  }
}

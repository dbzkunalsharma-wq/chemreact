// sparks.js — radial line-trail sparks with bright additive cores.
// Used under electric / exothermic / decomposition reactions.

const THREE = window.THREE;

const SPARK_COUNT     = 24;
const LIFESPAN        = 0.8;
const BURST_PERIOD    = 1.0;        // burst every 1.0s with brief gap
const INITIAL_SPEED   = 1.5;
const UPWARD_BIAS     = 0.3;
const GRAVITY         = -1.5;
const TRAIL_LENGTH    = 0.4;
const TRAIL_RADIUS    = 0.015;
const CORE_SIZE       = 0.12;
const DEFAULT_COLOR   = 0x00FFEE;

// Cached radial-gradient core texture (white center → transparent edge).
let SHARED_CORE_TEX = null;
function getCoreTexture() {
  if (SHARED_CORE_TEX) return SHARED_CORE_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.65)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  SHARED_CORE_TEX = new THREE.CanvasTexture(c);
  return SHARED_CORE_TEX;
}

// Reusable scratch vectors (no per-frame allocation).
const _UP    = new THREE.Vector3(0, 1, 0);
const _vDir  = new THREE.Vector3();
const _q     = new THREE.Quaternion();

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    // ---- Shared trail geometry + material ----
    // CylinderGeometry default axis is +Y; we'll reorient each per-frame to align with velocity.
    this._trailGeom = new THREE.CylinderGeometry(TRAIL_RADIUS * 0.4, TRAIL_RADIUS, TRAIL_LENGTH, 6, 1, true);
    // Translate so one end sits at origin (the "head"); the other end trails behind in -Y.
    this._trailGeom.translate(0, -TRAIL_LENGTH / 2, 0);
    this._trailMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });

    // ---- Shared core sprite material ----
    const coreTex = getCoreTexture();
    this._coreMatProto = new THREE.SpriteMaterial({
      map: coreTex,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    // ---- Per-spark state ----
    this._sparks = [];
    for (let i = 0; i < SPARK_COUNT; i++) {
      // Each trail is its own Mesh sharing geometry; needs its own material so
      // opacity can be lerped uniformly per-burst (we still drive one .opacity
      // on the shared mat below to save updates — see update()).
      const trail = new THREE.Mesh(this._trailGeom, this._trailMat);
      const coreMat = this._coreMatProto.clone();
      const core = new THREE.Sprite(coreMat);
      core.scale.setScalar(CORE_SIZE);

      const s = {
        trail,
        core,
        vx: 0, vy: 0, vz: 0,
        age: LIFESPAN, // start "dead" so the first burst respawns them in unison
      };
      this._respawn(s, 0, true);
      this._sparks.push(s);
      this._group.add(trail);
      this._group.add(core);
    }

    this._burstTimer = 0;       // counts up to BURST_PERIOD
    this._burstActive = true;   // false during the brief gap between bursts
  }

  _respawn(s, age, hide) {
    // Random unit direction with upward bias.
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const sx = Math.sin(phi) * Math.cos(theta);
    const sy = Math.cos(phi);
    const sz = Math.sin(phi) * Math.sin(theta);
    const speed = INITIAL_SPEED + 0.4 * Math.random();
    s.vx = sx * speed;
    s.vy = Math.max(UPWARD_BIAS, sy) * speed;  // ensure upward bias min
    s.vz = sz * speed;
    s.age = age;
    s.core.position.set(0, 0, 0);
    s.trail.position.set(0, 0, 0);
    if (hide) {
      s.core.material.opacity = 0;
      s.trail.material.opacity = 0;
    }
  }

  get group() { return this._group; }

  update(dt) {
    // ---- Burst cycle: active for LIFESPAN seconds, then a gap until BURST_PERIOD. ----
    this._burstTimer += dt;
    if (this._burstTimer >= BURST_PERIOD) {
      this._burstTimer = 0;
      // Re-fire the burst — respawn every spark at origin with a new direction.
      for (const s of this._sparks) this._respawn(s, 0, false);
      this._burstActive = true;
    }
    if (this._burstTimer > LIFESPAN) {
      this._burstActive = false;
    }

    // We'll drive the SHARED trail material's opacity to the average remaining
    // life so all 24 trails fade together — this matches the radial-burst feel
    // while saving 23 material.opacity writes per frame.
    let opacitySum = 0;

    for (const s of this._sparks) {
      if (!this._burstActive) {
        s.core.material.opacity = 0;
        continue;
      }
      s.age += dt;
      const t = Math.min(1, s.age / LIFESPAN);
      // Apply gravity.
      s.vy += GRAVITY * dt;
      // Move head.
      s.core.position.x += s.vx * dt;
      s.core.position.y += s.vy * dt;
      s.core.position.z += s.vz * dt;

      // Position trail at the head.
      s.trail.position.copy(s.core.position);
      // Orient trail along velocity direction. Cylinder default points +Y
      // (and we offset geometry so it extends along -Y). We want it to extend
      // BEHIND the head (opposite of velocity) → align +Y to the velocity dir.
      _vDir.set(s.vx, s.vy, s.vz);
      const len = _vDir.length();
      if (len > 0.0001) {
        _vDir.divideScalar(len);
        _q.setFromUnitVectors(_UP, _vDir);
        s.trail.quaternion.copy(_q);
      }

      // Soft fade: bell-ish curve, brighter at start, smooth tail.
      const fade = (1 - t) * (1 - t * 0.6);
      s.core.material.opacity = fade;
      opacitySum += fade;
    }
    // Single write to shared trail material — averaged opacity.
    this._trailMat.opacity = this._burstActive ? (opacitySum / SPARK_COUNT) : 0;
  }

  dispose() {
    this._trailGeom.dispose();
    this._trailMat.dispose();
    this._coreMatProto.dispose();
    for (const s of this._sparks) {
      s.core.material.dispose();
    }
    this._sparks.length = 0;
    // SHARED_CORE_TEX intentionally NOT disposed — cached for reuse.
  }
}

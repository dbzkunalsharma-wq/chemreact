// flame.js — layered cone meshes (orange outer + yellow-white inner) + rising embers.
// Used under combustion reactions (CH4, methane burn, etc.).

const THREE = window.THREE;

const EMBER_COUNT       = 8;
const EMBER_LIFESPAN    = 1.4;
const EMBER_RISE        = 1.0;
const EMBER_SPAWN_RAD   = 0.3;
const Y_BASE            = -0.8;

const OUTER_COLOR = 0xFFB02A;   // orange
const INNER_COLOR = 0xFFFCAA;   // yellow-white
const EMBER_COLOR = 0xFF8800;   // hot orange ember

// Cached ember sprite (white→orange radial). Module-level for cross-instance reuse.
let SHARED_EMBER_TEX = null;
function getEmberTexture() {
  if (SHARED_EMBER_TEX) return SHARED_EMBER_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(255,255,230,1)');
  g.addColorStop(0.45, 'rgba(255,170,40,0.6)');
  g.addColorStop(1,    'rgba(255,80,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  SHARED_EMBER_TEX = new THREE.CanvasTexture(c);
  return SHARED_EMBER_TEX;
}

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const intensity = opts.intensity != null ? opts.intensity : 1;
    // Optional accent — when user passes opts.color we tint the inner cone toward it.
    const innerCol = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(INNER_COLOR);
    const outerCol = new THREE.Color(OUTER_COLOR);

    // ---- Outer cone (orange, open-ended) ----
    this._outerGeom = new THREE.ConeGeometry(0.6, 1.6, 12, 1, true);
    this._outerMat = new THREE.MeshBasicMaterial({
      color: outerCol,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this._outerCone = new THREE.Mesh(this._outerGeom, this._outerMat);
    // Cone geometry has its base centered at origin; height extends ±half on Y.
    // Push up by half-height so base sits at Y_BASE.
    this._outerCone.position.y = Y_BASE + 0.8;
    this._group.add(this._outerCone);

    // ---- Inner cone (yellow-white, smaller) ----
    this._innerGeom = new THREE.ConeGeometry(0.35, 1.2, 12, 1, true);
    this._innerMat = new THREE.MeshBasicMaterial({
      color: innerCol,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this._innerCone = new THREE.Mesh(this._innerGeom, this._innerMat);
    this._innerCone.position.y = Y_BASE + 0.6;
    this._group.add(this._innerCone);

    // ---- Embers (sprites rising from base) ----
    const emberTex = getEmberTexture();
    this._emberMatProto = new THREE.SpriteMaterial({
      map: emberTex,
      color: EMBER_COLOR,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this._embers = [];
    for (let i = 0; i < EMBER_COUNT; i++) {
      const mat = this._emberMatProto.clone();
      const sp = new THREE.Sprite(mat);
      sp.scale.setScalar(0.15 * intensity);
      this._initEmber(sp, Math.random() * EMBER_LIFESPAN);
      this._embers.push(sp);
      this._group.add(sp);
    }

    this._t = 0;
  }

  _initEmber(sp, age) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * EMBER_SPAWN_RAD;
    sp.position.set(Math.cos(a) * r, Y_BASE, Math.sin(a) * r);
    sp.userData.vx = (Math.random() - 0.5) * 0.2;
    sp.userData.vy = EMBER_RISE + Math.random() * 0.4;
    sp.userData.vz = (Math.random() - 0.5) * 0.2;
    sp.userData.age = age;
  }

  get group() { return this._group; }

  update(dt) {
    this._t += dt;

    // Cones: subtle scale wobble + slow rotation.
    const wobble = 1.0 + Math.sin(this._t * 6.0) * 0.08;
    const wobbleH = 1.0 + Math.cos(this._t * 5.2) * 0.06;
    this._outerCone.scale.set(wobble, wobbleH, wobble);
    this._innerCone.scale.set(wobble * 1.02, wobbleH * 1.05, wobble * 1.02);
    this._outerCone.rotation.y += 0.15 * dt;
    this._innerCone.rotation.y -= 0.18 * dt;
    // Slight opacity flicker for life.
    this._outerMat.opacity = 0.45 + Math.sin(this._t * 9) * 0.08;
    this._innerMat.opacity = 0.65 + Math.sin(this._t * 11) * 0.08;

    // Embers: rise, age, respawn.
    for (const sp of this._embers) {
      sp.userData.age += dt;
      if (sp.userData.age >= EMBER_LIFESPAN) {
        this._initEmber(sp, 0);
        continue;
      }
      sp.position.x += sp.userData.vx * dt;
      sp.position.y += sp.userData.vy * dt;
      sp.position.z += sp.userData.vz * dt;
      // Bell-curve fade — quick ramp, slow fade.
      const t = sp.userData.age / EMBER_LIFESPAN;
      sp.material.opacity = Math.sin(t * Math.PI) * 0.9;
      // Embers shrink slightly as they cool.
      const s = 0.18 - t * 0.06;
      sp.scale.setScalar(s);
    }
  }

  dispose() {
    this._outerGeom.dispose();
    this._outerMat.dispose();
    this._innerGeom.dispose();
    this._innerMat.dispose();
    this._emberMatProto.dispose();
    for (const sp of this._embers) sp.material.dispose();
    this._embers.length = 0;
    // SHARED_EMBER_TEX intentionally NOT disposed — cached for reuse.
  }
}

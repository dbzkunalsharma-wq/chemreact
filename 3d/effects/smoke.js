// smoke.js — soft billowing cloud puffs (sprite billboards) drifting upward + outward.
// Used as a follow-up to flame, or for combustion residue.

const THREE = window.THREE;

const PUFF_COUNT       = 10;
const PUFF_LIFESPAN    = 2.6;
const RISE_VELOCITY    = 0.4;
const SPAWN_RADIUS     = 0.2;
const Y_BASE           = -0.6;
const DEFAULT_COLOR    = 0x5a6273;

// Cached cloud texture — module-level so all smoke instances share GPU memory.
let SHARED_CLOUD_TEX = null;
function getCloudTexture() {
  if (SHARED_CLOUD_TEX) return SHARED_CLOUD_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(255,255,255,0.95)');
  g.addColorStop(0.4,  'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  SHARED_CLOUD_TEX = new THREE.CanvasTexture(c);
  return SHARED_CLOUD_TEX;
}

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const color = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    const cloudTex = getCloudTexture();
    // Prototype material — each puff clones it so we can drive opacity per-puff.
    // Normal blending (NOT additive) so smoke obscures rather than glows.
    this._matProto = new THREE.SpriteMaterial({
      map: cloudTex,
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    // Pre-allocated puff pool. Each puff carries its own state in userData.
    this._puffs = [];
    for (let i = 0; i < PUFF_COUNT; i++) {
      const mat = this._matProto.clone();
      const sp = new THREE.Sprite(mat);
      this._spawn(sp, Math.random() * PUFF_LIFESPAN);
      this._puffs.push(sp);
      this._group.add(sp);
    }
  }

  _spawn(sp, age) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * SPAWN_RADIUS;
    sp.position.set(Math.cos(a) * r, Y_BASE, Math.sin(a) * r);
    sp.userData.vx = (Math.random() - 0.5) * 0.35;
    sp.userData.vy = RISE_VELOCITY * (0.8 + Math.random() * 0.4);
    sp.userData.vz = (Math.random() - 0.5) * 0.35;
    sp.userData.age = age;
    sp.userData.spin = (Math.random() - 0.5) * 0.6;
    // Initial scale — the update() will animate it during life.
    const s = 0.5;
    sp.scale.setScalar(s);
    // Sprites can have a material rotation in shaders, but we do it via z-rotation
    // of the sprite material (THREE.Sprite supports .material.rotation).
    sp.material.rotation = Math.random() * Math.PI * 2;
  }

  get group() { return this._group; }

  update(dt) {
    for (const sp of this._puffs) {
      sp.userData.age += dt;
      if (sp.userData.age >= PUFF_LIFESPAN) {
        this._spawn(sp, 0);
        continue;
      }
      // Drift + rise.
      sp.position.x += sp.userData.vx * dt;
      sp.position.y += sp.userData.vy * dt;
      sp.position.z += sp.userData.vz * dt;
      sp.material.rotation += sp.userData.spin * dt;

      const t = sp.userData.age / PUFF_LIFESPAN;
      // Scale: 0.5 → ~1.6 → ~1.4 (grow, settle).
      let s;
      if (t < 0.5) {
        s = 0.5 + (1.6 - 0.5) * (t / 0.5);
      } else {
        s = 1.6 + (1.4 - 1.6) * ((t - 0.5) / 0.5);
      }
      sp.scale.setScalar(s);
      // Opacity: bell curve 0 → 0.55 → 0.
      sp.material.opacity = Math.sin(t * Math.PI) * 0.55;
    }
  }

  dispose() {
    this._matProto.dispose();
    for (const sp of this._puffs) sp.material.dispose();
    this._puffs.length = 0;
    // SHARED_CLOUD_TEX intentionally NOT disposed — cached for reuse.
  }
}

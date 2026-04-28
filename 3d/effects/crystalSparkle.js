// crystalSparkle.js — faceted tetrahedra in a spiral + lens-flare glints + base shimmer ring.
// Used under salt formation, crystallization reactions.

const THREE = window.THREE;

const TET_COUNT       = 12;          // smaller, faceted tetrahedra
const TET_RADIUS      = 0.05;
const SPIRAL_TURNS    = 2.0;
const SPIRAL_RADIUS   = 1.1;
const Y_BASE          = -0.8;

const GLINT_COUNT     = 6;
const GLINT_LIFE      = 0.8;
const GLINT_SPAWN_R   = 1.5;

const DEFAULT_COLOR   = 0xE0FFFF;
const GLINT_COLOR     = 0xFFFFFF;
const SHIMMER_COLOR   = 0x80FFEE;

// Cached 4-pointed lens-flare star texture. Two crossed bright bars on a soft
// glow — additive-blended so it pops against everything.
let SHARED_GLINT_TEX = null;
function getGlintTexture() {
  if (SHARED_GLINT_TEX) return SHARED_GLINT_TEX;
  const SIZE = 64;
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const ctx = c.getContext('2d');
  // Soft round glow underlay.
  const g = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2);
  g.addColorStop(0,    'rgba(255,255,255,0.9)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.35)');
  g.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Cross spike — horizontal bar fading to edges.
  function drawBar(cx, cy, w, h) {
    const lg = ctx.createLinearGradient(cx - w / 2, cy, cx + w / 2, cy);
    lg.addColorStop(0,    'rgba(255,255,255,0)');
    lg.addColorStop(0.3,  'rgba(255,255,255,0.5)');
    lg.addColorStop(0.5,  'rgba(255,255,255,1)');
    lg.addColorStop(0.7,  'rgba(255,255,255,0.5)');
    lg.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  }
  ctx.globalCompositeOperation = 'lighter';
  drawBar(SIZE / 2, SIZE / 2, SIZE, 4);          // horizontal spike
  // Vertical spike — rotate canvas trick avoided; just draw a tall narrow bar.
  drawBar(SIZE / 2, SIZE / 2, 4, SIZE);          // vertical spike (using same fn with swapped dims)
  ctx.globalCompositeOperation = 'source-over';

  SHARED_GLINT_TEX = new THREE.CanvasTexture(c);
  return SHARED_GLINT_TEX;
}

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const tint = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);

    // ---- Tetrahedra (faceted, smaller) ----
    this._tetGeom = new THREE.TetrahedronGeometry(TET_RADIUS, 0);
    this._tetMat = new THREE.MeshBasicMaterial({
      color: tint,
      transparent: true,
      opacity: 0.95,
      depthWrite: false
    });
    this._tets = [];
    for (let i = 0; i < TET_COUNT; i++) {
      const t = i / TET_COUNT;
      const angle = t * Math.PI * 2 * SPIRAL_TURNS;
      const r = SPIRAL_RADIUS * (0.2 + t * 0.8);
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      const y = Y_BASE + (Math.random() - 0.5) * 0.15;

      const m = new THREE.Mesh(this._tetGeom, this._tetMat);
      m.position.set(x, y, z);
      m.userData.phase = Math.random() * Math.PI * 2;
      m.userData.spinAxis = new THREE.Vector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      ).normalize();
      m.userData.spinSpeed = 1.5 + Math.random() * 2.0;
      m.userData.bobBase = y;
      this._tets.push(m);
      this._group.add(m);
    }

    // ---- Lens flare glints ----
    const glintTex = getGlintTexture();
    // Slight cyan tint via SpriteMaterial.color.
    const glintTint = new THREE.Color(GLINT_COLOR).lerp(new THREE.Color(0xCCFFFF), 0.3);
    this._glintMatProto = new THREE.SpriteMaterial({
      map: glintTex,
      color: glintTint,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this._glints = [];
    for (let i = 0; i < GLINT_COUNT; i++) {
      const mat = this._glintMatProto.clone();
      const sp = new THREE.Sprite(mat);
      // Stagger initial ages so they don't all pop together.
      this._spawnGlint(sp, (i / GLINT_COUNT) * GLINT_LIFE);
      this._glints.push(sp);
      this._group.add(sp);
    }

    // ---- Base shimmer ring ----
    this._ringGeom = new THREE.TorusGeometry(1.4, 0.02, 8, 64);
    this._ringMat = new THREE.MeshBasicMaterial({
      color: SHIMMER_COLOR,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this._ring = new THREE.Mesh(this._ringGeom, this._ringMat);
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.y = Y_BASE;
    this._group.add(this._ring);
  }

  _spawnGlint(sp, age) {
    // Random point inside a sphere of radius GLINT_SPAWN_R, biased slightly upward.
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = GLINT_SPAWN_R * (0.3 + Math.random() * 0.7);
    sp.position.set(
      Math.sin(phi) * Math.cos(theta) * r,
      Y_BASE + Math.cos(phi) * r * 0.7 + r * 0.2,
      Math.sin(phi) * Math.sin(theta) * r
    );
    sp.userData.age = age;
    // Slight random twinkle rotation.
    sp.material.rotation = Math.random() * Math.PI * 2;
    sp.scale.setScalar(0);
  }

  get group() { return this._group; }

  update(dt) {
    // Tetrahedra: sin-pulse scale + rotation + small bob.
    for (const m of this._tets) {
      m.userData.phase += dt * 3.0;
      const pulse = 1.0 + Math.sin(m.userData.phase) * 0.3;
      m.scale.setScalar(pulse);
      m.position.y = m.userData.bobBase + Math.sin(m.userData.phase * 0.8) * 0.08;
      m.rotateOnAxis(m.userData.spinAxis, m.userData.spinSpeed * dt);
    }

    // Lens flare glints: bell-curve scale 0 → 0.6 → 0 + bell-curve opacity.
    for (const sp of this._glints) {
      sp.userData.age += dt;
      if (sp.userData.age >= GLINT_LIFE) {
        this._spawnGlint(sp, 0);
        continue;
      }
      const t = sp.userData.age / GLINT_LIFE;
      const s = Math.sin(t * Math.PI) * 0.6;
      sp.scale.setScalar(s);
      sp.material.opacity = Math.sin(t * Math.PI) * 0.95;
    }

    // Base shimmer ring slowly rotates around Y.
    this._ring.rotation.z += 0.5 * dt;
  }

  dispose() {
    this._tetGeom.dispose();
    this._tetMat.dispose();
    this._tets.length = 0;
    this._glintMatProto.dispose();
    for (const sp of this._glints) sp.material.dispose();
    this._glints.length = 0;
    this._ringGeom.dispose();
    this._ringMat.dispose();
    // SHARED_GLINT_TEX intentionally NOT disposed — cached for reuse.
  }
}

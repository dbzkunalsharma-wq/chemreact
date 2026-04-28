// waterRipple.js — translucent water dome + expanding rings + splash sprite flickers.
// Used under H2O, dissolution, and any aqueous reaction.

const THREE = window.THREE;

const RING_COUNT      = 4;
const STAGGER         = 0.4;
const LIFE            = RING_COUNT * STAGGER;
const RING_MIN_RADIUS = 0.4;
const RING_MAX_RADIUS = 2.5;
const RING_TUBE       = 0.04;
const SPLASH_COUNT    = 3;
const SPLASH_LIFE     = 0.5;
const Y_BASE          = -0.8;
const DEFAULT_COLOR   = 0x00B0CC;
const RING_COLOR      = 0x00E5FF;

// Cached splash sprite — shared across all instances. Module-level so that
// dispose() on one effect doesn't clobber another effect's texture.
let SHARED_SPLASH_TEX = null;
function getSplashTexture() {
  if (SHARED_SPLASH_TEX) return SHARED_SPLASH_TEX;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0,    'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(200,245,255,0.65)');
  g.addColorStop(1,    'rgba(180,235,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  SHARED_SPLASH_TEX = new THREE.CanvasTexture(c);
  return SHARED_SPLASH_TEX;
}

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const domeColor = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(DEFAULT_COLOR);
    const ringColor = opts.color != null ? new THREE.Color(opts.color) : new THREE.Color(RING_COLOR);

    // ---- Translucent water dome (top half-sphere) ----
    this._domeGeom = new THREE.SphereGeometry(1.0, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
    // MeshPhysicalMaterial gives transmission/ior look; falls back gracefully on lower GLs.
    this._domeMat = new THREE.MeshPhysicalMaterial({
      color: domeColor,
      transmission: 0.7,
      opacity: 0.4,
      transparent: true,
      roughness: 0.1,
      ior: 1.33,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this._dome = new THREE.Mesh(this._domeGeom, this._domeMat);
    this._dome.position.y = Y_BASE;
    this._group.add(this._dome);

    // Inner glow shell (slightly larger, additive) — fakes emissive aura.
    this._glowGeom = new THREE.SphereGeometry(1.05, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    this._glowMat = new THREE.MeshBasicMaterial({
      color: ringColor,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this._glow = new THREE.Mesh(this._glowGeom, this._glowMat);
    this._glow.position.y = Y_BASE;
    this._group.add(this._glow);

    // ---- Rings (thicker tube, additive) ----
    this._ringGeom = new THREE.TorusGeometry(1, RING_TUBE, 8, 48);
    this._rings = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(this._ringGeom, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = Y_BASE + 0.01;
      mesh.userData.phase = (i * STAGGER) % LIFE;
      this._rings.push(mesh);
      this._group.add(mesh);
    }

    // ---- Splash sprites (flickering at base) ----
    const splashTex = getSplashTexture();
    this._splashMat = new THREE.SpriteMaterial({
      map: splashTex,
      color: 0xCCFFFF,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this._splashes = [];
    for (let i = 0; i < SPLASH_COUNT; i++) {
      // Each splash needs its own material so opacity animates independently.
      const mat = this._splashMat.clone();
      const sp = new THREE.Sprite(mat);
      sp.scale.setScalar(0.4);
      sp.position.set(0, Y_BASE + 0.05, 0);
      sp.userData.age = Math.random() * SPLASH_LIFE;
      sp.userData.cooldown = Math.random() * 0.4;
      this._splashes.push(sp);
      this._group.add(sp);
    }
    // We'll keep the prototype material around for dispose hygiene.

    this._t = 0;
  }

  get group() { return this._group; }

  update(dt) {
    this._t += dt;

    // Dome breathing scale 0.95-1.05.
    const breath = 1.0 + Math.sin(this._t * 1.6) * 0.05;
    this._dome.scale.set(breath, breath * 0.95, breath);
    this._glow.scale.set(breath * 1.02, breath * 0.95, breath * 1.02);
    // Subtle glow pulse opacity 0.10..0.20.
    this._glowMat.opacity = 0.15 + Math.sin(this._t * 2.0) * 0.05;

    // Rings: grow outward + fade.
    for (const ring of this._rings) {
      ring.userData.phase = (ring.userData.phase + dt) % LIFE;
      const t = ring.userData.phase / LIFE;            // 0..1
      const r = RING_MIN_RADIUS + t * (RING_MAX_RADIUS - RING_MIN_RADIUS);
      ring.scale.setScalar(r);
      const fadeIn = Math.min(1, t * 6);
      // Bell-ish curve so rings don't snap to zero.
      ring.material.opacity = 0.8 * fadeIn * (1 - t);
    }

    // Splashes: random flicker. Each sprite has an "age" + "cooldown" cycle.
    for (const sp of this._splashes) {
      sp.userData.age += dt;
      if (sp.userData.age >= SPLASH_LIFE + sp.userData.cooldown) {
        // Reposition + reset.
        const a = Math.random() * Math.PI * 2;
        const r = 0.2 + Math.random() * 0.9;
        sp.position.set(Math.cos(a) * r, Y_BASE + 0.05, Math.sin(a) * r);
        sp.userData.age = 0;
        sp.userData.cooldown = 0.2 + Math.random() * 0.6;
      }
      // Bell-curve opacity over SPLASH_LIFE; zero during cooldown tail.
      const lifeT = sp.userData.age / SPLASH_LIFE;
      if (lifeT <= 1) {
        sp.material.opacity = Math.sin(lifeT * Math.PI) * 0.9;
        const s = 0.25 + Math.sin(lifeT * Math.PI) * 0.35;
        sp.scale.setScalar(s);
      } else {
        sp.material.opacity = 0;
      }
    }
  }

  dispose() {
    this._domeGeom.dispose();
    this._domeMat.dispose();
    this._glowGeom.dispose();
    this._glowMat.dispose();
    this._ringGeom.dispose();
    for (const ring of this._rings) ring.material.dispose();
    this._splashMat.dispose();
    for (const sp of this._splashes) sp.material.dispose();
    this._rings.length = 0;
    this._splashes.length = 0;
    // SHARED_SPLASH_TEX is intentionally NOT disposed — cached for reuse.
  }
}

// cymaticBloom.js — chromatic cymatic-orbital bloom under each molecule.
//
// Visual reference: standing-wave interference patterns + atomic orbital lobes.
// Soft airbrushed glow on a dark base, with intentional per-compound colors
// (flame-test palette + chemistry-meaningful associations).
//
// Implementation: a single horizontal plane rendered with a custom shader.
// The shader generates radial standing waves modulated by angular lobes,
// blended between three colors per compound (primary / secondary / core).
//
// Per-compound config is looked up from PALETTE by formula id; falls back
// to a derived element-based palette, then to DEFAULT_PALETTE.
//
// usage: spawnEffect('cymatic-bloom', { formulaId: 'H2O', position: [0,-1.2,0] })

const THREE = window.THREE;

const PLANE_SIZE = 4.0;
const Y_BASE     = -0.3;

// ─── Per-compound palette ──────────────────────────────────────────────
// primary  — main wave color
// secondary — wave-trough color (interference dark)
// core     — center bloom highlight
// lobes    — number of angular lobes (1=monolithic, 2=p-orbital, 4=d-, 6=f-)
// freq     — radial wave frequency (higher = denser ripples)
// chaos    — 0..1 high-freq shimmer noise
// speed    — animation speed multiplier
//
// Colors picked from real chemistry cues (flame test colors, native compound
// colors, characteristic appearance).
const PALETTE = {
  // ── Acids / aqueous ──
  'H2O':     { primary: 0x00B0CC, secondary: 0x0044BB, core: 0xCCFFFF, lobes: 2, freq: 12, chaos: 0.05, speed: 1.0 },
  'H2SO4':   { primary: 0xFFA500, secondary: 0x884400, core: 0xFFE5B4, lobes: 4, freq: 14, chaos: 0.10, speed: 1.0 },
  'HNO3':    { primary: 0xFFD700, secondary: 0xCC8800, core: 0xFFF5C8, lobes: 4, freq: 14, chaos: 0.12, speed: 1.1 },
  'HCl':     { primary: 0xACFF85, secondary: 0x66BB44, core: 0xE0FFD4, lobes: 3, freq: 14, chaos: 0.15, speed: 1.2 },
  'NH3':     { primary: 0x66E0FF, secondary: 0x2266BB, core: 0xCCEEFF, lobes: 3, freq: 12, chaos: 0.08, speed: 1.0 },
  'CH3COOH': { primary: 0xFFCC88, secondary: 0xAA5522, core: 0xFFE5CC, lobes: 4, freq: 14, chaos: 0.06, speed: 0.9 },
  // ── Salts (flame test color of the metal cation) ──
  'NaCl':    { primary: 0xFFAA33, secondary: 0x66BB44, core: 0xFFFFFF, lobes: 4, freq: 16, chaos: 0.08, speed: 1.0 },
  'NaOH':    { primary: 0xFFAA33, secondary: 0xFFFFFF, core: 0xFFE0AA, lobes: 3, freq: 12, chaos: 0.05, speed: 0.9 },
  'NaF':     { primary: 0xFFAA33, secondary: 0xACFF85, core: 0xFFE5AA, lobes: 3, freq: 14, chaos: 0.08, speed: 1.0 },
  'Na2CO3':  { primary: 0xFFAA33, secondary: 0xFFFFFF, core: 0xFFE0AA, lobes: 4, freq: 14, chaos: 0.04, speed: 0.8 },
  'NaHCO3':  { primary: 0xFFCC44, secondary: 0xFFFFFF, core: 0xFFE5AA, lobes: 4, freq: 12, chaos: 0.04, speed: 0.8 },
  'KCl':     { primary: 0xC080FF, secondary: 0x66BB44, core: 0xE5C8FF, lobes: 4, freq: 16, chaos: 0.08, speed: 1.0 },
  'KOH':     { primary: 0xC080FF, secondary: 0xFFFFFF, core: 0xE5DDFF, lobes: 3, freq: 14, chaos: 0.06, speed: 0.9 },
  'K2O':     { primary: 0xC080FF, secondary: 0xFF66CC, core: 0xE5DDFF, lobes: 4, freq: 14, chaos: 0.10, speed: 1.1 },
  'LiCl':    { primary: 0xFF3344, secondary: 0x66BB44, core: 0xFFD0D0, lobes: 4, freq: 16, chaos: 0.08, speed: 1.0 },
  'Li2O':    { primary: 0xFF3344, secondary: 0xFFAA00, core: 0xFFD0D0, lobes: 3, freq: 14, chaos: 0.10, speed: 1.0 },
  'LiH':     { primary: 0xFF3344, secondary: 0xFFFFFF, core: 0xFFE5E5, lobes: 2, freq: 12, chaos: 0.06, speed: 0.9 },
  'CaCl2':   { primary: 0xFF6622, secondary: 0x66BB44, core: 0xFFE0CC, lobes: 4, freq: 14, chaos: 0.08, speed: 1.0 },
  'CaO':     { primary: 0xFFFFFF, secondary: 0xFFAA22, core: 0xFFFFFF, lobes: 3, freq: 12, chaos: 0.05, speed: 0.9 },
  'CaOH2':   { primary: 0xFFFFFF, secondary: 0xCCFFCC, core: 0xFFFFFF, lobes: 3, freq: 12, chaos: 0.04, speed: 0.8 },
  'CaCO3':   { primary: 0xF5F5F0, secondary: 0xCCCCCC, core: 0xFFFFFF, lobes: 4, freq: 14, chaos: 0.03, speed: 0.7 },
  'MgO':     { primary: 0xFFFFFF, secondary: 0xCCEEFF, core: 0xFFFFFF, lobes: 3, freq: 14, chaos: 0.10, speed: 1.2 },
  'MgCl2':   { primary: 0xFFFFFF, secondary: 0x66BB44, core: 0xFFFFFF, lobes: 3, freq: 12, chaos: 0.06, speed: 1.0 },
  // ── Transition metal compounds (characteristic colors) ──
  'CuO':     { primary: 0x00CC88, secondary: 0x0088CC, core: 0x88FFCC, lobes: 4, freq: 14, chaos: 0.06, speed: 0.9 },
  'CuCl2':   { primary: 0x00CC88, secondary: 0x66DDFF, core: 0xCCFFE5, lobes: 4, freq: 14, chaos: 0.06, speed: 1.0 },
  'CuSO4':   { primary: 0x0099EE, secondary: 0x00CC88, core: 0xAAEEFF, lobes: 4, freq: 14, chaos: 0.05, speed: 0.9 },
  'ZnO':     { primary: 0xFFFFFF, secondary: 0xCCFF66, core: 0xFFFFFF, lobes: 3, freq: 12, chaos: 0.08, speed: 1.0 },
  'ZnCl2':   { primary: 0xFFFFFF, secondary: 0xCCFF66, core: 0xFFFFFF, lobes: 3, freq: 12, chaos: 0.06, speed: 1.0 },
  'ZnS':     { primary: 0xCCFF66, secondary: 0xFFEE44, core: 0xE5FFAA, lobes: 3, freq: 12, chaos: 0.07, speed: 1.0 },
  'FeO':     { primary: 0x884422, secondary: 0xCC6633, core: 0xFFAA66, lobes: 3, freq: 12, chaos: 0.10, speed: 0.9 },
  'Fe2O3':   { primary: 0xCC4422, secondary: 0xFF7733, core: 0xFFAA66, lobes: 4, freq: 14, chaos: 0.15, speed: 1.0 },
  'Fe3O4':   { primary: 0x442211, secondary: 0x884422, core: 0xCC6633, lobes: 4, freq: 14, chaos: 0.10, speed: 0.9 },
  'FeS':     { primary: 0x222233, secondary: 0xFFAA00, core: 0x666666, lobes: 3, freq: 12, chaos: 0.20, speed: 1.0 },
  'FeCl3':   { primary: 0xCC8822, secondary: 0xFFCC44, core: 0xFFE5AA, lobes: 4, freq: 14, chaos: 0.08, speed: 1.0 },
  'AgCl':    { primary: 0xDDDDDD, secondary: 0xFFFFFF, core: 0xFFFFFF, lobes: 3, freq: 14, chaos: 0.05, speed: 0.8 },
  'AgNO3':   { primary: 0xDDDDDD, secondary: 0xFFFAAA, core: 0xFFFFFF, lobes: 4, freq: 14, chaos: 0.05, speed: 0.9 },
  'PbO':     { primary: 0xFFCC44, secondary: 0xCC9933, core: 0xFFE5AA, lobes: 4, freq: 14, chaos: 0.06, speed: 0.7 },
  // ── Aluminium / silicon (gem-like) ──
  'AlCl3':   { primary: 0xCCDDFF, secondary: 0xFFFFFF, core: 0xEEFFFF, lobes: 4, freq: 14, chaos: 0.08, speed: 1.1 },
  'Al2O3':   { primary: 0x4466FF, secondary: 0xFFD23F, core: 0xCCDDFF, lobes: 6, freq: 18, chaos: 0.05, speed: 1.0 },
  'SiO2':    { primary: 0xCCDDFF, secondary: 0xAACCFF, core: 0xFFFFFF, lobes: 4, freq: 16, chaos: 0.04, speed: 0.9 },
  // ── Sulfur / phosphorus ──
  'SO2':     { primary: 0xFFEE33, secondary: 0xCCAA22, core: 0xFFF5AA, lobes: 3, freq: 14, chaos: 0.10, speed: 1.0 },
  'P2O5':    { primary: 0xFFCC44, secondary: 0xFFAA22, core: 0xFFEEAA, lobes: 4, freq: 14, chaos: 0.08, speed: 1.0 },
  'PCl3':    { primary: 0xACFF85, secondary: 0xCC8844, core: 0xE0FFD4, lobes: 4, freq: 14, chaos: 0.10, speed: 1.0 },
  // ── Carbon family ──
  'CO':      { primary: 0x444444, secondary: 0x888888, core: 0xCCCCCC, lobes: 2, freq: 10, chaos: 0.20, speed: 1.0 },
  'CO2':     { primary: 0x6688AA, secondary: 0xAACCEE, core: 0xCCDDEE, lobes: 3, freq: 12, chaos: 0.06, speed: 0.9 },
  'CH4':     { primary: 0xFF6B35, secondary: 0xFFD23F, core: 0xFFFFFF, lobes: 4, freq: 14, chaos: 0.18, speed: 1.4 },
  'C2H6':    { primary: 0xFF6B35, secondary: 0xFFAA22, core: 0xFFE5AA, lobes: 4, freq: 12, chaos: 0.16, speed: 1.3 },
  'C2H4':    { primary: 0xFF8844, secondary: 0xFFCC44, core: 0xFFE5AA, lobes: 4, freq: 12, chaos: 0.15, speed: 1.2 },
  'C2H2':    { primary: 0xFFFFFF, secondary: 0xFFAA22, core: 0xFFFFFF, lobes: 3, freq: 16, chaos: 0.25, speed: 1.6 },
  'C6H6':    { primary: 0xFF8800, secondary: 0xFFCC44, core: 0xFFE5AA, lobes: 6, freq: 18, chaos: 0.10, speed: 1.0 },
  'C2H5OH':  { primary: 0x4488FF, secondary: 0xCCDDFF, core: 0xCCEEFF, lobes: 3, freq: 12, chaos: 0.08, speed: 1.0 },
  'C6H12O6': { primary: 0xFFE5CC, secondary: 0xFFAACC, core: 0xFFFFFF, lobes: 6, freq: 16, chaos: 0.04, speed: 0.8 },
  'CCl4':    { primary: 0xACFF85, secondary: 0xCCCCCC, core: 0xE0FFD4, lobes: 4, freq: 14, chaos: 0.05, speed: 0.9 },
  // ── Diatomic gases ──
  'O2':      { primary: 0x4466FF, secondary: 0xCCDDFF, core: 0xFFFFFF, lobes: 2, freq: 10, chaos: 0.08, speed: 1.1 },
  'H2':      { primary: 0xFFFFFF, secondary: 0xFFCCEE, core: 0xFFFFFF, lobes: 2, freq: 10, chaos: 0.10, speed: 1.4 },
  'N2':      { primary: 0x3050F8, secondary: 0x88AAFF, core: 0xCCDDFF, lobes: 2, freq: 10, chaos: 0.05, speed: 0.9 }
};

// Element-only fallback palettes (when shown as a pure element card).
const ELEMENT_PALETTE = {
  'H':  PALETTE.H2,  'O':  PALETTE.O2,  'N':  PALETTE.N2,
  'C':  { primary: 0x444444, secondary: 0x888888, core: 0xCCCCCC, lobes: 2, freq: 10, chaos: 0.10, speed: 1.0 },
  'Na': { primary: 0xFFAA33, secondary: 0xFFCC44, core: 0xFFE5AA, lobes: 1, freq: 8,  chaos: 0.06, speed: 0.9 },
  'Cl': { primary: 0xACFF85, secondary: 0x66BB44, core: 0xE0FFD4, lobes: 2, freq: 10, chaos: 0.12, speed: 1.2 },
  'Mg': { primary: 0xFFFFFF, secondary: 0xFFEEAA, core: 0xFFFFFF, lobes: 1, freq: 10, chaos: 0.18, speed: 1.4 },
  'Fe': { primary: 0x884422, secondary: 0xCC6633, core: 0xFFAA66, lobes: 2, freq: 10, chaos: 0.10, speed: 0.9 },
  'Cu': { primary: 0x00CC88, secondary: 0x0088CC, core: 0x88FFCC, lobes: 2, freq: 10, chaos: 0.06, speed: 0.9 },
  'K':  { primary: 0xC080FF, secondary: 0xFFFFFF, core: 0xE5C8FF, lobes: 1, freq: 8,  chaos: 0.08, speed: 1.0 },
  'Ca': { primary: 0xFF6622, secondary: 0xFFCC44, core: 0xFFE0CC, lobes: 1, freq: 8,  chaos: 0.06, speed: 0.9 },
  'Al': { primary: 0xCCCCCC, secondary: 0xCCDDFF, core: 0xFFFFFF, lobes: 2, freq: 10, chaos: 0.06, speed: 0.9 },
  'Si': { primary: 0xCCDDFF, secondary: 0xAACCFF, core: 0xFFFFFF, lobes: 2, freq: 10, chaos: 0.04, speed: 0.8 },
  'Zn': { primary: 0xCCFF66, secondary: 0xFFFFFF, core: 0xE5FFAA, lobes: 1, freq: 8,  chaos: 0.06, speed: 0.9 },
  'Li': { primary: 0xFF3344, secondary: 0xFFFFFF, core: 0xFFD0D0, lobes: 1, freq: 8,  chaos: 0.06, speed: 1.0 },
  'F':  { primary: 0xACFF85, secondary: 0x66BB44, core: 0xE0FFD4, lobes: 2, freq: 10, chaos: 0.18, speed: 1.4 },
  'P':  { primary: 0xFFAA33, secondary: 0xFF6633, core: 0xFFE5AA, lobes: 2, freq: 10, chaos: 0.10, speed: 1.0 },
  'S':  { primary: 0xFFEE33, secondary: 0xCCAA22, core: 0xFFF5AA, lobes: 2, freq: 10, chaos: 0.08, speed: 0.9 },
  'He': { primary: 0xCCEEFF, secondary: 0xFFFFFF, core: 0xFFFFFF, lobes: 1, freq: 6,  chaos: 0.03, speed: 0.6 },
  'Ne': { primary: 0xFF6644, secondary: 0xFFAA88, core: 0xFFCCAA, lobes: 1, freq: 6,  chaos: 0.04, speed: 0.6 }
};

const DEFAULT_PALETTE = { primary: 0x00E5CC, secondary: 0x0066FF, core: 0xCCFFFF, lobes: 3, freq: 12, chaos: 0.08, speed: 1.0 };

function resolvePalette(opts) {
  const id = opts.formulaId;
  if (id && PALETTE[id]) return PALETTE[id];
  if (id && ELEMENT_PALETTE[id]) return ELEMENT_PALETTE[id];
  // Override via opts wins.
  if (opts.palette) return { ...DEFAULT_PALETTE, ...opts.palette };
  return DEFAULT_PALETTE;
}

// ─── Shaders ───────────────────────────────────────────────────────────
const VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = `
precision mediump float;
varying vec2 vUv;
uniform float uTime;
uniform float uLobes;
uniform float uFrequency;
uniform float uChaos;
uniform float uSpeed;
uniform vec3  uPrimary;
uniform vec3  uSecondary;
uniform vec3  uCore;

void main() {
  vec2 uv = vUv - 0.5;
  float r = length(uv) * 2.0;        // 0 at center, ~1 at edge
  float a = atan(uv.y, uv.x);

  // Multi-frequency standing-wave interference (cymatic look).
  float t = uTime * uSpeed;
  float w1 = sin(r * uFrequency - t * 1.4);
  float w2 = sin(a * uLobes - t * 0.5) * 0.5 + 0.5;        // angular lobes 0..1
  float w3 = sin((r + a * 0.2) * uFrequency * 0.7 + t * 0.6);
  float w4 = sin(r * uFrequency * 1.3 - t * 0.9 + a * uLobes * 0.4);

  float pattern = (w1 * w3 * 0.5 + w4 * 0.4) * w2;
  pattern = pattern * 0.5 + 0.5;     // [0..1]

  // High-freq shimmer (chaos).
  float n = sin(r * 60.0 - t * 3.0) * sin(a * 36.0 + t * 2.0);
  pattern += n * uChaos;

  // Soft outer falloff.
  float edge = 1.0 - smoothstep(0.42, 0.5, r);
  // Inner core bloom.
  float core = 1.0 - smoothstep(0.0, 0.18, r);

  // Color blend.
  vec3 col = mix(uSecondary, uPrimary, pattern);
  col = mix(col, uCore, core * 0.7);

  // Glow intensity.
  float intensity = clamp(pattern, 0.0, 1.4) * edge + core * 0.7;
  intensity = clamp(intensity, 0.0, 1.5);

  gl_FragColor = vec4(col * intensity, intensity * edge * 0.92);
}
`;

export class Effect {
  constructor(opts = {}) {
    this._group = new THREE.Group();
    if (Array.isArray(opts.position)) this._group.position.fromArray(opts.position);
    if (typeof opts.scale === 'number') this._group.scale.setScalar(opts.scale);

    const p = resolvePalette(opts);

    this._uniforms = {
      uTime:      { value: 0 },
      uLobes:     { value: p.lobes },
      uFrequency: { value: p.freq },
      uChaos:     { value: p.chaos },
      uSpeed:     { value: p.speed },
      uPrimary:   { value: new THREE.Color(p.primary) },
      uSecondary: { value: new THREE.Color(p.secondary) },
      uCore:      { value: new THREE.Color(p.core) }
    };

    this._mat = new THREE.ShaderMaterial({
      vertexShader:   VERT,
      fragmentShader: FRAG,
      uniforms:       this._uniforms,
      transparent:    true,
      depthWrite:     false,
      blending:       THREE.AdditiveBlending,
      side:           THREE.DoubleSide
    });

    this._geom = new THREE.PlaneGeometry(PLANE_SIZE, PLANE_SIZE, 1, 1);
    this._mesh = new THREE.Mesh(this._geom, this._mat);
    this._mesh.rotation.x = -Math.PI / 2;
    this._mesh.position.y = Y_BASE;
    this._group.add(this._mesh);

    this._t = 0;
  }

  get group() { return this._group; }

  update(dt) {
    this._t += dt;
    this._uniforms.uTime.value = this._t;
  }

  /** Update the bloom palette mid-flight (e.g. when molecule changes). */
  setPalette(opts = {}) {
    const p = resolvePalette(opts);
    this._uniforms.uLobes.value     = p.lobes;
    this._uniforms.uFrequency.value = p.freq;
    this._uniforms.uChaos.value     = p.chaos;
    this._uniforms.uSpeed.value     = p.speed;
    this._uniforms.uPrimary.value.set(p.primary);
    this._uniforms.uSecondary.value.set(p.secondary);
    this._uniforms.uCore.value.set(p.core);
  }

  dispose() {
    this._geom.dispose();
    this._mat.dispose();
  }
}

// Re-export palette for inspection / docs.
export { PALETTE, ELEMENT_PALETTE };

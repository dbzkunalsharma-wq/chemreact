// bloomBg.js — painterly chromatic bloom background.
// Soft airbrushed colored blooms drifting on a dark/cream base.
// All animation is CSS-driven. No requestAnimationFrame, no canvas.
//
// Visual references: Hilma af Klint paintings, Alex Schaefer's burning-building
// paintings, chemistry flame-test colors as gradient orbs.
//
// API:
//   mountBloomBg(container, opts) → { el, unmount, setIntensity, setPalette }

// Default palette — clean teal monochrome on dark base.
// Single accent family (matches design tokens) — keeps the UI from feeling
// like a chromatic rainbow. Pass opts.palette to override per-screen.
const FLAME_PALETTE = [
  ['#00E5CC', '#0D7377'],   // accent → teal
  ['#14BDBD', '#0A5255'],   // teal2 → teal3
  ['#00B09B', '#0A5255'],   // accent2 → teal3
  ['#00E5CC', '#08343A'],   // accent → near-black teal
  ['#14BDBD', '#0D7377']    // teal2 → teal
];

const VALID_INTENSITIES = ['soft', 'medium', 'vivid'];
const VALID_BG_MODES = ['dark', 'cream'];
const MAX_BLOOMS = 10; // perf cap — filter:blur is expensive

export function mountBloomBg(container, opts = {}) {
  const config = {
    blooms: clampInt(opts.blooms, 1, MAX_BLOOMS, 8),
    palette: Array.isArray(opts.palette) && opts.palette.length ? normalizePalette(opts.palette) : FLAME_PALETTE,
    intensity: VALID_INTENSITIES.includes(opts.intensity) ? opts.intensity : 'medium',
    bg: VALID_BG_MODES.includes(opts.bg) ? opts.bg : 'dark',
    ground: !!opts.ground,
    drift: opts.drift !== false
  };

  const root = document.createElement('div');
  root.className = `bloom-bg bloom-bg--${config.bg} bloom-bg--${config.intensity}${config.drift ? '' : ' bloom-bg--still'}`;

  const layer = document.createElement('div');
  layer.className = 'bloom-bg-layer';
  root.appendChild(layer);

  // Build all orbs once. Position/size/timing are deterministic-pseudo-random
  // per-index so the layout looks varied but stable across re-mounts in dev.
  buildOrbs(layer, config);

  // Optional grain overlay — risograph print feel.
  const grain = document.createElement('div');
  grain.className = 'bloom-bg-grain';
  root.appendChild(grain);

  // Vignette — only meaningful on dark mode.
  if (config.bg === 'dark') {
    const vignette = document.createElement('div');
    vignette.className = 'bloom-bg-vignette';
    root.appendChild(vignette);
  }

  // Ground gradient — burning-building horizon glow.
  if (config.ground) {
    const ground = document.createElement('div');
    ground.className = 'bloom-bg-ground';
    root.appendChild(ground);
  }

  container.appendChild(root);

  return {
    el: root,
    unmount() {
      root.remove();
    },
    setIntensity(name) {
      if (!VALID_INTENSITIES.includes(name) || name === config.intensity) return;
      root.classList.remove(`bloom-bg--${config.intensity}`);
      config.intensity = name;
      root.classList.add(`bloom-bg--${name}`);
    },
    setPalette(arr) {
      if (!Array.isArray(arr) || !arr.length) return;
      config.palette = normalizePalette(arr);
      // Rebuild orbs with new colors but keep same positions/timings if possible.
      layer.innerHTML = '';
      buildOrbs(layer, config);
    }
  };
}

function buildOrbs(layer, config) {
  for (let i = 0; i < config.blooms; i++) {
    const [c1, c2] = config.palette[i % config.palette.length];
    const seed = pseudoRand(i + 1);

    // Spread positions across a 5-25% padded area so blooms don't bunch corners.
    const x = 8 + seed.a * 84;       // 8% – 92%
    const y = 10 + seed.b * 80;      // 10% – 90%
    const size = 220 + seed.c * 240; // 220px – 460px
    const dur = 12 + seed.d * 10;    // 12s – 22s
    const breathDur = 6 + seed.e * 6; // 6s – 12s
    const delay = -1 * (seed.f * dur); // negative delay = pre-staggered start

    const orb = document.createElement('div');
    orb.className = 'bloom-orb';
    orb.style.cssText =
      `--c1:${c1};--c2:${c2};` +
      `--x:${x.toFixed(1)}%;--y:${y.toFixed(1)}%;` +
      `--size:${Math.round(size)}px;` +
      `--dur:${dur.toFixed(1)}s;--breath-dur:${breathDur.toFixed(1)}s;` +
      `--delay:${delay.toFixed(2)}s`;
    layer.appendChild(orb);
  }
}

// Accept either ['#hex', '#hex'] pairs or flat ['#hex', '#hex', ...] (will be paired).
function normalizePalette(arr) {
  if (Array.isArray(arr[0])) return arr.filter(p => Array.isArray(p) && p.length >= 2);
  const out = [];
  for (let i = 0; i < arr.length; i += 2) {
    out.push([arr[i], arr[i + 1] || arr[i]]);
  }
  return out.length ? out : FLAME_PALETTE;
}

function clampInt(v, lo, hi, fallback) {
  const n = Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.max(lo, Math.min(hi, n));
}

// Tiny deterministic-ish pseudo-random — six independent fractional values per
// seed. Good enough for visual variety; not cryptographic.
function pseudoRand(n) {
  const f = (x) => {
    const v = Math.sin(x) * 43758.5453;
    return v - Math.floor(v);
  };
  return {
    a: f(n * 12.9898),
    b: f(n * 78.233),
    c: f(n * 37.719),
    d: f(n * 4.1414),
    e: f(n * 91.547),
    f: f(n * 24.812)
  };
}

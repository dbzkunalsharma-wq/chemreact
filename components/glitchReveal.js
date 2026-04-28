// glitchReveal.js — digital glitch overlay that resolves into the molecule.
//
// Plays once when a molecule first appears. Mounts a DOM overlay on top of
// the viewer container with object-detection rectangles, RGB-split scanlines,
// chromatic paint splats, and a "ANALYZING" code-style label. The whole
// overlay fades out over ~1.2s, revealing the 3D molecule + cymatic bloom
// already rendering behind it.
//
// usage:
//   const handle = playGlitchReveal(viewerHostEl, { duration: 1200, label: 'H₂O' });
//   handle.close();   // optional early-cancel

const RECT_LABELS = ['MOL', 'C-H', 'O-H', 'BOND', 'OXY', 'ATOM', 'ZN', 'NaCl', 'IONIC', 'H+', '14.01', 'sp3'];
const RECT_PRESETS = [
  { x: '10%', y: '18%', w: 64,  h: 14 },
  { x: '60%', y: '12%', w: 44,  h: 12 },
  { x: '30%', y: '70%', w: 80,  h: 14 },
  { x: '70%', y: '60%', w: 50,  h: 12 },
  { x: '20%', y: '50%', w: 72,  h: 12 },
  { x: '78%', y: '28%', w: 38,  h: 12 },
  { x: '12%', y: '82%', w: 48,  h: 12 }
];

const SPLAT_PRESETS = [
  { x: '25%', y: '80%', cls: 'splat-yellow' },
  { x: '60%', y: '30%', cls: 'splat-cyan' },
  { x: '75%', y: '75%', cls: 'splat-magenta' },
  { x: '15%', y: '35%', cls: 'splat-cyan' },
  { x: '85%', y: '50%', cls: 'splat-yellow' }
];

export function playGlitchReveal(container, { duration = 1200, label = 'ANALYZING' } = {}) {
  if (!container) return { close() {} };

  // Make sure container can host an absolute child.
  const prevPos = container.style.position;
  if (!prevPos || prevPos === 'static') container.style.position = 'relative';

  const overlay = document.createElement('div');
  overlay.className = 'glitch-overlay';
  overlay.style.setProperty('--glitch-duration', `${duration}ms`);

  // Scanlines layer (sweeps).
  const scan = document.createElement('div');
  scan.className = 'glitch-scanlines';
  overlay.appendChild(scan);

  // RGB-split chromatic bands (3 horizontal slices that drift).
  for (let i = 0; i < 3; i++) {
    const band = document.createElement('div');
    band.className = 'glitch-band';
    band.style.setProperty('--top', `${20 + i * 25 + Math.random() * 8}%`);
    band.style.setProperty('--d', `${i * 0.18}s`);
    overlay.appendChild(band);
  }

  // Detection rectangles with code-y labels.
  RECT_PRESETS.forEach((r, i) => {
    const rect = document.createElement('div');
    rect.className = 'glitch-rect';
    rect.textContent = RECT_LABELS[i % RECT_LABELS.length];
    rect.style.setProperty('--x', r.x);
    rect.style.setProperty('--y', r.y);
    rect.style.setProperty('--w', `${r.w}px`);
    rect.style.setProperty('--h', `${r.h}px`);
    rect.style.setProperty('--d', `${(i % 4) * 0.06}s`);
    overlay.appendChild(rect);
  });

  // Color paint splats.
  SPLAT_PRESETS.forEach((s, i) => {
    const splat = document.createElement('div');
    splat.className = `glitch-splat ${s.cls}`;
    splat.style.setProperty('--x', s.x);
    splat.style.setProperty('--y', s.y);
    splat.style.setProperty('--d', `${i * 0.08}s`);
    overlay.appendChild(splat);
  });

  // Center label with chromatic ghost.
  const lbl = document.createElement('div');
  lbl.className = 'glitch-label';
  lbl.textContent = label;
  lbl.setAttribute('data-text', label);
  overlay.appendChild(lbl);

  // Vignette wrap fades the whole thing out at the end.
  container.appendChild(overlay);

  let closed = false;
  const timer = setTimeout(() => {
    if (closed) return;
    closed = true;
    overlay.remove();
    if (prevPos === '' || prevPos == null) container.style.position = '';
  }, duration + 60);

  return {
    el: overlay,
    close() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      overlay.remove();
      if (prevPos === '' || prevPos == null) container.style.position = '';
    }
  };
}

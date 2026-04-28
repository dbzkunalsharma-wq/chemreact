// chemAsciiBg.js — chemistry symbol-art atom field.
//
// A canvas where chemistry symbols (single elements + small formulas) are
// arranged on a grid, with brightness/density mapped to an underlying
// luminance image of an atom (or other chem visual). From a distance the
// shape reads as an atom; up close it's chemistry.
//
// Layered effects (subtle, not flashy):
//   1. Smooth luminance ramp — dim → mid → bright cyan blends shape into field
//   2. Per-cell symbol cycling every 0.4–1.7× swapInterval, staggered
//   3. Per-cell twinkle — independent sine on alpha, scaled by lum
//   4. Slow pulse wave from atom center (radial brightness ring expanding out)
//   5. Vignette — corners darken to deep navy, focuses the eye
//   6. Nuclear spark — warm bright core at atom nucleus (additive blend)
//
// API: mountChemAsciiBg(parent, opts) → { el, unmount }
//
// Opts (all optional):
//   cols           grid width                   (default 62)
//   palette        'cyan' | 'amber'             (default 'cyan')
//   sourceImage    'atom' | 'benzene' | 'flask' | 'dna'  (default 'atom')
//   swapInterval   ms between symbol swaps      (default 1100)
//   pulseCycle     ms per pulse wave            (default 5400)
//   vignette       0..1, corner darkening       (default 0.92)
//   density        0..1, fill rate ambient      (default 0.72)

const ELEMENTS = ['H','O','C','N','Na','Fe','Cu','Ag','Au','K','Cl','Mg','Ca','Zn','S','P','Li','Br','Si','Al','Mn','Co','Ni','Pb','Sn'];
const FORMULAS = ['H₂O','CO₂','NH₃','CH₄','NaCl','O₂','HCl','H₂','N₂','SO₂','HNO₃','H₂SO₄','C₆H₆','NaOH','KCl','MgO','CaO','FeO'];

const PALETTES = {
  cyan:  { bg:'#02060a', shadow:[2,6,10],  dim:[60,170,180],  mid:[120,235,220], bright:[230,255,250] },
  amber: { bg:'#0a0602', shadow:[10,6,2],  dim:[160,110,70],  mid:[240,180,100], bright:[255,235,190] }
};

// ───── Source-image generators ─────────────────────────────────────────
// Each draws a high-contrast B&W silhouette onto a hidden canvas. We
// downsample its luminance per grid cell to drive symbol density/brightness.
const SOURCES = {
  atom(x, w, h) {
    const cx = w/2, cy = h/2;
    const Rorb = Math.min(w,h) * 0.42;
    const rNuc = Math.min(w,h) * 0.085;
    x.strokeStyle = '#fff'; x.fillStyle = '#fff';
    // Glowing nucleus = solid + halo (sampled into lum as a smooth gradient)
    x.beginPath(); x.arc(cx, cy, rNuc * 1.6, 0, Math.PI*2);
    x.globalAlpha = 0.35; x.fill(); x.globalAlpha = 1;
    x.beginPath(); x.arc(cx, cy, rNuc, 0, Math.PI*2); x.fill();
    // 3 elliptical orbits, each rotated 60°
    x.lineWidth = w * 0.011;
    for (let i = 0; i < 3; i++) {
      x.save(); x.translate(cx, cy); x.rotate(i * Math.PI/3);
      x.beginPath(); x.ellipse(0, 0, Rorb, Rorb * 0.34, 0, 0, Math.PI*2); x.stroke();
      x.restore();
    }
    // 3 electrons per orbit, evenly spaced
    for (let i = 0; i < 3; i++) {
      for (const t of [0, Math.PI*2/3, Math.PI*4/3]) {
        x.save(); x.translate(cx, cy); x.rotate(i * Math.PI/3);
        x.beginPath(); x.arc(Math.cos(t) * Rorb, Math.sin(t) * Rorb * 0.34, w*0.022, 0, Math.PI*2); x.fill();
        x.restore();
      }
    }
  },
  benzene(x, w, h) {
    const cx = w/2, cy = h/2, r = Math.min(w,h) * 0.34;
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = w * 0.025;
    const v = []; for (let i = 0; i < 6; i++) { const a = -Math.PI/2 + i*Math.PI/3; v.push([cx + Math.cos(a)*r, cy + Math.sin(a)*r]); }
    x.beginPath(); v.forEach(([px,py],i) => i ? x.lineTo(px,py) : x.moveTo(px,py)); x.closePath(); x.stroke();
    for (let i = 0; i < 6; i += 2) {
      const [a1,b1] = v[i], [a2,b2] = v[(i+1)%6];
      x.beginPath();
      x.moveTo(cx + (a1-cx)*0.78, cy + (b1-cy)*0.78);
      x.lineTo(cx + (a2-cx)*0.78, cy + (b2-cy)*0.78);
      x.stroke();
    }
    v.forEach(([px,py]) => { x.beginPath(); x.arc(px, py, w*0.022, 0, Math.PI*2); x.fill(); });
  },
  flask(x, w, h) {
    const cx = w/2, cy = h*0.55, fw = w*0.5, fh = h*0.55, nw = w*0.13, nh = h*0.18;
    x.strokeStyle = '#fff'; x.lineWidth = w * 0.014;
    x.beginPath();
    x.moveTo(cx - nw/2, cy - fh/2 - nh); x.lineTo(cx - nw/2, cy - fh/2);
    x.lineTo(cx - fw/2, cy + fh/2);      x.lineTo(cx + fw/2, cy + fh/2);
    x.lineTo(cx + nw/2, cy - fh/2);      x.lineTo(cx + nw/2, cy - fh/2 - nh);
    x.stroke();
    const liqY = cy + fh*0.1;
    const sl = (-(fw - nw) / 2) / fh;
    const lx = cx - nw/2 + sl * (liqY - (cy - fh/2));
    const rx = cx + nw/2 - sl * (liqY - (cy - fh/2));
    x.fillStyle = 'rgba(255,255,255,0.7)';
    x.beginPath();
    x.moveTo(lx, liqY); x.lineTo(rx, liqY); x.lineTo(cx + fw/2, cy + fh/2); x.lineTo(cx - fw/2, cy + fh/2);
    x.closePath(); x.fill();
    x.fillStyle = '#fff';
    for (let i = 0; i < 6; i++) {
      const bx = cx + Math.sin(i*1.7) * fw*0.3, by = cy + (i%3) * fh*0.1;
      x.beginPath(); x.arc(bx, by, w*0.014, 0, Math.PI*2); x.fill();
    }
  },
  dna(x, w, h) {
    const cx = w/2, amp = w*0.18, wl = h*0.32, y0 = h*0.08, y1 = h*0.92;
    x.strokeStyle = '#fff'; x.lineWidth = w * 0.014;
    for (const ph of [0, Math.PI]) {
      x.beginPath();
      for (let y = y0; y <= y1; y += 1.5) {
        const px = cx + Math.sin((y - y0) / wl * Math.PI*2 + ph) * amp;
        if (y === y0) x.moveTo(px, y); else x.lineTo(px, y);
      }
      x.stroke();
    }
    x.lineWidth = w * 0.007;
    for (let y = y0; y <= y1; y += wl*0.16) {
      const ph = (y - y0) / wl * Math.PI * 2;
      x.beginPath();
      x.moveTo(cx + Math.sin(ph)*amp, y);
      x.lineTo(cx + Math.sin(ph + Math.PI)*amp, y);
      x.stroke();
    }
  }
};

// 4× supersampled box average → smooth shape edges instead of jagged.
function buildSourceLum(kind, gw, gh) {
  const scale = 4, w = gw * scale, h = gh * scale;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
  (SOURCES[kind] || SOURCES.atom)(x, w, h);
  const data = x.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    let s = 0;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const i = ((gy*scale + dy) * w + gx*scale + dx) * 4;
      s += 0.299*data[i] + 0.587*data[i+1] + 0.114*data[i+2];
    }
    lum[gy*gw + gx] = s / (scale*scale*255);
  }
  return lum;
}

function lerp(a, b, t) { return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t, a[2]+(b[2]-a[2])*t]; }
function rampColor(L, pal) {
  if (L < 0.4) return lerp(pal.dim, pal.mid, L / 0.4);
  return lerp(pal.mid, pal.bright, (L - 0.4) / 0.6);
}

export function mountChemAsciiBg(parent, opts = {}) {
  const cfg = {
    cols:         opts.cols         ?? 62,
    palette:      opts.palette      || 'cyan',
    sourceImage:  opts.sourceImage  || 'atom',
    swapInterval: opts.swapInterval ?? 1100,
    pulseCycle:   opts.pulseCycle   ?? 5400,
    vignette:     opts.vignette     ?? 0.92,
    density:      opts.density      ?? 0.72
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'chem-ascii-bg';
  Object.assign(canvas.style, {
    position:      'absolute',
    inset:         '0',
    width:         '100%',
    height:        '100%',
    pointerEvents: 'none'
  });
  parent.appendChild(canvas);

  const ctx = canvas.getContext('2d');

  // ── State (re-init on resize) ──
  let cellW, cellH, cols, rows, lum;
  let cells = [];
  let vignetteGrad = null;
  let centerX = 0, centerY = 0, maxRad = 0;
  let viewW = 0, viewH = 0;

  function pickSym(L) {
    if (L < 0.04) return Math.random() < cfg.density * 0.14 ? '·' : null;
    if (L < 0.18) return Math.random() < cfg.density * 0.55 ? ELEMENTS[(Math.random()*ELEMENTS.length)|0] : null;
    if (L > 0.55) return FORMULAS[(Math.random()*FORMULAS.length)|0];
    return ELEMENTS[(Math.random()*ELEMENTS.length)|0];
  }

  function buildCells() {
    cells = new Array(rows);
    for (let y = 0; y < rows; y++) {
      const row = new Array(cols);
      for (let x = 0; x < cols; x++) {
        const L = lum[y*cols + x];
        row[x] = {
          sym:     pickSym(L),
          lum:     L,
          swapAt:  Math.random() * cfg.swapInterval * 1.5,
          twinkle: Math.random() * Math.PI * 2,
          px: 0, py: 0, dist: 0
        };
      }
      cells[y] = row;
    }
    // Atom slightly off-center for compositional tension.
    centerX = viewW * 0.55;
    centerY = viewH * 0.42;
    maxRad  = Math.hypot(Math.max(centerX, viewW - centerX),
                         Math.max(centerY, viewH - centerY));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const c = cells[y][x];
      c.px = (x + 0.5) * cellW;
      c.py = (y + 0.5) * cellH;
      c.dist = Math.hypot(c.px - centerX, c.py - centerY);
    }
  }

  function buildVignette() {
    const pal = PALETTES[cfg.palette];
    const g = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRad);
    g.addColorStop(0,    `rgba(${pal.shadow[0]},${pal.shadow[1]},${pal.shadow[2]},0)`);
    g.addColorStop(0.45, `rgba(${pal.shadow[0]},${pal.shadow[1]},${pal.shadow[2]},0)`);
    g.addColorStop(1,    `rgba(${pal.shadow[0]},${pal.shadow[1]},${pal.shadow[2]},${cfg.vignette})`);
    vignetteGrad = g;
  }

  function resize() {
    const rect = parent.getBoundingClientRect();
    viewW = Math.max(1, Math.floor(rect.width));
    viewH = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width  = viewW * dpr;
    canvas.height = viewH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols  = cfg.cols;
    cellW = viewW / cols;
    cellH = cellW * 1.55;
    rows  = Math.ceil(viewH / cellH) + 1;
    lum   = buildSourceLum(cfg.sourceImage, cols, rows);
    buildCells();
    buildVignette();
  }

  // ── Render loop ──
  let raf = null;
  let last = performance.now();
  let pulseT = 0;

  function tick(now) {
    const dt = Math.min(60, now - last);
    last = now;
    const pal = PALETTES[cfg.palette];

    pulseT = (pulseT + dt / cfg.pulseCycle) % 1;
    const pulseActive = pulseT < 0.6 ? pulseT / 0.6 : 0;
    const pulseR      = pulseActive * (maxRad + 60);
    const pulseFade   = pulseActive > 0 ? (1 - pulseT/0.6) : 0;

    // Background wash + clear.
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.font = `${(cellH*0.62)|0}px ui-monospace, "JetBrains Mono", "IBM Plex Mono", Consolas, monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < rows; y++) {
      const row = cells[y];
      for (let x = 0; x < cols; x++) {
        const c = row[x];
        c.swapAt  -= dt;
        c.twinkle += dt * 0.0035;

        if (c.swapAt <= 0) {
          c.sym = pickSym(c.lum);
          c.swapAt = cfg.swapInterval * (0.4 + Math.random()*1.3);
        }
        if (!c.sym) continue;

        let alpha = 0.10 + c.lum * 0.85;
        alpha += (Math.sin(c.twinkle*6) * 0.5 + 0.5) * 0.32 * (0.5 + c.lum * 0.5);
        if (pulseActive > 0) {
          const pd = Math.abs(c.dist - pulseR);
          if (pd < 38) alpha += (1 - pd / 38) * 0.45 * pulseFade * (0.4 + c.lum * 0.6);
        }
        alpha = Math.min(1, Math.max(0, alpha));

        const rgb = rampColor(c.lum, pal);
        ctx.fillStyle = `rgba(${rgb[0]|0},${rgb[1]|0},${rgb[2]|0},${alpha.toFixed(3)})`;
        ctx.fillText(c.sym, c.px, c.py);
      }
    }

    // Nuclear spark — warm bright core at atom center, additive blend.
    const sparkPulse = 0.75 + Math.sin(pulseT * Math.PI * 2) * 0.25;
    const sparkR     = Math.min(viewW, viewH) * 0.16;
    const sg = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, sparkR);
    sg.addColorStop(0,    `rgba(255, 232, 180, ${(0.55 * sparkPulse).toFixed(3)})`);
    sg.addColorStop(0.25, `rgba(180, 240, 220, ${(0.30 * sparkPulse).toFixed(3)})`);
    sg.addColorStop(0.6,  `rgba(40, 100, 110, ${(0.10 * sparkPulse).toFixed(3)})`);
    sg.addColorStop(1,    'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sg;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.globalCompositeOperation = 'source-over';

    // Vignette — corners darken so eye locks to center.
    if (vignetteGrad) {
      ctx.fillStyle = vignetteGrad;
      ctx.fillRect(0, 0, viewW, viewH);
    }

    raf = requestAnimationFrame(tick);
  }

  resize();
  raf = requestAnimationFrame(tick);

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(onResize);
    ro.observe(parent);
  }

  return {
    el: canvas,
    unmount() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (ro) { try { ro.disconnect(); } catch (_e) {} }
      try { canvas.remove(); } catch (_e) {}
    }
  };
}

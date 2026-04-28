// molMark.js — 2D metaball molecule mark in the splash-logo style.
//
// Atoms are drawn as overlapping circles (sized by element); a goo filter
// (Gaussian blur + alpha threshold) merges them into one connected blob —
// the same Hirosaki-Arts-Pollination aesthetic used by `splash.js` for the
// "CR" wordmark. Used wherever a molecule needs a distinctive icon (reaction
// cards, journal entries, etc.).
//
// Usage:
//   const mark = mountMolMark(parent, { components: { H: 2, O: 1 }, size: 60 });
//   mark.unmount();
//
// `components` is the same shape used by compounds.json — symbol → count.

const SVG_NS = 'http://www.w3.org/2000/svg';

// Approximate atom radii in viewBox units. Scaled to make light atoms small
// "satellites" hanging off heavier "core" atoms — matches how chemists draw
// ball-and-stick models, and reads well after the goo merge.
const ATOM_RADIUS = {
  H: 8,  He: 9,  Li: 13, Be: 12, B:  12, C:  14, N:  13, O:  14, F:  12, Ne: 12,
  Na: 16, Mg: 14, Al: 14, Si: 14, P:  14, S:  14, Cl: 14, Ar: 13,
  K:  17, Ca: 16, Fe: 15, Cu: 15, Zn: 15, Br: 15, Ag: 16, I:  16, Au: 16,
  Hg: 16, Pb: 16
};
function radiusOf(sym) { return ATOM_RADIUS[sym] || 12; }

// ── Layout ──────────────────────────────────────────────────────────────
// Heaviest atom goes to the center; others arrange around it. Distances
// are tuned so adjacent circles overlap by ~15–20% of their summed radii —
// just enough that the goo bridges them organically.

function flatten(components) {
  const atoms = [];
  for (const sym of Object.keys(components || {})) {
    const n = components[sym] | 0;
    for (let i = 0; i < n; i++) atoms.push(sym);
  }
  return atoms.sort((a, b) => radiusOf(b) - radiusOf(a));
}

function layout(atoms) {
  if (atoms.length === 0) return [];

  if (atoms.length === 1) {
    return [{ sym: atoms[0], cx: 0, cy: 0, r: radiusOf(atoms[0]) }];
  }

  if (atoms.length === 2) {
    const r1 = radiusOf(atoms[0]);
    const r2 = radiusOf(atoms[1]);
    const d  = (r1 + r2) * 0.78;
    return [
      { sym: atoms[0], cx: -d * (r2 / (r1 + r2)), cy: 0, r: r1 },
      { sym: atoms[1], cx:  d * (r1 / (r1 + r2)), cy: 0, r: r2 }
    ];
  }

  if (atoms.length === 3) {
    // Bent (water-like): heaviest center, two satellites at ~104° opening
    // pulled DOWN so the molecule sits stably on its base.
    const [c, a, b] = atoms;
    const rc = radiusOf(c), ra = radiusOf(a), rb = radiusOf(b);
    const half = 52 * Math.PI / 180;
    const da = (rc + ra) * 0.82;
    const db = (rc + rb) * 0.82;
    return [
      { sym: c, cx: 0, cy: 0, r: rc },
      { sym: a, cx: -Math.sin(half) * da, cy:  Math.cos(half) * da, r: ra },
      { sym: b, cx:  Math.sin(half) * db, cy:  Math.cos(half) * db, r: rb }
    ];
  }

  // 4+: heaviest at center, others on an evenly-spaced ring around it.
  // Starting angle puts the first satellite at 12 o'clock so the result
  // looks balanced even with 3, 4, or 6 satellites.
  const c = atoms[0];
  const ring = atoms.slice(1);
  const rc = radiusOf(c);
  const result = [{ sym: c, cx: 0, cy: 0, r: rc }];
  ring.forEach((s, i) => {
    const r = radiusOf(s);
    const angle = -Math.PI / 2 + (i / ring.length) * Math.PI * 2;
    const overlap = ring.length >= 5 ? 0.74 : 0.82;
    const d = (rc + r) * overlap;
    result.push({ sym: s, cx: Math.cos(angle) * d, cy: Math.sin(angle) * d, r });
  });
  return result;
}

// ── DOM ─────────────────────────────────────────────────────────────────

let _idCounter = 0;
function nextId() { return `mm-${++_idCounter}-${Math.random().toString(36).slice(2, 7)}`; }

function darken(hex, factor = 0.62) {
  const c = (hex || '').replace('#', '');
  if (c.length !== 6) return '#00B09B';
  const r = Math.round(parseInt(c.slice(0, 2), 16) * factor);
  const g = Math.round(parseInt(c.slice(2, 4), 16) * factor);
  const b = Math.round(parseInt(c.slice(4, 6), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function mountMolMark(parent, opts = {}) {
  const components = opts.components || {};
  const size       = opts.size || 64;
  // Optional: override the teal default with an element-specific tint.
  const accent = opts.accent || null;

  const atoms = layout(flatten(components));
  if (atoms.length === 0) {
    return { el: null, unmount() {} };
  }

  // viewBox padded just enough that the goo blur doesn't clip at the edges.
  const minX = Math.min(...atoms.map(a => a.cx - a.r)) - 6;
  const maxX = Math.max(...atoms.map(a => a.cx + a.r)) + 6;
  const minY = Math.min(...atoms.map(a => a.cy - a.r)) - 6;
  const maxY = Math.max(...atoms.map(a => a.cy + a.r)) + 6;
  const w = maxX - minX, h = maxY - minY;

  // Scale the viewBox so longer/narrower molecules don't shrink off-center.
  // We keep it square by expanding the smaller axis around the center.
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const side = Math.max(w, h);
  const vbX = cx - side / 2;
  const vbY = cy - side / 2;

  const id = nextId();
  const gooId  = `${id}-goo`;
  const gradId = `${id}-grad`;

  const stop1 = accent || '#14F0D8';
  const stop2 = accent ? darken(accent) : '#00B09B';

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `${vbX.toFixed(2)} ${vbY.toFixed(2)} ${side.toFixed(2)} ${side.toFixed(2)}`);
  svg.setAttribute('width',  String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('class', 'mol-mark');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = `
    <defs>
      <filter id="${gooId}" x="-25%" y="-25%" width="150%" height="150%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
        <feColorMatrix in="b" mode="matrix" values="
          1 0 0 0 0
          0 1 0 0 0
          0 0 1 0 0
          0 0 0 22 -10" result="g"/>
        <feComposite in="SourceGraphic" in2="g" operator="atop"/>
      </filter>
      <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%"  stop-color="${stop1}"/>
        <stop offset="100%" stop-color="${stop2}"/>
      </linearGradient>
    </defs>
    <g filter="url(#${gooId})" fill="url(#${gradId})">
      ${atoms.map(a =>
        `<circle cx="${a.cx.toFixed(2)}" cy="${a.cy.toFixed(2)}" r="${a.r.toFixed(2)}"/>`
      ).join('')}
    </g>
  `;
  parent.appendChild(svg);

  return {
    el: svg,
    unmount() { try { svg.remove(); } catch (_e) {} }
  };
}

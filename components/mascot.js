// mascot.js — Procedural chemistry-flask mascot character.
//
// Renders an SVG bottle/beaker character with a face, animated liquid, and
// stick arms. Expressions and poses are CSS class swaps so styling stays in
// mascot.css. Intended to be replaceable later with a proper PNG/SVG asset:
// the public surface (mountMascot + setExpression + setPose) is what callers
// depend on.
//
// Usage:
//   const m = mountMascot(parent, { size: 96, expression: 'happy', pose: 'idle' });
//   m.setExpression('wow');
//   m.setPose('celebrate');
//   m.unmount();
//
// Expressions: happy | excited | thinking | wow | wink
// Poses:       idle | bounce | wave | celebrate
//
// Self-contained — no shared imports.
//
// SVG anatomy (viewBox 0 0 100 130):
//   - Cork rectangle (top, ~y=4..18)
//   - Flask neck (y=18..36)
//   - Round body (cx=50, cy=78, rx=42, ry=40)
//   - Liquid clipped inside body, with a sloshing sine-wave top
//   - Two big white eyes with pupils
//   - Mouth (path swapped per expression)
//   - Two stick arms at sides
//   - Sparkle particles around it (only visible during 'celebrate')

const EXPRESSIONS = new Set(['happy', 'excited', 'thinking', 'wow', 'wink']);
const POSES       = new Set(['idle', 'bounce', 'wave', 'celebrate']);

const SVG_NS = 'http://www.w3.org/2000/svg';

export function mountMascot(parent, { size = 80, expression = 'happy', pose = 'idle' } = {}) {
  if (!EXPRESSIONS.has(expression)) expression = 'happy';
  if (!POSES.has(pose)) pose = 'idle';

  const el = document.createElement('div');
  el.className = `mascot mascot-pose-${pose} mascot-expr-${expression}`;
  el.style.setProperty('--mascot-size', `${size}px`);

  el.innerHTML = buildSvg();

  // Cache references to parts that change on expression swap.
  const refs = {
    body:        el.querySelector('.mascot-body'),
    eyesLeft:    el.querySelector('.mascot-eye-left'),
    eyesRight:   el.querySelector('.mascot-eye-right'),
    pupilLeft:   el.querySelector('.mascot-pupil-left'),
    pupilRight:  el.querySelector('.mascot-pupil-right'),
    mouth:       el.querySelector('.mascot-mouth'),
    brow:        el.querySelector('.mascot-brow'),
    sparkles:    el.querySelector('.mascot-sparkles'),
  };

  applyExpression(refs, expression);

  parent.appendChild(el);

  let currentExpression = expression;
  let currentPose       = pose;

  return {
    el,
    setExpression(name) {
      if (!EXPRESSIONS.has(name) || name === currentExpression) return;
      el.classList.remove(`mascot-expr-${currentExpression}`);
      el.classList.add(`mascot-expr-${name}`);
      currentExpression = name;
      applyExpression(refs, name);
    },
    setPose(name) {
      if (!POSES.has(name) || name === currentPose) return;
      el.classList.remove(`mascot-pose-${currentPose}`);
      el.classList.add(`mascot-pose-${name}`);
      currentPose = name;
    },
    unmount() {
      el.remove();
    },
  };
}

// ─── SVG construction ─────────────────────────────────────────────────────

function buildSvg() {
  // Single multi-line SVG so callers can drop it inline.
  // All coordinates in viewBox space; CSS sizes the wrapper.
  return `
<svg class="mascot-body" viewBox="0 0 100 130" xmlns="${SVG_NS}" role="img" aria-label="Mascot">
  <defs>
    <clipPath id="mascot-flask-clip" clipPathUnits="userSpaceOnUse">
      <!-- Mirror of the body silhouette so liquid stays inside -->
      <path d="
        M 39 28
        L 39 36
        C 25 42 14 56 14 78
        C 14 102 32 118 50 118
        C 68 118 86 102 86 78
        C 86 56 75 42 61 36
        L 61 28
        Z
      "/>
    </clipPath>
    <radialGradient id="mascot-eye-shine" cx="0.35" cy="0.3" r="0.7">
      <stop offset="0%"  stop-color="#ffffff" stop-opacity="1"/>
      <stop offset="100%" stop-color="#dfe7f5" stop-opacity="1"/>
    </radialGradient>
  </defs>

  <!-- Sparkles sit behind the flask so the body overlaps them slightly -->
  <g class="mascot-sparkles" aria-hidden="true">
    <circle class="mascot-spark mascot-spark-1" cx="14" cy="40" r="2.2"/>
    <circle class="mascot-spark mascot-spark-2" cx="86" cy="46" r="1.6"/>
    <circle class="mascot-spark mascot-spark-3" cx="10" cy="86" r="1.8"/>
    <circle class="mascot-spark mascot-spark-4" cx="92" cy="92" r="2.0"/>
    <circle class="mascot-spark mascot-spark-5" cx="50" cy="14" r="1.4"/>
  </g>

  <!-- Stick arms (drawn before body so shoulders read as attached) -->
  <g class="mascot-arms">
    <path class="mascot-arm mascot-arm-left"
          d="M 18 78 Q 8 76 4 68"
          fill="none" stroke-width="3" stroke-linecap="round"/>
    <path class="mascot-arm mascot-arm-right"
          d="M 82 78 Q 92 76 96 68"
          fill="none" stroke-width="3" stroke-linecap="round"/>
  </g>

  <!-- Cork (warm brown) -->
  <rect class="mascot-cork" x="40" y="4" width="20" height="14" rx="2.5"/>
  <rect class="mascot-cork-band" x="38" y="14" width="24" height="5" rx="1.5"/>

  <!-- Flask neck + body outline -->
  <path class="mascot-flask"
        d="
          M 39 18
          L 39 36
          C 25 42 14 56 14 78
          C 14 102 32 118 50 118
          C 68 118 86 102 86 78
          C 86 56 75 42 61 36
          L 61 18
          Z
        "
        stroke-width="2.5" stroke-linejoin="round"/>

  <!-- Liquid (clipped to flask). Wave path sits at the top of the fill. -->
  <g clip-path="url(#mascot-flask-clip)">
    <rect class="mascot-liquid-fill" x="0" y="64" width="100" height="60"/>
    <path class="mascot-liquid-wave"
          d="
            M -20 64
            Q 0 58 20 64
            T 60 64
            T 100 64
            T 140 64
            L 140 70
            L -20 70
            Z
          "/>
    <!-- Bubbles inside liquid -->
    <circle class="mascot-bubble mascot-bubble-1" cx="38" cy="98" r="2"/>
    <circle class="mascot-bubble mascot-bubble-2" cx="58" cy="106" r="1.4"/>
    <circle class="mascot-bubble mascot-bubble-3" cx="48" cy="90" r="1.1"/>
  </g>

  <!-- Highlight on glass (above liquid) -->
  <path class="mascot-shine"
        d="M 24 60 Q 22 80 30 100"
        fill="none" stroke-width="3" stroke-linecap="round"/>

  <!-- Face -->
  <g class="mascot-face">
    <!-- Eyebrow (only visible in 'thinking') -->
    <path class="mascot-brow"
          d="M 32 60 Q 38 56 44 60"
          fill="none" stroke-width="2.2" stroke-linecap="round"/>

    <!-- Eyes -->
    <ellipse class="mascot-eye mascot-eye-left"  cx="38" cy="72" rx="7" ry="8" fill="url(#mascot-eye-shine)"/>
    <ellipse class="mascot-eye mascot-eye-right" cx="62" cy="72" rx="7" ry="8" fill="url(#mascot-eye-shine)"/>
    <circle  class="mascot-pupil mascot-pupil-left"  cx="39" cy="74" r="3.2"/>
    <circle  class="mascot-pupil mascot-pupil-right" cx="63" cy="74" r="3.2"/>
    <circle  class="mascot-glint mascot-glint-left"  cx="40.5" cy="72" r="1.1" fill="#ffffff"/>
    <circle  class="mascot-glint mascot-glint-right" cx="64.5" cy="72" r="1.1" fill="#ffffff"/>

    <!-- Mouth (path swapped per expression) -->
    <path class="mascot-mouth"
          d="M 42 90 Q 50 96 58 90"
          fill="none" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>
  `.trim();
}

// ─── Expression application ────────────────────────────────────────────────
// Most variation is CSS, but the mouth path itself differs per expression so
// we set the `d` attribute imperatively (cheaper than swapping SVGs).

const MOUTHS = {
  happy:    'M 42 90 Q 50 97 58 90',                          // wide smile
  excited:  'M 42 88 Q 50 100 58 88 Q 50 95 42 88 Z',         // big open mouth
  thinking: 'M 44 92 Q 50 90 56 93',                          // small wry curve
  wow:      'M 50 92 m -3.5 0 a 3.5 4 0 1 0 7 0 a 3.5 4 0 1 0 -7 0',  // O mouth
  wink:     'M 41 89 Q 50 96 59 90',                          // smile (slight asym)
};

function applyExpression(refs, name) {
  if (refs.mouth) refs.mouth.setAttribute('d', MOUTHS[name] || MOUTHS.happy);
  // Filling: 'wow' and 'excited' have an open mouth (filled dark)
  if (refs.mouth) {
    if (name === 'wow' || name === 'excited') {
      refs.mouth.setAttribute('fill', 'currentColor');
      refs.mouth.classList.add('mascot-mouth-open');
    } else {
      refs.mouth.setAttribute('fill', 'none');
      refs.mouth.classList.remove('mascot-mouth-open');
    }
  }
}

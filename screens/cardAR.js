// cardAR.js — preview screen for the AR card-overlay system.
//
// Register in main.js: nav.register('cardAR', mountCardARScreen)
//
// What this screen does today (no real cards, no MindAR yet):
//   - Renders two faux-card SVGs at fixed screen positions (a stand-in for the
//     printed element cards a student will actually scan).
//   - Mounts cardARView on a transparent canvas above them.
//   - Uses arTransformMock to fake a per-frame transform for each card so the
//     molecule + reaction effect appear to float ABOVE each card with a
//     gentle sway.
//   - Lets you cycle through demo molecules with prev/next buttons.
//
// The active provider is supplied by main.js via deps.arTransform (see
// core/arBootstrap.js). When the real MindAR backend is selected, the simulate
// controls (prev / next / play) and the two faux DOM cards are hidden — those
// only make sense when arTransformMock is driving the canvas with synthetic
// matrices. In real mode the canvas instead reflects whatever the camera sees.

import { mountCardARView }  from '../components/cardARView.js';
import { arTransformMock }  from '../core/arTransformMock.js';

// Demo molecules to cycle through. Each entry is the formula id to render.
// Effects are assigned via fallback maps below if reactions.json doesn't have
// `effect` fields wired in yet.
//
// Curated set spanning Class 10/11 essentials, acids, bases, salts, oxides,
// and organics — to showcase the full breadth of compounds.json (55 records).
const DEMO_MOLECULES = [
  // Essentials every chemistry student must know
  'H2O', 'CO2', 'NH3', 'CH4', 'NaCl', 'HCl',
  // Acids
  'H2SO4', 'HNO3', 'CH3COOH',
  // Bases
  'NaOH', 'KOH',
  // Salts
  'Na2CO3', 'CaCO3', 'CuSO4', 'CaCl2',
  // Oxides
  'CaO', 'MgO', 'ZnO', 'Al2O3', 'Fe2O3',
  // Organics
  'C2H5OH', 'C6H12O6'
];

const AUTO_CYCLE_MS = 3000;

// Fallback compound→effect mapping if the reaction record lacks an `effect`
// (matches the spirit of reactions.json's product field).
// Effect vocabulary: water-ripple, gas-bubble, smoke, crystal-sparkle,
// shimmer, dust, flame, sparks, glow-pulse, cymatic-bloom.
const COMPOUND_EFFECT_FALLBACK = {
  // essentials
  'H2O':     'water-ripple',
  'CO2':     'gas-bubble',
  'CO':      'smoke',
  'O2':      'gas-bubble',
  'H2':      'gas-bubble',
  'N2':      'gas-bubble',
  'NH3':     'gas-bubble',
  'CH4':     'flame',
  'NaCl':    'crystal-sparkle',
  // acids
  'HCl':     'sparks',
  'H2SO4':   'glow-pulse',
  'HNO3':    'sparks',
  'CH3COOH': 'water-ripple',
  // bases
  'NaOH':    'glow-pulse',
  'KOH':     'glow-pulse',
  'CaOH2':   'glow-pulse',
  // salts
  'Na2CO3':  'crystal-sparkle',
  'NaHCO3':  'crystal-sparkle',
  'CaCO3':   'crystal-sparkle',
  'CuSO4':   'shimmer',
  'CaCl2':   'crystal-sparkle',
  'KCl':     'crystal-sparkle',
  'LiCl':    'crystal-sparkle',
  'MgCl2':   'crystal-sparkle',
  'AlCl3':   'crystal-sparkle',
  'FeCl3':   'shimmer',
  'CuCl2':   'shimmer',
  'ZnCl2':   'crystal-sparkle',
  'NaF':     'crystal-sparkle',
  'AgCl':    'crystal-sparkle',
  'AgNO3':   'glow-pulse',
  // oxides
  'Al2O3':   'shimmer',
  'Fe2O3':   'dust',
  'Fe3O4':   'shimmer',
  'FeO':     'shimmer',
  'CuO':     'shimmer',
  'MgO':     'sparks',
  'CaO':     'glow-pulse',
  'ZnO':     'sparks',
  'PbO':     'glow-pulse',
  'SO2':     'smoke',
  'SiO2':    'crystal-sparkle',
  'K2O':     'glow-pulse',
  'Li2O':    'glow-pulse',
  'P2O5':    'smoke',
  // organics
  'C2H5OH':  'water-ripple',
  'C6H12O6': 'cymatic-bloom',
  'C2H6':    'flame',
  'C2H4':    'flame',
  'C2H2':    'flame',
  'C6H6':    'shimmer',
  // halides / sulfides / hydrides
  'CCl4':    'water-ripple',
  'PCl3':    'gas-bubble',
  'ZnS':     'glow-pulse',
  'LiH':     'sparks',
  'FeS':     'shimmer'
};

// Real-AR default mapping: when a single element card is detected, we still
// want something visually meaningful to spawn. Diatomic gases expand to their
// natural molecular form; metals/non-metals render as the element itself.
// Keys are the elementIds emitted by arTransformMindAR.js (see
// assets/targets/index.json), values are formulaIds in data/molecules.json.
const DEFAULT_FORMULA_BY_ELEMENT = {
  H:  'H2',
  O:  'O2',
  N:  'N2',
  Cl: 'Cl2',
  C:  'C',
  Na: 'Na',
  Mg: 'Mg',
  Ca: 'Ca',
  Al: 'Al',
  Fe: 'Fe',
  Cu: 'Cu',
  Zn: 'Zn'
};

/** Look up the effect name for a product, preferring reactions.json data. */
function resolveEffect(productId, reactionList) {
  if (Array.isArray(reactionList)) {
    const r = reactionList.find((x) => x.product === productId && x.effect);
    if (r) return r.effect;
  }
  return COMPOUND_EFFECT_FALLBACK[productId] || 'glow-pulse';
}

/** Get a friendly element label for the faux card SVG. */
function pickCardElement(productId, compounds) {
  const comp = compounds && compounds[productId];
  if (comp && comp.components) {
    const keys = Object.keys(comp.components);
    if (keys.length) return keys[0];
  }
  // For elements (single-atom molecules), the formula is the symbol.
  return productId.replace(/[0-9]/g, '').slice(0, 2);
}

/**
 * Build a faux element-card as inline SVG so it looks like a printed playing
 * card. The actual molecule will float ABOVE this card via the WebGL canvas.
 */
function buildFakeCardSVG({ symbol, name, atomicNumber }) {
  const label = name || symbol;
  const z = atomicNumber || '';
  return `
    <svg viewBox="0 0 120 168" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="card-bg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="rgba(13,115,119,0.35)"/>
          <stop offset="100%" stop-color="rgba(8,12,20,0.85)"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="116" height="164" rx="14" ry="14"
            fill="url(#card-bg-grad)" stroke="rgba(0,229,204,0.45)" stroke-width="1.5"/>
      <text x="12" y="22" font-family="ui-sans-serif, system-ui" font-size="11"
            font-weight="700" fill="rgba(0,229,204,0.85)" letter-spacing="1.2">${z}</text>
      <text x="60" y="86" text-anchor="middle"
            font-family="ui-sans-serif, system-ui" font-size="40" font-weight="800"
            fill="#F0F4FF">${symbol}</text>
      <text x="60" y="118" text-anchor="middle"
            font-family="ui-sans-serif, system-ui" font-size="11"
            font-weight="600" letter-spacing="1.5"
            fill="rgba(201,211,229,0.75)">${(label || '').toUpperCase()}</text>
      <circle cx="60" cy="142" r="10" fill="none"
              stroke="rgba(0,229,204,0.35)" stroke-width="1"/>
      <circle cx="60" cy="142" r="2.5" fill="rgba(0,229,204,0.85)"/>
    </svg>
  `;
}

export function mountCardARScreen(container, deps) {
  const {
    bus, EVENTS, elements, compounds, reactions, molecules,
    arTransform: depsArTransform,
    arMode
  } = deps || {};
  const reactionList = Array.isArray(reactions) ? reactions : (reactions?.reactions || []);

  // Resolve transform provider: prefer the one chosen at boot, fall back to
  // mock for any caller that mounts this screen without going through main.js.
  const transformProvider = depsArTransform || arTransformMock;
  const isReal = arMode === 'real';

  // ── Layout ──
  container.classList.add('car-screen');
  if (isReal) container.classList.add('car-real-mode');
  container.innerHTML = `
    <div class="car-camera-bg"></div>

    <div class="car-fake-card car-card-a" aria-hidden="true"></div>
    <div class="car-fake-card car-card-b" aria-hidden="true"></div>

    <div class="car-formula-label car-formula-a" data-formula-a aria-hidden="true">—</div>
    <div class="car-formula-label car-formula-b" data-formula-b aria-hidden="true">—</div>

    <div class="car-canvas-host" data-canvas-host></div>

    <div class="car-overlay">
      <div class="car-topbar">
        <button class="car-back" data-act="back" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
               stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <div class="car-title-wrap">
          <div class="car-title">AR Card Preview</div>
          <div class="car-sub">Floating molecules over fake cards</div>
        </div>
        <div class="car-mode-pill car-badge">AR PREVIEW</div>
      </div>

      <div class="car-bottom">
        <button class="car-cycle" data-act="prev" aria-label="Previous molecule">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
          <span>prev</span>
        </button>
        <div class="car-readout" data-readout>
          <div class="car-readout-formula" data-formula>—</div>
          <div class="car-readout-effect"  data-effect>—</div>
        </div>
        <button class="car-cycle car-play" data-act="play" aria-label="Auto-cycle">
          <span data-play-label>play</span>
        </button>
        <button class="car-cycle" data-act="next" aria-label="Next molecule">
          <span>next</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>
    </div>
  `;

  // ── Populate the two fake cards with their (initial) symbols ──
  const cardEls = [
    container.querySelector('.car-card-a'),
    container.querySelector('.car-card-b')
  ];

  // ── Mount the AR view on the dedicated canvas host ──
  const canvasHost = container.querySelector('[data-canvas-host]');
  const view = mountCardARView(canvasHost, {
    transformProvider,
    moleculesData: molecules,
    elementsData:  elements,
    compoundsData: compounds,
    reactionsData: reactions
  });

  // Two simulated cards. Their world-space positions roughly correspond to
  // the on-screen positions of the two faux-card DOM elements (left + right
  // of center). The mock provider's gentle sway will be applied on top.
  const TARGETS = [
    { id: 'card-a', basePos: [-0.9, -0.3, -3.2] },
    { id: 'card-b', basePos: [ 0.9, -0.3, -3.2] }
  ];

  // Cycle state — both cards step through DEMO_MOLECULES, offset so they
  // show different molecules at the same time.
  let cursor = 0;

  function moleculeForCard(i) {
    const idx = (cursor + i) % DEMO_MOLECULES.length;
    return DEMO_MOLECULES[(idx + DEMO_MOLECULES.length) % DEMO_MOLECULES.length];
  }

  const formulaLabelEls = [
    container.querySelector('[data-formula-a]'),
    container.querySelector('[data-formula-b]')
  ];

  function refreshFakeCards() {
    for (let i = 0; i < TARGETS.length; i++) {
      const formulaId = moleculeForCard(i);
      const symbol = pickCardElement(formulaId, compounds);
      const elementRecord = elements && elements[symbol] ? elements[symbol] : null;
      const name = elementRecord ? elementRecord.name : (compounds?.[formulaId]?.name || formulaId);
      const z    = elementRecord ? elementRecord.z    : '';
      cardEls[i].innerHTML = buildFakeCardSVG({ symbol, name, atomicNumber: z });
      // Floating formula tag above each card.
      const compound = compounds && compounds[formulaId];
      const formulaText = compound ? compound.formula : formulaId;
      if (formulaLabelEls[i]) {
        formulaLabelEls[i].innerHTML = `${formulaText} <span class="car-formula-arrow">↑</span>`;
      }
    }
  }

  function refreshReadout() {
    const formulaId = moleculeForCard(0);
    const compound  = compounds && compounds[formulaId];
    const formulaText = compound ? compound.formula : formulaId;
    const productName = compound?.name || formulaId;
    const effectName  = resolveEffect(formulaId, reactionList);
    const formulaEl = container.querySelector('[data-formula]');
    const effectEl  = container.querySelector('[data-effect]');
    if (formulaEl) formulaEl.textContent = `${formulaText} · ${productName}`;
    if (effectEl)  effectEl.textContent  = `effect: ${effectName}`;
  }

  function applyCardsToRenderer() {
    for (let i = 0; i < TARGETS.length; i++) {
      const t = TARGETS[i];
      const formulaId = moleculeForCard(i);
      const effectName = resolveEffect(formulaId, reactionList);
      // First call also adds the target; subsequent calls just swap content.
      if (!view.renderer.getTargetIds().includes(t.id)) {
        view.addCard(t.id, formulaId, effectName, t.basePos);
      } else {
        view.setCardMolecule(t.id, formulaId);
        view.setCardEffect(t.id, effectName);
      }
    }
  }

  function step(delta) {
    cursor = (cursor + delta + DEMO_MOLECULES.length) % DEMO_MOLECULES.length;
    applyCardsToRenderer();
    refreshFakeCards();
    refreshReadout();
  }

  // ── Initial paint ──
  // In real mode we do NOT pre-add the synthetic "card-a"/"card-b" targets —
  // the cardARView listens to transformProvider.onTargetFound and will spawn
  // groups with the real elementId-keyed targetIds emitted by MindAR.
  if (!isReal) {
    refreshFakeCards();
    applyCardsToRenderer();
    refreshReadout();
  }

  // ── Real-mode: bind detected element cards to their default molecules ──
  // CardRenderer subscribes to onTargetFound first (in its constructor), so by
  // the time our handler runs, the empty group already exists in its _cards
  // map and setMoleculeForTarget can populate it. We also listen on
  // onMatrixUpdate as a safety net for providers that emit updates before
  // the targetFound event (arTransformMindAR.js synthesises a found event in
  // that case via its seenFound set, but other providers may not).
  let unsubReal = () => {};
  if (isReal) {
    const seenTargets = new Set();
    const applyDefaults = (targetId) => {
      if (!targetId || seenTargets.has(targetId)) return;
      seenTargets.add(targetId);
      const formulaId  = DEFAULT_FORMULA_BY_ELEMENT[targetId] || targetId;
      const effectName = resolveEffect(formulaId, reactionList);
      view.renderer.setMoleculeForTarget(targetId, formulaId);
      view.renderer.setEffectForTarget(targetId, effectName);
    };
    const u1 = transformProvider.onTargetFound(({ targetId }) => applyDefaults(targetId));
    const u2 = transformProvider.onMatrixUpdate(({ targetId }) => applyDefaults(targetId));
    const u3 = transformProvider.onTargetLost(({ targetId }) => seenTargets.delete(targetId));
    unsubReal = () => {
      try { u1 && u1(); } catch (_e) {}
      try { u2 && u2(); } catch (_e) {}
      try { u3 && u3(); } catch (_e) {}
    };
  }

  // ── Auto-cycle ──
  let autoTimer = null;
  const playBtn   = container.querySelector('[data-act="play"]');
  const playLabel = container.querySelector('[data-play-label]');
  function setPlayLabel(text) {
    if (playLabel) playLabel.textContent = text;
  }
  function startAutoCycle() {
    if (autoTimer) return;
    autoTimer = setInterval(() => step(+1), AUTO_CYCLE_MS);
    if (playBtn) playBtn.classList.add('car-play--on');
    setPlayLabel('stop');
  }
  function stopAutoCycle() {
    if (!autoTimer) return;
    clearInterval(autoTimer);
    autoTimer = null;
    if (playBtn) playBtn.classList.remove('car-play--on');
    setPlayLabel('play');
  }
  function togglePlay() {
    if (autoTimer) stopAutoCycle();
    else startAutoCycle();
  }

  // ── Wire up controls ──
  const onBack = () => { if (bus && EVENTS) bus.emit(EVENTS.NAV_TO, 'home'); };
  const onPrev = () => { stopAutoCycle(); step(-1); };
  const onNext = () => { stopAutoCycle(); step(+1); };
  const onPlay = () => togglePlay();
  const onKey = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); onPrev(); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); onNext(); }
    else if (e.key === ' ') { e.preventDefault(); onPlay(); }
  };

  const backBtn = container.querySelector('[data-act="back"]');
  const prevBtn = container.querySelector('[data-act="prev"]');
  const nextBtn = container.querySelector('[data-act="next"]');
  if (backBtn) backBtn.addEventListener('click', onBack);
  // Mock-only simulate controls. In real-AR mode the molecule shown follows
  // whichever physical card is in view, so cycling/auto-play makes no sense —
  // hide and disable them.
  if (!isReal) {
    if (prevBtn) prevBtn.addEventListener('click', onPrev);
    if (nextBtn) nextBtn.addEventListener('click', onNext);
    if (playBtn) playBtn.addEventListener('click', onPlay);
    window.addEventListener('keydown', onKey);
  } else {
    for (const btn of [prevBtn, nextBtn, playBtn]) {
      if (!btn) continue;
      btn.disabled = true;
      btn.setAttribute('aria-hidden', 'true');
      btn.style.display = 'none';
    }
    // Faux DOM cards are mock-only stand-ins.
    for (const el of cardEls) { if (el) el.style.display = 'none'; }
    for (const el of formulaLabelEls) { if (el) el.style.display = 'none'; }
    // Re-label the AR mode pill so users see real-vs-mock at a glance.
    const pill = container.querySelector('.car-mode-pill');
    if (pill) pill.textContent = 'AR LIVE';
  }

  function unmount() {
    stopAutoCycle();
    unsubReal();
    if (backBtn) backBtn.removeEventListener('click', onBack);
    if (!isReal) {
      if (prevBtn) prevBtn.removeEventListener('click', onPrev);
      if (nextBtn) nextBtn.removeEventListener('click', onNext);
      if (playBtn) playBtn.removeEventListener('click', onPlay);
      window.removeEventListener('keydown', onKey);
    }
    try { view.unmount(); } catch (e) { console.warn('[cardAR] view unmount error', e); }
  }

  function refresh() {
    refreshFakeCards();
    refreshReadout();
  }

  return { unmount, refresh };
}

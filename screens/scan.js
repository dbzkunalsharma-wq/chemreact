// scan.js — AR scanner with painterly chromatic aesthetic.
// Card slots are soft chromatic auras (radial-gradient blobs that breathe / glow).
// Center "viewfinder" is a cymatic mandala — concentric rings + radial bloom pulse.
// Scan animation = a chromatic ping/bloom from center, not a horizontal line.
// Listens to ELEMENT_DETECTED / ELEMENT_LOST from the tracker.

import { mountBloomBg } from '../components/bloomBg.js';

export function mountScanScreen(container, deps) {
  const { bus, EVENTS, state, elements, reactions, invalidExplanations, tracker } = deps;
  // reactions is the unwrapped array from reactions.json; invalidExplanations is the lookup object.
  const reactionList = Array.isArray(reactions) ? reactions : (reactions?.reactions || []);
  const invalidLookup = invalidExplanations || reactions?.invalidExplanations || {};

  container.classList.add('scan-screen');
  container.innerHTML = '';

  // ---- Background bloom (soft, behind everything) ----
  const bgHost = document.createElement('div');
  bgHost.className = 'scan-bg-host';
  container.appendChild(bgHost);
  const bg = mountBloomBg(bgHost, { blooms: 5, intensity: 'soft', bg: 'dark', drift: true });

  // ---- Overlay UI ----
  const overlay = document.createElement('div');
  overlay.className = 'scan-overlay-v2';
  overlay.innerHTML = `
    <div class="scan-topbar-v2">
      <button class="scan-back-v2" data-act="back" aria-label="Back">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </button>
      <div class="scan-title-block">
        <div class="scan-title-v2">SCAN ELEMENTS</div>
        <div class="scan-sub-v2">Point camera at two cards</div>
      </div>
      <div class="scan-mode-v2" data-act="mode">DEMO</div>
    </div>

    <div class="scan-mandala">
      <div class="scan-mandala-ring scan-mandala-ring-1"></div>
      <div class="scan-mandala-ring scan-mandala-ring-2"></div>
      <div class="scan-mandala-ring scan-mandala-ring-3"></div>
      <div class="scan-mandala-ping"></div>
      <div class="scan-mandala-pulse"></div>
      <div class="scan-mandala-core"></div>
    </div>

    <div class="scan-slots-v2">
      <div class="scan-slot-v2" data-slot="0">
        <div class="scan-slot-aura"></div>
        <div class="scan-slot-content">
          <div class="scan-slot-symbol">?</div>
          <div class="scan-slot-name">Searching</div>
        </div>
      </div>
      <div class="scan-plus">+</div>
      <div class="scan-slot-v2" data-slot="1">
        <div class="scan-slot-aura"></div>
        <div class="scan-slot-content">
          <div class="scan-slot-symbol">?</div>
          <div class="scan-slot-name">Searching</div>
        </div>
      </div>
    </div>

    <div class="scan-status-v2" data-status>Searching for elements&hellip;</div>

    <button class="scan-combine-v2" data-act="combine">
      <span class="scan-combine-label">Combine</span>
      <span class="scan-combine-arrow">&rarr;</span>
    </button>

    <button class="scan-sim-v2" data-act="sim">Simulate Detection</button>

    <div class="scan-tip-v2">
      <strong>Tip:</strong> Try Hydrogen + Oxygen first &mdash; makes water.
    </div>
  `;
  container.appendChild(overlay);

  // ---- Refs ----
  const slots   = [container.querySelector('[data-slot="0"]'), container.querySelector('[data-slot="1"]')];
  const status  = container.querySelector('[data-status]');
  const combineBtn = container.querySelector('[data-act="combine"]');
  const simBtn  = container.querySelector('[data-act="sim"]');
  const backBtn = container.querySelector('[data-act="back"]');
  const modeBtn = container.querySelector('[data-act="mode"]');

  // Detection state — slot index → element symbol.
  const detected = [null, null];

  function setSlot(i, symbol) {
    const slot = slots[i];
    if (!slot) return;
    const symEl = slot.querySelector('.scan-slot-symbol');
    const nameEl = slot.querySelector('.scan-slot-name');
    if (symbol && elements[symbol]) {
      const el = elements[symbol];
      slot.classList.add('detected');
      slot.style.setProperty('--slot-color', el.cpkColor || '#00E5CC');
      symEl.textContent = symbol;
      nameEl.textContent = el.name;
    } else {
      slot.classList.remove('detected');
      slot.style.setProperty('--slot-color', 'rgba(160,160,200,0.5)');
      symEl.textContent = '?';
      nameEl.textContent = 'Searching';
    }
  }

  function refreshState() {
    const count = detected.filter(Boolean).length;
    if (count === 2) {
      status.textContent = 'Both detected — combine to react';
      status.classList.add('ready');
      combineBtn.classList.add('ready');
    } else if (count === 1) {
      status.textContent = 'Got one — find the second';
      status.classList.remove('ready');
      combineBtn.classList.remove('ready');
    } else {
      status.textContent = 'Searching for elements…';
      status.classList.remove('ready');
      combineBtn.classList.remove('ready');
    }
  }

  function placeDetection(symbol) {
    if (!symbol || !elements[symbol]) return;
    if (detected[0] === symbol || detected[1] === symbol) return; // ignore dupe
    const idx = detected[0] == null ? 0 : (detected[1] == null ? 1 : -1);
    if (idx === -1) {
      // Both full; replace second slot with newest detection.
      detected[1] = symbol;
      setSlot(1, symbol);
    } else {
      detected[idx] = symbol;
      setSlot(idx, symbol);
    }
    if (state.unlockElement) state.unlockElement(symbol);
    refreshState();
  }

  function clearDetection(symbol) {
    if (!symbol) return;
    for (let i = 0; i < 2; i++) {
      if (detected[i] === symbol) {
        detected[i] = null;
        setSlot(i, null);
      }
    }
    refreshState();
  }

  // ---- Combine logic ----
  function findReactionFor(a, b) {
    const list = reactionList;
    for (const r of list) {
      const keys = Object.keys(r.reactants || {});
      const hasA = keys.includes(a);
      const hasB = keys.includes(b);
      if (a === b) {
        // single-element synthesis (rare in our data) — accept if reactants only has that one key.
        if (keys.length === 1 && keys[0] === a) return r;
      } else if (hasA && hasB) {
        return r;
      }
    }
    return null;
  }

  function tryCombine() {
    const [a, b] = detected;
    if (!a || !b) return;
    const r = findReactionFor(a, b);
    if (r) {
      if (state.unlockCompound) state.unlockCompound(r.product);
      state.set({ lastReaction: r.product });
      bus.emit(EVENTS.REACTION_DONE, { product: r.product, reactionId: r.id });
      bus.emit(EVENTS.NAV_TO, 'reaction');
    } else {
      const key1 = a + '+' + b;
      const key2 = b + '+' + a;
      const exp = invalidLookup[key1]
                || invalidLookup[key2]
                || invalidLookup.default
                || 'These don\'t react under normal conditions.';
      bus.emit(EVENTS.TOAST, exp);
    }
  }

  // ---- Simulator ----
  const SIM_PAIRS = [['H','O'], ['Na','Cl'], ['C','O'], ['Al','O']];
  let simIdx = 0;
  function runSimulation() {
    const pair = SIM_PAIRS[simIdx % SIM_PAIRS.length];
    simIdx++;
    // Reset and emit detections one by one.
    detected[0] = null; detected[1] = null;
    setSlot(0, null); setSlot(1, null);
    refreshState();
    if (tracker && typeof tracker.simulate === 'function') {
      pair.forEach((sym, i) => {
        setTimeout(() => tracker.simulate('+' + sym), 250 + i * 350);
      });
    } else {
      // fallback — emit on the bus directly so the UI still reacts.
      pair.forEach((sym, i) => {
        setTimeout(() => bus.emit(EVENTS.ELEMENT_DETECTED, sym), 250 + i * 350);
      });
    }
  }

  // ---- Bus subscriptions ----
  // Tracker emits payload `{ elementId, position, confidence }` (see core/ITracker.js).
  const extract = (p) => typeof p === 'string' ? p : (p?.elementId || p?.id || p?.symbol);
  const offDetected = bus.on(EVENTS.ELEMENT_DETECTED, (p) => placeDetection(extract(p)));
  const offLost     = bus.on(EVENTS.ELEMENT_LOST,     (p) => clearDetection(extract(p)));

  // Seed any detections that were already active before this screen mounted.
  if (typeof tracker?.getActive === 'function') {
    for (const sym of tracker.getActive()) placeDetection(sym);
  }

  // ---- Click handlers ----
  const onBack    = () => bus.emit(EVENTS.NAV_TO, 'home');
  const onCombine = () => { if (combineBtn.classList.contains('ready')) tryCombine(); };
  const onSim     = () => runSimulation();
  const onMode    = () => bus.emit(EVENTS.TOAST, 'Demo mode — uses simulated detections');
  backBtn.addEventListener('click', onBack);
  combineBtn.addEventListener('click', onCombine);
  simBtn.addEventListener('click', onSim);
  if (modeBtn) modeBtn.addEventListener('click', onMode);

  refreshState();

  return {
    unmount() {
      offDetected(); offLost();
      backBtn.removeEventListener('click', onBack);
      combineBtn.removeEventListener('click', onCombine);
      simBtn.removeEventListener('click', onSim);
      if (modeBtn) modeBtn.removeEventListener('click', onMode);
      if (bg && typeof bg.unmount === 'function') bg.unmount();
      container.classList.remove('scan-screen');
    },
    refresh() { refreshState(); }
  };
}

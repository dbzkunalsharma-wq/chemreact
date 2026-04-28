// bottomNav.js — glass pill bottom navigation.
// Reference: frosted glass pill with dark filled active capsule + SVG monoline icons.
//
// Mounted ONCE on .phone-inner. Listens to SCREEN_CHANGED + NAV_TO to keep
// the active tab in sync. Hides on screens not in VISIBLE_ON.

// Bnav shows whenever the user is on one of these screens. Home is included
// so the bar is visible on the dashboard, but Home no longer has its own tab —
// users return via the global TopBar back button.
const VISIBLE_ON = new Set(['home', 'scan', 'library', 'journal']);

// Monoline SVG icons (24px viewBox, stroke-based — colour via currentColor).
const ICON_HOME = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M3 11.5 12 4l9 7.5"/>
    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/>
  </svg>`;

const ICON_SCAN = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9"/>
    <circle cx="12" cy="12" r="4"/>
    <circle cx="12" cy="12" r="1.2" fill="currentColor"/>
  </svg>`;

const ICON_LIBRARY = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="2.2"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.5"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(60 12 12)"/>
    <ellipse cx="12" cy="12" rx="9" ry="3.5" transform="rotate(-60 12 12)"/>
  </svg>`;

const ICON_JOURNAL = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/>
    <path d="M5 4v14a2 2 0 0 0 2 2"/>
    <path d="M9 8h6M9 12h6"/>
  </svg>`;

export function mountBottomNav({ container, bus, EVENTS, nav }) {
  const root = document.createElement('nav');
  root.className = 'bnav';
  root.setAttribute('data-visible', 'false');
  root.setAttribute('aria-label', 'Primary');

  // 3 items: Library, [Scan FAB centered], Journal.
  //
  // The .bnav-morph SVG draws TWO cyan blobs merged by a goo filter. Blob-A is
  // the resting active indicator. Blob-B is a "traveler" that, on tab change,
  // spawns at the OLD position (overlapping A), then animates its cx to the
  // NEW position. The goo (stdDeviation=8) bridges them into a connected
  // metaball tube during transit — that's the "stretchy molecule" feel.
  //
  // Cyan fill (matches FAB gradient) so the morph reads as the highlight
  // TRAVELING between tabs, including in/out of the FAB.
  root.innerHTML = `
    <svg class="bnav-morph" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="bnav-goo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="12" result="b"/>
          <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 22 -10" result="g"/>
          <feComposite in="SourceGraphic" in2="g" operator="atop"/>
        </filter>
        <linearGradient id="bnav-blob-grad" x1="0" y1="0" x2="1" y2="1">
          <!-- Visual identity gradient — mirrors the splash logo. Hex is intentional
               (SVG <stop stop-color> doesn't reliably read CSS var() across browsers). -->
          <stop offset="0%"   stop-color="#14F0D8" stop-opacity="0.85"/>
          <stop offset="100%" stop-color="#00B09B" stop-opacity="0.72"/>
        </linearGradient>
      </defs>
      <g filter="url(#bnav-goo)" fill="url(#bnav-blob-grad)">
        <circle class="bnav-blob bnav-blob-a" cx="50" cy="50" r="0"/>
        <circle class="bnav-blob bnav-blob-b" cx="50" cy="50" r="0"/>
      </g>
    </svg>
    <button class="bnav-tab" data-target="library" type="button" aria-label="Library">
      <span class="bnav-icon">${ICON_LIBRARY}</span>
    </button>
    <button class="bnav-tab bnav-fab" data-target="scan" type="button" aria-label="Scan">
      <span class="bnav-fab-glow"></span>
      <span class="bnav-icon">${ICON_SCAN}</span>
    </button>
    <button class="bnav-tab" data-target="journal" type="button" aria-label="Journal">
      <span class="bnav-icon">${ICON_JOURNAL}</span>
    </button>
  `;

  container.appendChild(root);

  const tabs = Array.from(root.querySelectorAll('.bnav-tab'));

  const clickHandlers = [];
  tabs.forEach(tab => {
    const target = tab.getAttribute('data-target');
    const handler = (e) => {
      e.preventDefault();
      bus.emit(EVENTS.NAV_TO, target);
    };
    tab.addEventListener('click', handler);
    clickHandlers.push(() => tab.removeEventListener('click', handler));
  });

  // ─── Metaball morph indicator ───────────────────────────────────────
  const blobA = root.querySelector('.bnav-blob-a');
  const blobB = root.querySelector('.bnav-blob-b');
  let lastActiveName = null;
  // Track the last tab position the blob occupied. Defaults to 50 (FAB
  // center) so the FIRST click from home or scan always emerges from the
  // FAB and stretches outward — no "instant snap" on the very first morph.
  let lastCx = 50;

  function tabCenterPct(tabEl) {
    if (!tabEl) return 50;
    const navRect = root.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();
    const centerX = tabRect.left - navRect.left + tabRect.width / 2;
    return navRect.width > 0 ? (centerX / navRect.width) * 100 : 50;
  }

  function tabRadiusPct(tabEl) {
    if (!tabEl) return 0;
    const navRect = root.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();
    // Beefier than v1 — bigger blobs = stronger goo merge during transit.
    const r = (Math.min(tabRect.width, tabRect.height) * 0.50 / navRect.width) * 100;
    return r;
  }

  // JS-driven tween — robust across browsers (CSS transitions on SVG geometry
  // attributes are supported in modern Chrome/Firefox but not always reliably).
  // Returns a cancel handle.
  function tweenAttrs(el, attrs, dur, easing = t => 1 - Math.pow(1 - t, 3)) {
    const start = performance.now();
    const from  = {};
    for (const k in attrs) from[k] = parseFloat(el.getAttribute(k) || '0');
    let raf = null;
    function step(now) {
      const t = Math.min(1, (now - start) / dur);
      const e = easing(t);
      for (const k in attrs) el.setAttribute(k, (from[k] + (attrs[k] - from[k]) * e).toString());
      if (t < 1) raf = requestAnimationFrame(step);
    }
    raf = requestAnimationFrame(step);
    return () => { if (raf) cancelAnimationFrame(raf); };
  }

  function setAttrs(el, attrs) {
    for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  }

  let morphSeq = 0;
  let activeTweens = [];
  function cancelTweens() {
    activeTweens.forEach(c => c());
    activeTweens = [];
  }

  function morphTo(activeTab) {
    if (!blobA || !blobB) return;
    morphSeq++;
    const seq = morphSeq;
    cancelTweens();

    if (!activeTab) {
      // Tab gone (e.g. on home/splash). Retract the rest blob but KEEP
      // lastCx so the next morph starts from the last known position —
      // otherwise the first click from home would be an instant snap.
      setAttrs(blobA, { r: 0 });
      setAttrs(blobB, { r: 0 });
      return;
    }

    const isFab    = activeTab.classList.contains('bnav-fab');
    const targetCx = tabCenterPct(activeTab);
    // FAB has its own gradient — blob doesn't rest there, but it still
    // animates IN/OUT of that position so transitions stay continuous.
    const targetR  = isFab ? 0 : tabRadiusPct(activeTab);

    const oldCx = lastCx;
    // Big radius during transit — needs to be large enough that the goo
    // blur (stdDev=12) bridges the gap between the resting blob and the
    // traveler when they're a tab-width apart (~29 viewBox units). With
    // r=20 + blur reach ≈ 8, two blobs span up to 28 units each → they
    // stay merged across the entire trip.
    const transitR = Math.max(targetR, 20);

    // Stage 1: spawn B at OLD position with FULL transit radius (no animation).
    // B is now overlapping wherever A is/was — goo filter reads them as one.
    setAttrs(blobB, { cx: oldCx, r: transitR });

    // Stage 2: animate B's cx to target. While B travels, A is still at OLD,
    // creating a connected tube via the goo filter. ~440ms with cubic ease.
    activeTweens.push(tweenAttrs(blobB, { cx: targetCx }, 440));

    // Mid-transit: A retracts at OLD. The goo bridge masks the disappearance.
    activeTweens.push(tweenAttrs(blobA, { r: 0 }, 280));

    // Stage 3: as B reaches target, also tween its radius to the rest size
    // (or 0 if FAB). This gives a soft settle at the destination.
    setTimeout(() => {
      if (seq !== morphSeq) return;
      activeTweens.push(tweenAttrs(blobB, { r: targetR }, 220));
    }, 280);

    // Stage 4: consolidate — A becomes the new resting blob, B retracts.
    setTimeout(() => {
      if (seq !== morphSeq) return;
      setAttrs(blobA, { cx: targetCx, r: targetR });
      setAttrs(blobB, { cx: targetCx, r: 0 });
      lastCx = targetCx;
    }, 540);
  }

  function applyState(name) {
    // Dedupe: NAV_TO and SCREEN_CHANGED both fire for the same destination,
    // and a double morphTo cancels the first mid-flight (looks broken).
    if (name === lastActiveName) return;
    lastActiveName = name;

    const visible = VISIBLE_ON.has(name);
    root.setAttribute('data-visible', visible ? 'true' : 'false');
    let activeTab = null;
    tabs.forEach(tab => {
      const target = tab.getAttribute('data-target');
      const isActive = visible && target === name;
      tab.classList.toggle('active', isActive);
      if (isActive) activeTab = tab;
    });
    // Wait one frame for layout if nav just became visible.
    requestAnimationFrame(() => morphTo(activeTab));
  }

  applyState(nav?.currentName?.() || null);

  const offChanged = bus.on(EVENTS.SCREEN_CHANGED, (name) => applyState(name));
  const offIntent  = bus.on(EVENTS.NAV_TO,         (name) => applyState(name));

  return {
    el: root,
    unmount() {
      offChanged();
      offIntent();
      clickHandlers.forEach(fn => { try { fn(); } catch (_e) {} });
      clickHandlers.length = 0;
      root.remove();
    }
  };
}

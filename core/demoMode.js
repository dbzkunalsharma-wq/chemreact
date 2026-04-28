// demoMode.js — auto-walkthrough for stage demos / pitch video / fallback when AR fails.
// Triggers: ?demo=1 URL param, or 'D' keyboard toggle. 'Escape' stops.
// Loops indefinitely through SCRIPT until stopped. Cleans up timers on stop.

const SCRIPT = [
  { wait: 2500, label: 'Intro splash' },
  { goto: 'home', wait: 3000, label: 'Home overview' },
  { goto: 'library', wait: 3500, label: 'Element library' },
  { goto: 'scan', wait: 1500, label: 'Scan screen' },
  { simulate: ['+H'], wait: 1200, label: 'Detect Hydrogen' },
  { simulate: ['+O'], wait: 1500, label: 'Detect Oxygen' },
  { combine: true, wait: 4000, label: 'Combine to Water' },
  { goto: 'home', wait: 2500, label: 'Back home' },
  { simulate: ['-H', '-O'], wait: 200 },
  { goto: 'scan', wait: 1500, label: 'Second reaction' },
  { simulate: ['+Na'], wait: 1200, label: 'Detect Sodium' },
  { simulate: ['+Cl'], wait: 1500, label: 'Detect Chlorine' },
  { combine: true, wait: 4000, label: 'Salt formed' },
  { goto: 'journal', wait: 4000, label: 'Discovery journal' },
  { goto: 'home', wait: 2000, label: 'Cycle complete' }
];

export function setupDemoMode({ bus, EVENTS, state, nav, tracker } = {}) {
  let running = false;
  let stopped = true;
  let timer = null;
  let badgeEl = null;
  let pausedForVisibility = false;
  let pendingResume = null;

  function makeBadge() {
    if (badgeEl) return;
    badgeEl = document.createElement('div');
    badgeEl.className = 'demo-badge';
    badgeEl.setAttribute('aria-live', 'polite');
    badgeEl.textContent = 'DEMO';
    Object.assign(badgeEl.style, {
      position: 'fixed',
      top: '12px',
      left: '12px',
      zIndex: '10000',
      padding: '4px 10px',
      borderRadius: '999px',
      background: 'rgba(0,0,0,0.55)',
      color: 'var(--accent, #00E5CC)',
      font: '600 11px/1 system-ui, sans-serif',
      letterSpacing: '0.12em',
      border: '1px solid rgba(255,255,255,0.12)',
      backdropFilter: 'blur(6px)',
      pointerEvents: 'none',
      userSelect: 'none'
    });
    document.body.appendChild(badgeEl);
  }

  function setBadgeLabel(label) {
    if (!badgeEl) return;
    badgeEl.textContent = label ? `DEMO · ${label}` : 'DEMO';
  }

  function removeBadge() {
    if (badgeEl) { badgeEl.remove(); badgeEl = null; }
  }

  function clearTimer() {
    if (timer) { clearTimeout(timer); timer = null; }
  }

  function delay(ms) {
    return new Promise(resolve => {
      // If tab hidden, defer until visible
      const tick = () => {
        if (document.hidden) {
          pausedForVisibility = true;
          pendingResume = tick;
          return;
        }
        pausedForVisibility = false;
        clearTimer();
        timer = setTimeout(resolve, ms);
      };
      tick();
    });
  }

  function tryCombine() {
    const btn = document.querySelector('#screen-scan .combine-btn');
    if (!btn) {
      bus?.emit?.(EVENTS?.TOAST, '[demo] combine button not found, skipping');
      return false;
    }
    if (!btn.classList.contains('ready')) {
      bus?.emit?.(EVENTS?.TOAST, '[demo] combine not ready, skipping');
      return false;
    }
    btn.click();
    return true;
  }

  async function runStep(step) {
    setBadgeLabel(step.label || '');
    try {
      if (step.goto) {
        if (nav && typeof nav.go === 'function') {
          if (nav.currentName?.() !== step.goto) {
            await nav.go(step.goto);
          }
        }
      }
      if (Array.isArray(step.simulate)) {
        for (const spec of step.simulate) {
          if (tracker && typeof tracker.simulate === 'function') {
            try { tracker.simulate(spec); } catch (e) { console.warn('[demo] simulate failed', spec, e); }
          }
        }
      }
      if (step.combine) {
        tryCombine();
      }
    } catch (e) {
      console.warn('[demo] step error, continuing', step, e);
    }
    if (step.wait) await delay(step.wait);
  }

  async function loop() {
    running = true;
    stopped = false;
    makeBadge();
    // Make sure tracker is running for simulations to take effect
    try { tracker?.start?.(); } catch {}
    let i = 0;
    while (!stopped) {
      const step = SCRIPT[i % SCRIPT.length];
      await runStep(step);
      if (stopped) break;
      i++;
    }
    running = false;
  }

  function start() {
    if (running || !stopped) return;
    stopped = false;
    loop().catch(e => console.error('[demo] loop crashed', e));
  }

  function stop() {
    stopped = true;
    running = false;
    clearTimer();
    removeBadge();
    pendingResume = null;
    pausedForVisibility = false;
  }

  function isRunning() { return running && !stopped; }

  // Keyboard shortcuts
  function onKey(e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.isComposing) return;
    const k = (e.key || '').toLowerCase();
    if (k === 'd' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      isRunning() ? stop() : start();
    } else if (k === 'escape' && isRunning()) {
      stop();
    }
  }

  // Visibility — resume pending step when tab returns
  function onVisibility() {
    if (!document.hidden && pendingResume) {
      const fn = pendingResume;
      pendingResume = null;
      fn();
    }
  }

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVisibility);

  // Auto-start from URL ?demo=1
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('demo') === '1') {
      // Defer start so app has a chance to mount initial screen
      setTimeout(start, 300);
    }
  } catch {}

  return {
    start,
    stop,
    isRunning,
    teardown() {
      stop();
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

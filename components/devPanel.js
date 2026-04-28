// devPanel.js — dev-only floating panel with element-toggle buttons.
// Hidden by default. Toggle visibility with `?` on document.

const ELEMENT_BUTTONS = ['H', 'O', 'Al', 'Cl', 'Na', 'C', 'Fe'];

export function mountDevPanel({ tracker, state }) {
  // Anchor inside the phone (top-right) so it scales with the simulator frame.
  const phone = document.querySelector('.phone-inner') || document.body;

  const panel = document.createElement('div');
  panel.className = 'dev-panel';
  panel.dataset.open = 'false';
  panel.innerHTML = `
    <div class="dev-panel-head">
      <span class="dev-panel-dot"></span>
      <span class="dev-panel-title">DEV</span>
      <span class="dev-panel-hint">press ? to toggle</span>
    </div>
    <div class="dev-panel-grid">
      ${ELEMENT_BUTTONS.map(sym => `
        <button type="button" class="dev-btn" data-detect="${sym}">
          <span class="dev-btn-sym">${sym}</span>
          <span class="dev-btn-label">Detect</span>
        </button>
      `).join('')}
    </div>
    <div class="dev-panel-row">
      <button type="button" class="dev-btn dev-btn-wide" data-action="clear">Clear All</button>
      <button type="button" class="dev-btn dev-btn-wide dev-btn-danger" data-action="reset">Reset Game</button>
    </div>
  `;
  phone.appendChild(panel);

  const onClick = (e) => {
    const btn = e.target.closest('button[data-detect], button[data-action]');
    if (!btn) return;

    if (btn.dataset.detect) {
      const sym = btn.dataset.detect;
      tracker.simulate(sym); // toggle
      btn.classList.toggle('on', tracker.getActive().includes(sym));
      // Keep all buttons in sync
      panel.querySelectorAll('button[data-detect]').forEach(b => {
        b.classList.toggle('on', tracker.getActive().includes(b.dataset.detect));
      });
      return;
    }

    if (btn.dataset.action === 'clear') {
      for (const id of [...tracker.getActive()]) tracker.simulate('-' + id);
      panel.querySelectorAll('button[data-detect]').forEach(b => b.classList.remove('on'));
      return;
    }

    if (btn.dataset.action === 'reset') {
      state.reset();
      // Hard reload so all screens rebuild from a clean slate.
      location.reload();
    }
  };
  panel.addEventListener('click', onClick);

  const onKey = (e) => {
    // toggle on `?` or shift+/
    if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
      // ignore if a text input is focused
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      const open = panel.dataset.open === 'true';
      panel.dataset.open = open ? 'false' : 'true';
    }
  };
  document.addEventListener('keydown', onKey);

  return {
    unmount() {
      panel.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      panel.remove();
    }
  };
}

// nav.js — screen router. Mounts/unmounts screens, handles transitions.
import { bus, EVENTS } from './eventBus.js';

const screens = new Map();    // name -> { mountFn, mounted: { unmount, refresh } | null, el: HTMLElement | null }
let container = null;
let current = null;
let deps = {};

export const nav = {
  init({ root, dependencies }) {
    container = root;
    deps = dependencies || {};
    bus.on(EVENTS.NAV_TO, (name) => nav.go(name));
  },
  register(name, mountFn) {
    screens.set(name, { mountFn, mounted: null, el: null });
  },
  async go(name) {
    if (current === name) return;
    const next = screens.get(name);
    if (!next) { console.warn('[nav] unknown screen', name); return; }

    // Animate out current
    if (current) {
      const cur = screens.get(current);
      if (cur?.el) {
        cur.el.classList.remove('active');
        await wait(280);
        cur.mounted?.unmount?.();
        cur.el.remove();
        cur.mounted = null;
        cur.el = null;
      }
    }

    // Mount new
    const el = document.createElement('div');
    el.className = 'screen';
    el.id = `screen-${name}`;
    container.appendChild(el);
    next.el = el;
    next.mounted = next.mountFn(el, deps) || {};
    // force reflow then add active for animation
    void el.offsetHeight;
    el.classList.add('active');
    current = name;
    // Emit fact-event so observers (BottomNav, analytics, audio) stay in sync
    // regardless of who triggered the navigation (NAV_TO, direct nav.go, splash auto, etc.)
    bus.emit(EVENTS.SCREEN_CHANGED, name);
  },
  refresh() {
    if (!current) return;
    const cur = screens.get(current);
    cur?.mounted?.refresh?.();
  },
  currentName() { return current; }
};

const wait = (ms) => new Promise(r => setTimeout(r, ms));

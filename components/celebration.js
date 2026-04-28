// celebration.js — bridge between bus events and celebratory visuals.
// Subscribes to DISCOVERY (compounds), fires overlay + confetti.

import { fireConfetti } from './confetti.js';
import { showLevelUpOverlay } from './levelUpOverlay.js';

export function setupCelebration({ bus, EVENTS, state, compounds } = {}) {
  if (!bus || !EVENTS) {
    console.warn('[celebration] missing bus/EVENTS, no-op');
    return { teardown() {} };
  }

  const offs = [];

  // First-time compound discovery → big overlay + confetti.
  // state.recordDiscovery is only called from unlockCompound when not already owned,
  // so this fires once per compound (first-time only, as required).
  offs.push(bus.on(EVENTS.DISCOVERY, (p) => {
    if (!p || p.type !== 'compound') return;
    const c = compounds && p.id ? compounds[p.id] : null;
    showLevelUpOverlay({
      kind: 'discovery',
      title: 'NEW DISCOVERY!',
      subtitle: (c && c.name) ? c.name : (p.id || ''),
      icon: '⚗️'
    });
    fireConfetti({ particleCount: 100, duration: 3000 });
  }));

  return {
    teardown() {
      offs.forEach(off => { try { off(); } catch {} });
      offs.length = 0;
    }
  };
}

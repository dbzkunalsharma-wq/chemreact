// audioBridge.js — the ONLY module that knows about both bus and audio.
// Subscribes to game events and calls audio.play(). Clean separation:
// screens emit, bridge translates to sound IDs, audio impl plays.
//
// Usage from main.js:
//   import { setupAudioBridge } from './core/audioBridge.js';
//   const audioBridge = setupAudioBridge({ bus, EVENTS, state });
//   // teardown: audioBridge.teardown();
//
// To swap procedural -> file-based audio later, change ONE line below:
//   import audio from './audioMock.js';   ->   import audio from './audioFile.js';

import audio from './audioMock.js';

export function setupAudioBridge({ bus, EVENTS, state } = {}) {
  if (!bus || !EVENTS) {
    console.warn('[audioBridge] missing bus/EVENTS — bridge inactive.');
    return { audio, teardown() {} };
  }

  // Honor user setting.
  const soundOn = state?.get?.()?.settings?.sound !== false;
  audio.setMuted(!soundOn);

  // Init on first user gesture (Chrome autoplay policy).
  const initOnGesture = () => {
    try { audio.init(); } catch (e) { console.debug('[audioBridge] init threw', e); }
    document.removeEventListener('pointerdown', initOnGesture);
    document.removeEventListener('keydown', initOnGesture);
    document.removeEventListener('touchstart', initOnGesture);
  };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', initOnGesture, { once: true });
    document.addEventListener('keydown', initOnGesture, { once: true });
    document.addEventListener('touchstart', initOnGesture, { once: true });
  }

  const safe = (fn) => (p) => {
    try { fn(p); } catch (e) { console.debug('[audioBridge] handler threw', e); }
  };

  // Subscribe to events. bus.on returns an unsubscribe function.
  const offs = [];

  offs.push(bus.on(EVENTS.ELEMENT_DETECTED, safe(() => audio.play('scan.detect'))));

  if (EVENTS.ELEMENT_LOST) {
    offs.push(bus.on(EVENTS.ELEMENT_LOST, safe(() => audio.play('scan.lose'))));
  }

  offs.push(bus.on(EVENTS.REACTION_DONE, safe((p) => {
    // Optional payload hint: { success: bool }
    if (p && p.success === false) audio.play('reaction.fail');
    else audio.play('reaction.combine');
  })));

  offs.push(bus.on(EVENTS.DISCOVERY, safe((p) => {
    audio.play(p?.type === 'compound' ? 'discovery.compound' : 'discovery.element');
  })));

  offs.push(bus.on(EVENTS.TOAST, safe(() => audio.play('ui.toggle'))));

  if (EVENTS.NAV_TO) {
    offs.push(bus.on(EVENTS.NAV_TO, safe(() => audio.play('ui.tap'))));
  }

  return {
    audio,
    /** Mute/unmute at runtime, e.g. when user toggles settings.sound. */
    setMuted(flag) { audio.setMuted(!!flag); },
    teardown() {
      offs.forEach((o) => { try { o(); } catch {} });
      offs.length = 0;
      document.removeEventListener('pointerdown', initOnGesture);
      document.removeEventListener('keydown', initOnGesture);
      document.removeEventListener('touchstart', initOnGesture);
    }
  };
}

export default setupAudioBridge;

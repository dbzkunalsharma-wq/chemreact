// trackerMock.js — dev-mode tracker. Fires events as if cards were detected.
// Replaced later by trackerMindAR.js with the same shape — single import line change.
import { bus, EVENTS } from './eventBus.js';

const active = new Set();
let running = false;

function detect(elementId) {
  if (!running || active.has(elementId)) return;
  active.add(elementId);
  bus.emit(EVENTS.ELEMENT_DETECTED, {
    elementId, position: { x: 0, y: 0, z: 0 }, confidence: 1.0
  });
}

function lose(elementId) {
  if (!active.has(elementId)) return;
  active.delete(elementId);
  bus.emit(EVENTS.ELEMENT_LOST, { elementId });
}

export const trackerMock = {
  start() { running = true; },
  stop()  { running = false; for (const id of active) lose(id); },
  getActive() { return [...active]; },

  // simulate('Al')   → toggles detection
  // simulate('+Al')  → force detect
  // simulate('-Al')  → force lose
  simulate(spec) {
    if (typeof spec !== 'string') return;
    if (spec.startsWith('+')) return detect(spec.slice(1));
    if (spec.startsWith('-')) return lose(spec.slice(1));
    return active.has(spec) ? lose(spec) : detect(spec);
  },

  // For proximity reaction: pretend two cards are close
  setDistance(a, b, cm) {
    if (active.has(a) && active.has(b)) {
      bus.emit(EVENTS.DISTANCE_CHANGE, { a, b, cm });
    }
  }
};

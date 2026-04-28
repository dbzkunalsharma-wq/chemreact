// eventBus.js — pub/sub. Tracker emits, screens listen.
// usage: bus.on('elementDetected', (el) => ...);  bus.emit('elementDetected', 'Al')

const listeners = new Map();

export const bus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => bus.off(event, handler);
  },
  off(event, handler) {
    listeners.get(event)?.delete(handler);
  },
  emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const h of set) {
      try { h(payload); }
      catch (e) { console.error(`[bus] handler for '${event}' threw:`, e); }
    }
  },
  clear(event) {
    if (event) listeners.delete(event);
    else listeners.clear();
  }
};

// Standard event names — single source of truth.
export const EVENTS = {
  ELEMENT_DETECTED: 'elementDetected',
  ELEMENT_LOST:     'elementLost',
  DISTANCE_CHANGE:  'distanceChange',
  COMBINE:          'combine',
  REACTION_DONE:    'reactionDone',
  DISCOVERY:        'discovery',
  TOAST:            'toast',
  NAV_TO:           'navTo',         // intent: someone wants to navigate
  SCREEN_CHANGED:   'screenChanged'  // fact: screen has finished mounting
};

// state.js — game state with localStorage persistence.
// inventory, streak, journal entries, settings.
import { bus, EVENTS } from './eventBus.js';

const STORAGE_KEY = 'chemreact.state.v1';

const DEFAULT_STATE = {
  player: { name: 'Trainer', avatar: 'KM' },
  streak: 0,
  lastPlayedDate: null,
  inventory: { elements: [], compounds: [] }, // ids only
  journal: [],   // { id, type:'compound'|'element', when }
  badges: [],
  settings: { sound: true, haptics: true, theme: 'dark' }
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(DEFAULT_STATE);
    return { ...structuredClone(DEFAULT_STATE), ...JSON.parse(raw) };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function save(s) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
  catch (e) { console.warn('[state] save failed', e); }
}

let s = load();

export const state = {
  get()              { return s; },
  reset()            { s = structuredClone(DEFAULT_STATE); save(s); },
  set(patch)         { s = { ...s, ...patch }; save(s); },

  hasElement(id)     { return s.inventory.elements.includes(id); },
  hasCompound(id)    { return s.inventory.compounds.includes(id); },

  unlockElement(id) {
    if (s.inventory.elements.includes(id)) return false;
    s.inventory.elements.push(id);
    state.recordDiscovery({ type: 'element', id });
    return true;
  },

  unlockCompound(id) {
    if (s.inventory.compounds.includes(id)) return false;
    s.inventory.compounds.push(id);
    state.recordDiscovery({ type: 'compound', id });
    return true;
  },

  recordDiscovery({ type, id }) {
    s.journal.push({ type, id, when: Date.now() });
    save(s);
    bus.emit(EVENTS.DISCOVERY, { type, id });
  },

  bumpStreak() {
    const today = new Date().toDateString();
    if (s.lastPlayedDate === today) return;
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    s.streak = s.lastPlayedDate === yesterday ? s.streak + 1 : 1;
    s.lastPlayedDate = today;
    save(s);
  },

  // Convenience: stats for HomeScreen
  stats() {
    return {
      elements: s.inventory.elements.length,
      compounds: s.inventory.compounds.length,
      badges: s.badges.length
    };
  }
};

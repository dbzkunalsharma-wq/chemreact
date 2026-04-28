// audioFile.js — file-based audio. Drop-in replacement for audioMock when assets exist.
// Imports an asset map from assets/audio/_index.json (later) and uses Audio() elements.
// For now this is a STUB that conforms to IAudio but logs a warning if used.
//
// To enable later:
//   1. Drop matching .ogg/.mp3 files into assets/audio/ (see _README.md for filenames).
//   2. Build / hand-write assets/audio/_index.json mapping soundId -> filename.
//   3. In core/audioBridge.js change:
//        import audio from './audioMock.js';
//      to:
//        import audio from './audioFile.js';
//   4. No other code changes needed — same interface as audioMock.

const MAX_MASTER = 0.4;
const ASSET_DIR = 'assets/audio/';

// Default mapping — extend or override via _index.json at init time.
const DEFAULT_MAP = {
  'ui.tap':              'ui-tap.ogg',
  'ui.toggle':           'ui-toggle.ogg',
  'ui.error':            'ui-error.ogg',
  'scan.detect':         'scan-detect.ogg',
  'scan.lose':           'scan-lose.ogg',
  'scan.scanline':       'scan-scanline.ogg',
  'reaction.combine':    'reaction-combine.ogg',
  'reaction.success':    'reaction-success.ogg',
  'reaction.fail':       'reaction-fail.ogg',
  'discovery.element':   'discovery-element.ogg',
  'discovery.compound':  'discovery-compound.ogg',
  'discovery.levelup':   'discovery-levelup.ogg',
  'ambient.lab':         'ambient-lab.ogg'
};

let muted = false;
let ready = false;
let map = { ...DEFAULT_MAP };
const cache = new Map();      // soundId -> HTMLAudioElement (template)
const activeLoops = new Map(); // soundId -> HTMLAudioElement

async function loadIndex() {
  try {
    const res = await fetch(ASSET_DIR + '_index.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const json = await res.json();
    map = { ...DEFAULT_MAP, ...json };
  } catch {
    // No index file — use defaults.
  }
}

function makeAudio(soundId) {
  const file = map[soundId];
  if (!file) return null;
  const a = new Audio(ASSET_DIR + file);
  a.preload = 'auto';
  a.volume = MAX_MASTER;
  return a;
}

const audioFile = {
  async init(_opts = {}) {
    if (ready) return true;
    if (typeof Audio === 'undefined') {
      console.debug('[audioFile] no Audio() — running silent.');
      return false;
    }
    await loadIndex();
    console.warn(
      '[audioFile] STUB: file-based audio active but no playback verification. ' +
      'Drop files into assets/audio/ to hear sound. See assets/audio/_README.md.'
    );
    ready = true;
    return true;
  },

  play(soundId, opts = {}) {
    if (!ready || muted) return;
    if (!map[soundId]) {
      console.debug('[audioFile] unknown sound', soundId);
      return;
    }
    try {
      let template = cache.get(soundId);
      if (!template) {
        template = makeAudio(soundId);
        if (!template) return;
        cache.set(soundId, template);
      }
      // Clone for overlapping playback.
      const a = template.cloneNode(true);
      a.volume = Math.min(MAX_MASTER, (opts.volume ?? 1) * MAX_MASTER);
      if (opts.pitch && typeof a.playbackRate === 'number') {
        a.playbackRate = opts.pitch;
      }
      if (soundId.startsWith('ambient.') || opts.loop) {
        a.loop = true;
        activeLoops.set(soundId, a);
      }
      const p = a.play();
      if (p && typeof p.catch === 'function') {
        p.catch((err) => {
          console.debug('[audioFile] play() rejected — likely missing file', soundId, err?.message);
        });
      }
    } catch (e) {
      console.debug('[audioFile] play failed silently', soundId, e);
    }
  },

  stop(soundId) {
    const a = activeLoops.get(soundId);
    if (a) {
      try { a.pause(); a.currentTime = 0; } catch {}
      activeLoops.delete(soundId);
    }
  },

  setMuted(flag) {
    muted = !!flag;
    for (const a of activeLoops.values()) {
      try { a.muted = muted; } catch {}
    }
  },

  isReady() { return ready; }
};

export default audioFile;

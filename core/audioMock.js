// audioMock.js — procedural Web Audio implementation. No audio files needed.
// Each sound ID maps to a tiny synth recipe. Drop-in compatible with audioFile.js.
//
// Browsers block AudioContext until a user gesture — init() is wired to first tap
// by audioBridge.js. play() before init is a silent no-op.
//
// Master volume is capped at 0.4 to avoid blasting kids' eardrums.

const MAX_MASTER = 0.4;

const AC = (typeof window !== 'undefined')
  ? (window.AudioContext || window.webkitAudioContext)
  : null;

let ctx = null;
let masterGain = null;
let muted = false;
let ready = false;
const activeLoops = new Map(); // soundId -> { stop }

// ---------- helpers --------------------------------------------------------

function now() { return ctx ? ctx.currentTime : 0; }

function tone({
  freq = 440, freqEnd = null,
  dur = 0.1, type = 'sine',
  vol = 0.3, attack = 0.005, release = 0.04,
  delay = 0,
  destination = null
} = {}) {
  if (!ctx || !masterGain) return null;
  const t0 = now() + delay;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (freqEnd != null) {
    o.frequency.linearRampToValueAtTime(freqEnd, t0 + dur);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
  o.connect(g).connect(destination || masterGain);
  o.start(t0);
  o.stop(t0 + dur + release + 0.05);
  return { osc: o, gain: g, end: t0 + dur + release };
}

function noiseBuffer(duration = 1, color = 'white') {
  const len = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function noiseBurst({ dur = 0.2, vol = 0.25, color = 'white', filterFreq = null } = {}) {
  if (!ctx || !masterGain) return null;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur + 0.1, color);
  let node = src;
  if (filterFreq) {
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = filterFreq;
    src.connect(filt);
    node = filt;
  }
  const g = ctx.createGain();
  const t0 = now();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  node.connect(g).connect(masterGain);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
  return { src, gain: g };
}

// ---------- sound recipes --------------------------------------------------

const RECIPES = {
  'ui.tap': () => {
    tone({ freq: 12000, dur: 0.03, type: 'sine', vol: 0.18, release: 0.02 });
  },
  'ui.toggle': () => {
    tone({ freq: 800, freqEnd: 1200, dur: 0.06, type: 'sine', vol: 0.22 });
  },
  'ui.error': () => {
    tone({ freq: 400, freqEnd: 200, dur: 0.2, type: 'sawtooth', vol: 0.18, release: 0.05 });
  },

  'scan.detect': () => {
    tone({ freq: 1500, dur: 0.08, type: 'sine', vol: 0.28, release: 0.06 });
    tone({ freq: 2200, dur: 0.06, type: 'sine', vol: 0.12, release: 0.05, delay: 0.01 });
  },
  'scan.lose': () => {
    noiseBurst({ dur: 0.2, vol: 0.18, color: 'pink', filterFreq: 600 });
  },
  'scan.scanline': () => {
    tone({ freq: 100, freqEnd: 500, dur: 0.6, type: 'sine', vol: 0.12, release: 0.1 });
  },

  'reaction.combine': () => {
    tone({ freq: 200, freqEnd: 1500, dur: 0.4, type: 'sine', vol: 0.22, release: 0.1 });
    // shimmer
    tone({ freq: 2400, freqEnd: 3200, dur: 0.3, type: 'sine', vol: 0.08, release: 0.1, delay: 0.1 });
  },
  'reaction.success': () => {
    // major C5/E5/G5 arpeggio
    tone({ freq: 523.25, dur: 0.18, type: 'sine', vol: 0.22, delay: 0.0 });
    tone({ freq: 659.25, dur: 0.18, type: 'sine', vol: 0.22, delay: 0.06 });
    tone({ freq: 783.99, dur: 0.20, type: 'sine', vol: 0.22, delay: 0.12 });
  },
  'reaction.fail': () => {
    tone({ freq: 440, dur: 0.13, type: 'sawtooth', vol: 0.18 });
    tone({ freq: 349.23, dur: 0.15, type: 'sawtooth', vol: 0.18, delay: 0.1 });
  },

  'discovery.element': () => {
    // 4-note ascending C5 E5 G5 C6
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((f, i) => {
      tone({ freq: f, dur: 0.12, type: 'sine', vol: 0.22, delay: i * 0.09 });
    });
  },
  'discovery.compound': () => {
    // 6-note + sub-bass
    const seq = [392, 523.25, 659.25, 783.99, 987.77, 1318.5];
    seq.forEach((f, i) => {
      tone({ freq: f, dur: 0.14, type: 'sine', vol: 0.22, delay: i * 0.1 });
    });
    // sub-bass
    tone({ freq: 65.4, dur: 0.6, type: 'sine', vol: 0.18, release: 0.15 });
  },
  'discovery.levelup': () => {
    // fanfare — sine arpeggio with longer tail
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => {
      tone({ freq: f, dur: 0.18, type: 'sine', vol: 0.24, delay: i * 0.1, release: 0.2 });
      // octave shimmer
      tone({ freq: f * 2, dur: 0.18, type: 'sine', vol: 0.06, delay: i * 0.1 + 0.02, release: 0.2 });
    });
    // sustained crown
    tone({ freq: 1046.5, dur: 0.6, type: 'sine', vol: 0.16, delay: 0.6, release: 0.4 });
  },

  'ambient.lab': () => {
    if (activeLoops.has('ambient.lab')) return;
    if (!ctx || !masterGain) return;
    // Pink noise loop at very low volume
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(2.0, 'pink');
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 800;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    src.connect(filt).connect(g).connect(masterGain);
    src.start();

    // Occasional bubble blips
    let stopped = false;
    const scheduleBubble = () => {
      if (stopped) return;
      const wait = 1500 + Math.random() * 4000;
      setTimeout(() => {
        if (stopped) return;
        const f = 300 + Math.random() * 400;
        tone({ freq: f, freqEnd: f * 1.4, dur: 0.08, type: 'sine', vol: 0.06, release: 0.04 });
        scheduleBubble();
      }, wait);
    };
    scheduleBubble();

    activeLoops.set('ambient.lab', {
      stop() {
        stopped = true;
        try { src.stop(); } catch {}
      }
    });
  }
};

// ---------- public API -----------------------------------------------------

const audioMock = {
  init(_opts = {}) {
    if (ready) return true;
    if (!AC) {
      console.debug('[audioMock] no AudioContext — running silent.');
      return false;
    }
    try {
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : MAX_MASTER;
      masterGain.connect(ctx.destination);

      // Some browsers create a suspended context — resume on init.
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        ctx.resume().catch(() => {});
      }

      // Pause/resume on visibility change (nice-to-have).
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (!ctx) return;
          if (document.hidden && ctx.state === 'running') {
            ctx.suspend().catch(() => {});
          } else if (!document.hidden && ctx.state === 'suspended') {
            ctx.resume().catch(() => {});
          }
        });
      }

      ready = true;
      return true;
    } catch (e) {
      console.warn('[audioMock] init failed', e);
      ctx = null;
      masterGain = null;
      ready = false;
      return false;
    }
  },

  play(soundId, opts = {}) {
    if (!ready || !ctx || muted) return;
    const recipe = RECIPES[soundId];
    if (!recipe) {
      console.debug('[audioMock] unknown sound', soundId);
      return;
    }
    // Auto-resume in case browser suspended.
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      ctx.resume().catch(() => {});
    }
    try {
      recipe(opts);
    } catch (e) {
      console.warn('[audioMock] play failed', soundId, e);
    }
  },

  stop(soundId) {
    const loop = activeLoops.get(soundId);
    if (loop) {
      try { loop.stop(); } catch {}
      activeLoops.delete(soundId);
    }
  },

  setMuted(flag) {
    muted = !!flag;
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : MAX_MASTER;
    }
  },

  isReady() { return ready; }
};

export default audioMock;

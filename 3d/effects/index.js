// index.js — barrel + registry for all built-in particle effects.
//
// Effects are referenced by string name from data files (e.g. reactions.json).
// To add a new effect:
//   1. Write the file (e.g. ./mySparkle.js) exporting `class Effect { ... }`.
//   2. Import + register it below.
//   3. Reference it by name in your reaction data.

import { Effect as WaterRipple }    from './waterRipple.js';
import { Effect as Flame }          from './flame.js';
import { Effect as Smoke }          from './smoke.js';
import { Effect as CrystalSparkle } from './crystalSparkle.js';
import { Effect as GasBubble }      from './gasBubble.js';
import { Effect as Dust }           from './dust.js';
import { Effect as Sparks }         from './sparks.js';
import { Effect as GlowPulse }      from './glowPulse.js';
import { Effect as Shimmer }        from './shimmer.js';
import { Effect as CymaticBloom }   from './cymaticBloom.js';

export const REGISTRY = {
  'water-ripple':    WaterRipple,
  'flame':           Flame,
  'smoke':           Smoke,
  'crystal-sparkle': CrystalSparkle,
  'gas-bubble':      GasBubble,
  'dust':            Dust,
  'sparks':          Sparks,
  'glow-pulse':      GlowPulse,
  'shimmer':         Shimmer,
  'cymatic-bloom':   CymaticBloom
};

/**
 * Construct an effect by registry name.
 * @param {string} name  registry key (e.g. 'flame')
 * @param {Object} [opts] effect options ({color, intensity, scale, position})
 * @returns {Effect | null}
 */
export function spawnEffect(name, opts) {
  const Cls = REGISTRY[name];
  if (!Cls) {
    console.warn('[fx] unknown effect', name);
    return null;
  }
  return new Cls(opts);
}

// Re-export classes for direct import if wanted.
export {
  WaterRipple,
  Flame,
  Smoke,
  CrystalSparkle,
  GasBubble,
  Dust,
  Sparks,
  GlowPulse,
  Shimmer,
  CymaticBloom
};

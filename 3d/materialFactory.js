// materialFactory.js — picks an appropriate material name based on element category and
// constructs a THREE material via the named provider.

import * as glass from './materials/glass.js';
import * as metal from './materials/metal.js';
import * as crystal from './materials/crystal.js';
import * as plasma from './materials/plasma.js';

const MATS = { glass, metal, crystal, plasma };

const CATEGORY_TO_MATERIAL = {
  'alkali-metal':    'metal',
  'alkaline-earth':  'metal',
  'transition':      'metal',
  'post-transition': 'metal',
  'noble':           'plasma',
  'halogen':         'plasma',
  'metalloid':       'crystal',
  'nonmetal':        'glass'
};

/**
 * Decide which material name to use for a given element entry.
 * `element` may be an element record (with `.category`) or a symbol string + a lookup map.
 * Falls back to `defaultName` if category unknown.
 */
export function pickMaterial(element, defaultName = 'glass') {
  if (!element) return defaultName;
  const category = (typeof element === 'string') ? null : element.category;
  if (!category) return defaultName;
  return CATEGORY_TO_MATERIAL[category] || defaultName;
}

/** Build a THREE material by name. Unknown names fall back to glass. */
export function createMaterial(name, hexColor, opts) {
  const provider = MATS[name] || MATS.glass;
  return provider.createMaterial(hexColor, opts);
}

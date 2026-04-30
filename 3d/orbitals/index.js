// index.js — barrel export for the orbital module.
//
// Importable but DORMANT — not wired into main.js or any screen. Use
// these exports from a future integration layer (or from the demo.html
// preview) when you're ready to ship orbital views.

export { parseConfig, subshellCapacity } from './electronConfig.js';
export { buildSubshellGroup }             from './orbitalShapes.js';
export { createOrbitalModel }             from './orbitalModel.js';
export { createBohrModel }                from './bohrModel.js';

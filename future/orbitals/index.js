// Barrel export for the orbital module.
// Import from this file instead of the individual sub-modules so the public
// API stays stable as internals evolve.

export { parseConfig, subshellCapacity } from './electronConfig.js';
export { buildSubshellGroup } from './orbitalShapes.js';
export { createOrbitalModel } from './orbitalModel.js';

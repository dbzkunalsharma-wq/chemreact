// ITracker.js — interface contract. Implementations must match this shape.
// Today: trackerMock.js (dev-panel buttons).  Later: trackerMindAR.js (real AR).
//
// Events emitted on `bus`:
//   ELEMENT_DETECTED  payload: { elementId: string, position?: {x,y,z}, confidence?: number }
//   ELEMENT_LOST      payload: { elementId: string }
//   DISTANCE_CHANGE   payload: { a: string, b: string, cm: number }   // for proximity reaction later
//
// All implementations export a default object with this shape:
//   { start(), stop(), getActive() => string[], simulate(elementId) }
//
// Screens NEVER import implementations directly — they get the active tracker via deps.

export const TRACKER_API = ['start', 'stop', 'getActive', 'simulate'];

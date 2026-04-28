// ARTransformProvider.js — interface contract. Implementations must match this shape.
//
// An ARTransformProvider supplies per-frame 4x4 transformation matrices for
// detected card targets. The CardRenderer subscribes to its events and applies
// each matrix to a corresponding THREE.Group.
//
// Today: arTransformMock.js (simulated cards floating with a gentle sway).
// Later: arTransformMindAR.js (real-time MindAR camera tracking).
//
// API (every implementation MUST provide):
//   start()                           — begin emitting transforms (open camera, start RAF, etc.)
//   stop()                            — halt emission
//   onTargetFound(handler)            — register a "card detected" listener
//                                       handler({ targetId, matrix }) → returns unsubscribe()
//   onTargetLost(handler)             — register a "card lost" listener
//                                       handler({ targetId })          → returns unsubscribe()
//   onMatrixUpdate(handler)           — register a per-frame transform listener
//                                       handler({ targetId, matrix })  → returns unsubscribe()
//
// `matrix` is a Float32Array(16), column-major (Three.js convention).
// `targetId` is an arbitrary string — the consumer just needs unique identity.
//
// Screens NEVER import implementations directly — they receive the active
// provider via deps (or instantiate the mock directly in preview screens).

export const AR_TRANSFORM_API = [
  'start',
  'stop',
  'onTargetFound',
  'onTargetLost',
  'onMatrixUpdate'
];

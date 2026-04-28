// drift.js — a slow vertical bob, like the molecule is floating.
// calm=small slow drift, regular=medium amount. Default regular.

const PROFILES = {
  calm:    { amp: 0.05, period: 3.5 },
  regular: { amp: 0.10, period: 2.4 },
  medium:  { amp: 0.10, period: 2.4 }
};

export function drift(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'regular';
  const p = PROFILES[intensity] || PROFILES.regular;

  if (group.userData._driftT == null) group.userData._driftT = 0;
  group.userData._driftT += dt;

  if (group.userData._driftBaseY == null) {
    group.userData._driftBaseY = group.position.y;
  }

  const phase = (group.userData._driftT / p.period) * Math.PI * 2;
  group.position.y = group.userData._driftBaseY + Math.sin(phase) * p.amp;
}

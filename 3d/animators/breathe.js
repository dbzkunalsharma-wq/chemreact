// breathe.js — sinusoidal whole-group scale, like the molecule is breathing.
// Range 0.95-1.05. Periods: slow=2s, medium=1.4s, fast=0.9s.

const PERIODS = {
  slow:   2.0,
  medium: 1.4,
  fast:   0.9
};

export function breathe(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const period = PERIODS[intensity] != null ? PERIODS[intensity] : PERIODS.medium;

  if (group.userData._breatheT == null) group.userData._breatheT = 0;
  group.userData._breatheT += dt;

  const phase = (group.userData._breatheT / period) * Math.PI * 2;
  const s = 1.0 + 0.05 * Math.sin(phase);

  // Compose with whatever base scale the renderer set (so breathe doesn't fight the fit-to-camera scale).
  if (!group.userData._baseScale) {
    group.userData._baseScale = group.scale.clone();
  }
  const b = group.userData._baseScale;
  group.scale.set(b.x * s, b.y * s, b.z * s);
}

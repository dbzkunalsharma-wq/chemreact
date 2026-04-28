// rotate.js — spins the molecule group around the Y axis.
// Intensity:  slow=0.3 rad/s, medium=0.8 rad/s, fast=1.6 rad/s. Default = medium.

const SPEEDS = {
  slow:   0.3,
  medium: 0.8,
  fast:   1.6
};

export function rotate(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const speed = SPEEDS[intensity] != null ? SPEEDS[intensity] : SPEEDS.medium;
  group.rotation.y += speed * dt;
}

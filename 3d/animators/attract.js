// attract.js — pulls atom meshes slightly toward the group's local origin. Used for
// combine animations where atoms should appear to be drawn together.
// We oscillate around their home positions: a soft inward breath rather than a permanent pull,
// so the molecule doesn't collapse over time.

const THREE = window.THREE;

const PROFILES = {
  soft:   { amount: 0.04, period: 1.6 },
  medium: { amount: 0.07, period: 1.4 },
  strong: { amount: 0.12, period: 1.2 }
};

export function attract(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const p = PROFILES[intensity] || PROFILES.medium;

  if (group.userData._attractT == null) group.userData._attractT = 0;
  group.userData._attractT += dt;

  // 0..1 pulsation, biased toward "pulling in".
  const phase = (group.userData._attractT / p.period) * Math.PI * 2;
  const pull = (Math.sin(phase) + 1) / 2; // 0..1

  group.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!obj.userData || obj.userData.kind !== 'atom') return;

    if (!obj.userData.homePos) obj.userData.homePos = obj.position.clone();
    const h = obj.userData.homePos;

    // Target = home pulled toward origin by `p.amount * pull`.
    obj.position.set(
      h.x * (1 - p.amount * pull),
      h.y * (1 - p.amount * pull),
      h.z * (1 - p.amount * pull)
    );
  });
}

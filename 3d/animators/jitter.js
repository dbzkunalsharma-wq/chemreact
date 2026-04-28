// jitter.js — small random per-atom positional offsets to imply thermal motion.
// We store each mesh's home position in mesh.userData.homePos the first time we see it,
// then nudge from that home each frame so jitter doesn't drift away from the layout.

const THREE = window.THREE;

const AMPLITUDES = {
  soft:   0.01,
  medium: 0.02,
  high:   0.05
};

export function jitter(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const amp = AMPLITUDES[intensity] != null ? AMPLITUDES[intensity] : AMPLITUDES.medium;

  group.traverse((obj) => {
    if (!obj.isMesh) return;
    if (obj.userData && obj.userData.kind === 'bond') return; // bonds follow atoms naturally; leave them alone

    if (!obj.userData.homePos) {
      obj.userData.homePos = obj.position.clone();
    }
    const h = obj.userData.homePos;
    obj.position.set(
      h.x + (Math.random() - 0.5) * amp,
      h.y + (Math.random() - 0.5) * amp,
      h.z + (Math.random() - 0.5) * amp
    );
  });
}

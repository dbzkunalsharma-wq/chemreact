// shimmer.js — sweeps a brighter reflection across the surface by oscillating
// envMapIntensity (or roughness on materials without it) so it reads as a moving highlight.
// metal = strong/fast sweep, default = subtle.

const PROFILES = {
  metal:  { ampEnv: 0.8, ampRough: 0.15, period: 1.6 },
  edges:  { ampEnv: 0.4, ampRough: 0.10, period: 2.2 },
  medium: { ampEnv: 0.4, ampRough: 0.08, period: 2.2 }
};

export function shimmer(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const p = PROFILES[intensity] || PROFILES.medium;

  if (group.userData._shimmerT == null) group.userData._shimmerT = 0;
  group.userData._shimmerT += dt;

  const phase = (group.userData._shimmerT / p.period) * Math.PI * 2;
  const wave = Math.sin(phase); // -1..1

  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mat = obj.material;

    // Cache base values once.
    if (obj.userData._shimmerBase == null) {
      obj.userData._shimmerBase = {
        envMapIntensity: mat.envMapIntensity != null ? mat.envMapIntensity : 1,
        roughness:       mat.roughness != null ? mat.roughness : 0.5
      };
    }
    const base = obj.userData._shimmerBase;

    if ('envMapIntensity' in mat) {
      mat.envMapIntensity = base.envMapIntensity + wave * p.ampEnv;
    }
    if ('roughness' in mat) {
      // inverse-correlated: brighter sweep = lower roughness
      const r = base.roughness - wave * p.ampRough;
      mat.roughness = Math.max(0.02, Math.min(1, r));
    }
  });
}

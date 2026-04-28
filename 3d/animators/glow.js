// glow.js — pulses material emissiveIntensity (and warms the hue for "warm").
// soft: 0.2-0.4 swing. warm: 0.4-0.7 with warm orange tint. bright: 0.5-1.0.

const THREE = window.THREE;

const PROFILES = {
  soft:   { min: 0.2, max: 0.4, period: 2.2, hue: null },
  warm:   { min: 0.4, max: 0.7, period: 1.6, hue: 0xffaa55 },
  bright: { min: 0.5, max: 1.0, period: 1.2, hue: null }
};

export function glow(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'soft';
  const p = PROFILES[intensity] || PROFILES.soft;

  if (group.userData._glowT == null) group.userData._glowT = 0;
  group.userData._glowT += dt;

  const phase = (group.userData._glowT / p.period) * Math.PI * 2;
  const t = (Math.sin(phase) + 1) / 2; // 0..1
  const e = p.min + (p.max - p.min) * t;

  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mat = obj.material;
    if (mat.emissiveIntensity == null && mat.emissive == null) return;

    if (mat.emissive) {
      if (!obj.userData._origEmissive) {
        obj.userData._origEmissive = mat.emissive.clone();
      }
      if (p.hue != null) {
        mat.emissive.setHex(p.hue);
      } else {
        mat.emissive.copy(obj.userData._origEmissive);
      }
    }
    if ('emissiveIntensity' in mat) {
      mat.emissiveIntensity = e;
    }
  });
}

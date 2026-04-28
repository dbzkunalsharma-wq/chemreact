// ripple.js — distorts atom-mesh vertices slightly using a sine wave over time so the
// surface looks liquid/jelly-like. Stores the original positions so we always offset from the
// rest pose.

const THREE = window.THREE;

const PROFILES = {
  soft:   { amp: 0.025, freq: 2.0, period: 1.2 },
  medium: { amp: 0.04,  freq: 2.5, period: 1.0 },
  bright: { amp: 0.06,  freq: 3.0, period: 0.8 }
};

function cacheOriginal(mesh) {
  if (mesh.userData._rippleOrig) return mesh.userData._rippleOrig;
  const pos = mesh.geometry.attributes.position;
  const arr = new Float32Array(pos.array.length);
  arr.set(pos.array);
  mesh.userData._rippleOrig = arr;
  return arr;
}

export function ripple(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'soft';
  const p = PROFILES[intensity] || PROFILES.soft;

  if (group.userData._rippleT == null) group.userData._rippleT = 0;
  group.userData._rippleT += dt;

  const phase = (group.userData._rippleT / p.period) * Math.PI * 2;

  group.traverse((obj) => {
    if (!obj.isMesh || !obj.geometry) return;
    if (!obj.userData || obj.userData.kind !== 'atom') return;
    const geom = obj.geometry;
    if (!geom.attributes || !geom.attributes.position) return;

    const orig = cacheOriginal(obj);
    const pos = geom.attributes.position;
    const arr = pos.array;

    for (let i = 0; i < arr.length; i += 3) {
      const ox = orig[i], oy = orig[i + 1], oz = orig[i + 2];
      const r = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
      const offset = p.amp * Math.sin(phase + (ox + oy + oz) * p.freq);
      const k = 1 + offset;
      arr[i]     = ox * k;
      arr[i + 1] = oy * k;
      arr[i + 2] = oz * k;
      // r kept for parity / future variants
      void r;
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();
  });
}

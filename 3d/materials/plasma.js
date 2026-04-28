// plasma.js — energetic glowing look for reactive elements (halogens, nobles).
// MeshBasicMaterial-flavored but we use MeshStandardMaterial with strong emissive so it picks
// up no shadows but still respects depth. transparent for an atmospheric feel.

const THREE = window.THREE;

export function createMaterial(hexColor, opts = {}) {
  const color = new THREE.Color(hexColor || '#ff66cc');
  // Use Basic so it ignores lighting entirely (truly "plasma" / glowing core look).
  const mat = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.7,
    depthWrite: true,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide
  });
  // Provide soft virtual emissive properties so glow.js can still pulse it.
  mat.emissive = color.clone();
  mat.emissiveIntensity = 0.8;
  void opts;
  return mat;
}

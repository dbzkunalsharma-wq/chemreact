// crystal.js — sharp, faceted, gem-like. MeshPhysicalMaterial with high IOR + clearcoat.

const THREE = window.THREE;

export function createMaterial(hexColor, opts = {}) {
  const color = new THREE.Color(hexColor || '#bbeeff');
  const mat = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.4,
    roughness: 0.05,
    metalness: 0.0,
    ior: 2.0,
    thickness: 0.7,
    transparent: true,
    opacity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    flatShading: true, // sharp facet feel
    emissive: color.clone().multiplyScalar(0.06),
    emissiveIntensity: 0.4,
    envMapIntensity: 1.2,
    side: THREE.FrontSide
  });
  void opts;
  return mat;
}

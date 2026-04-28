// metal.js — polished metallic look. MeshStandardMaterial with high metalness.

const THREE = window.THREE;

export function createMaterial(hexColor, opts = {}) {
  const color = new THREE.Color(hexColor || '#cccccc');
  const emissive = color.clone().multiplyScalar(0.05);
  const mat = new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.95,
    roughness: 0.25,
    emissive: emissive,
    emissiveIntensity: 0.5,
    envMapIntensity: 1.0
  });
  void opts;
  return mat;
}

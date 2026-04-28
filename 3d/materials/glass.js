// glass.js — translucent jelly/bottle look. Uses MeshPhysicalMaterial transmission.

const THREE = window.THREE;

export function createMaterial(hexColor, opts = {}) {
  const color = new THREE.Color(hexColor || '#ffffff');
  const mat = new THREE.MeshPhysicalMaterial({
    color: color,
    transmission: 0.6,
    roughness: 0.1,
    metalness: 0.0,
    ior: 1.5,
    thickness: 0.5,
    transparent: true,
    opacity: 1.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.2,
    emissive: color.clone().multiplyScalar(0.04),
    emissiveIntensity: 0.4,
    envMapIntensity: 1.0,
    side: THREE.FrontSide
  });
  if (opts.transparentOverride != null) mat.opacity = opts.transparentOverride;
  return mat;
}

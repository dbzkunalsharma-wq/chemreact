// orbitalModel.js — assemble a stylised rotating-orbital model for one element.
//
// Usage:
//   import { createOrbitalModel } from './orbitalModel.js';
//   const m = createOrbitalModel(element, { color: '#6FE7FF' });
//   scene.add(m.group);
//   // per frame:
//   m.update(dt);
//   // teardown:
//   m.dispose();
//
// Notes:
//   - Geometry/materials are owned and disposed in dispose().
//   - update(dt) does NO allocations per frame (scratch quaternion is reused).
//   - Designed for additive blending against a dark background.

import { parseConfig, subshellCapacity } from './electronConfig.js';
import { buildSubshellGroup } from './orbitalShapes.js';

const THREE = window.THREE;

// Per-l-type opacity (s densest, f thinnest — visual hierarchy).
const L_OPACITY = { s: 0.55, p: 0.45, d: 0.38, f: 0.32 };

// Different spin axis per orbital type so visually-coplanar shapes don't
// rotate together — gives the impression of independent angular momentum.
const L_SPIN_AXIS = {
  s: new THREE.Vector3(0,   1,   0),
  p: new THREE.Vector3(1,   0.3, 0),
  d: new THREE.Vector3(0.4, 1,   0.2),
  f: new THREE.Vector3(0.8, 0.2, 0.6)
};
const L_SPIN_MULT = { s: 1.0, p: 1.3, d: 1.6, f: 1.9 };

// Per-l small phase tilt added on top of the n-based tilt so two same-n
// subshells (e.g. 2s + 2p) don't sit perfectly coplanar and z-fight.
const L_TILT_PHASE = { s: 0, p: 0.7, d: 1.4, f: 2.1 };

export function createOrbitalModel(element, opts) {
  opts = opts || {};
  const config = (element && element.config) || '1s1';
  const shells = parseConfig(config);
  const colorHex =
    opts.color ||
    (element && element.cpkColor) ||
    (element && element.color) ||
    '#6FE7FF';
  const colorObj = new THREE.Color(colorHex);

  const root = new THREE.Group();
  const ownedGeos = [];
  const ownedMats = [];
  const subshellEntries = [];

  // ── Nucleus — small, additive-blended, slightly brighter than the shell color.
  const nucGeo = new THREE.SphereGeometry(0.22, 24, 16);
  ownedGeos.push(nucGeo);
  const nucMat = new THREE.MeshBasicMaterial({
    color: colorObj.clone().multiplyScalar(1.4),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide
  });
  ownedMats.push(nucMat);
  const nucleus = new THREE.Mesh(nucGeo, nucMat);
  root.add(nucleus);

  // ── Shells — one MeshBasicMaterial per subshell so opacities can differ.
  for (const shell of shells) {
    const cap = subshellCapacity(shell.l) || 1;
    const fillRatio = Math.min(1, shell.count / cap);
    const baseOpacity = (L_OPACITY[shell.l] || 0.4) * (0.5 + fillRatio * 0.5);

    const mat = new THREE.MeshBasicMaterial({
      color: colorObj.clone(),
      transparent: true,
      opacity: baseOpacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    ownedMats.push(mat);

    const sub = buildSubshellGroup(shell.l, mat);
    // Caller-driven scale: outer shells sit at larger radii.
    const radius = 0.45 + (shell.n - 1) * 0.55;
    sub.scale.setScalar(radius);

    // Tilt to break coplanarity within the same n. Each l-type contributes
    // a different phase; multiply by 0.12 so the tilt is subtle.
    const tilt = (shell.n + (L_TILT_PHASE[shell.l] || 0)) * 0.12;
    sub.rotation.set(tilt * 0.7, tilt * 1.1, tilt * 0.5);

    // Inherit owned geos from the subshell builder.
    if (sub.userData && Array.isArray(sub.userData._ownedGeos)) {
      ownedGeos.push.apply(ownedGeos, sub.userData._ownedGeos);
    }

    const axis  = L_SPIN_AXIS[shell.l].clone().normalize();
    const speed = 1.4 * Math.pow(0.55, shell.n - 1) * (L_SPIN_MULT[shell.l] || 1);

    subshellEntries.push({ group: sub, axis, speed, n: shell.n, l: shell.l, count: shell.count });
    root.add(sub);
  }

  // ── Animation state (no per-frame allocation — see update).
  let nucPulseT = 0;
  let driftT   = 0;
  const _spinQuat = new THREE.Quaternion();

  function update(dt) {
    if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
    nucPulseT += dt;
    driftT   += dt;

    // Nucleus pulse: subtle ±8% scale oscillation.
    nucleus.scale.setScalar(1 + Math.sin(nucPulseT * 2.4) * 0.08);

    // Spin each subshell around its own axis at its own speed.
    for (let i = 0; i < subshellEntries.length; i++) {
      const s = subshellEntries[i];
      _spinQuat.setFromAxisAngle(s.axis, s.speed * dt);
      s.group.quaternion.multiply(_spinQuat);
    }

    // Whole-group vertical drift — adds a sense of life.
    root.position.y = Math.sin(driftT * 0.4) * 0.08;
  }

  function dispose() {
    for (let i = 0; i < ownedGeos.length; i++) {
      try { ownedGeos[i].dispose(); } catch (_e) { /* already disposed */ }
    }
    for (let i = 0; i < ownedMats.length; i++) {
      try { ownedMats[i].dispose(); } catch (_e) { /* already disposed */ }
    }
    while (root.children.length > 0) root.remove(root.children[0]);
  }

  return {
    group: root,
    update: update,
    dispose: dispose,
    shells: subshellEntries
  };
}

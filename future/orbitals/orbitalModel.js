// orbitalModel.js — assemble a rotating-orbital model for a single element.
//
// Public API:
//   const model = createOrbitalModel(element, opts);
//   scene.add(model.group);
//   // each frame:
//   model.update(dt);
//   // when done:
//   model.dispose();
//
// `element` is an entry from data/elements.json (must include `config` and
// optionally `cpkColor` / `color`). `opts` lets the caller override visuals.
//
// Each subshell becomes its own THREE.Group rotating on a per-shell axis at
// a per-shell speed, so the result is a layered "atom in motion" — inner
// shells spin fast and tight, outer shells slow and wide.

import { parseConfig, subshellCapacity } from './electronConfig.js';
import { buildSubshellGroup } from './orbitalShapes.js';

const THREE = window.THREE;

const SHELL_SPACING = 0.55;   // distance between successive principal shells
const BASE_RADIUS   = 0.45;   // radius of the n=1 shell
const SPIN_BASE     = 1.4;    // radians/sec for outermost shell
const SPIN_FALLOFF  = 0.55;   // multiplier per inner shell (faster inside)

// One axis per subshell type so they don't all spin the same way.
const SPIN_AXIS = {
  s: [0, 1, 0],
  p: [1, 0.3, 0],
  d: [0.4, 1, 0.2],
  f: [0.8, 0.2, 0.6]
};

export function createOrbitalModel(element, opts = {}) {
  const root = new THREE.Group();
  const shells = parseConfig(element && element.config);
  const colorHex = opts.color || (element && (element.cpkColor || element.color)) || '#6FE7FF';
  const baseColor = new THREE.Color(colorHex);

  // Central nucleus marker — small glowing sphere so an empty atom isn't blank.
  const nucleus = buildNucleus(baseColor);
  root.add(nucleus);

  const subshellGroups = [];
  const ownedMaterials = [];
  const ownedGeometries = [nucleus.geometry];
  ownedMaterials.push(nucleus.material);

  for (const shell of shells) {
    const fill = shell.count / subshellCapacity(shell.l);
    const material = buildShellMaterial(baseColor, shell.l, fill);
    ownedMaterials.push(material);

    const sub = buildSubshellGroup(shell.l, material);
    const radius = BASE_RADIUS + (shell.n - 1) * SHELL_SPACING;
    sub.scale.setScalar(radius);

    // Slight tilt per shell so coplanar subshells don't z-fight.
    sub.rotation.x = (shell.n + (shell.l.charCodeAt(0) % 7)) * 0.18;
    sub.rotation.z = (shell.l.charCodeAt(0) * 0.21) % Math.PI;

    // Pre-compute spin axis + speed so update() stays cheap.
    const ax = SPIN_AXIS[shell.l] || [0, 1, 0];
    const axis = new THREE.Vector3(ax[0], ax[1], ax[2]).normalize();
    const speed = SPIN_BASE * Math.pow(SPIN_FALLOFF, shell.n - 1) *
                  (shell.l === 's' ? 1.0 : shell.l === 'p' ? 1.3 : shell.l === 'd' ? 1.6 : 1.9);

    subshellGroups.push({ group: sub, axis, speed });
    root.add(sub);

    // Track every geometry inside the subshell for disposal.
    sub.traverse((o) => { if (o.geometry) ownedGeometries.push(o.geometry); });
  }

  // Optional global tilt + idle drift so the whole atom feels alive.
  let driftPhase = 0;
  const NUCLEUS_PULSE = 0.18;

  function update(dt) {
    if (!dt) return;
    for (const s of subshellGroups) {
      // Rotate around shell-specific axis.
      const angle = s.speed * dt;
      const q = new THREE.Quaternion().setFromAxisAngle(s.axis, angle);
      s.group.quaternion.multiplyQuaternions(q, s.group.quaternion);
    }
    driftPhase += dt;
    nucleus.scale.setScalar(1 + Math.sin(driftPhase * 3.0) * NUCLEUS_PULSE);
    root.rotation.y += dt * 0.12;
  }

  function dispose() {
    for (const g of ownedGeometries) g.dispose();
    for (const m of ownedMaterials) m.dispose();
    root.clear();
  }

  return { group: root, update, dispose, shells };
}

// ---------- internals ----------
function buildNucleus(baseColor) {
  const geo = new THREE.SphereGeometry(0.18, 24, 16);
  const mat = new THREE.MeshBasicMaterial({
    color: baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.35),
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  return new THREE.Mesh(geo, mat);
}

function buildShellMaterial(baseColor, l, fill) {
  // Outer shells more transparent; partially-filled subshells dimmer.
  const lOpacity = { s: 0.55, p: 0.45, d: 0.38, f: 0.32 }[l] || 0.4;
  const opacity = lOpacity * (0.55 + 0.45 * Math.max(0.05, Math.min(1, fill)));
  return new THREE.MeshBasicMaterial({
    color: baseColor,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    wireframe: false
  });
}

// bohrModel.js — classical Bohr atomic model.
//
// What this gives you (matching the planetary-style visualisations students
// see in NCERT Class 9–10 textbooks):
//   - A nucleus of distinct red protons + green neutrons clustered together.
//   - Concentric circular orbits (one per shell n) drawn as thin rings.
//   - Blue electrons spaced evenly around each ring, orbiting at speeds that
//     fall off with shell number (outer shells slower).
//
// Same lifecycle as createOrbitalModel:
//   { group, update(dt), dispose, shells, protonCount, neutronCount }
//
// Inputs:
//   element  — { config, z?, mass?, ... } (config drives shell electron counts;
//              z drives proton count; mass-z drives neutron count)
//   opts     — {
//                ringColor:  '#6FE7FF',   // ring tint (defaults to cyan)
//                showNucleus: true,        // hide nucleus for "shells only" mode
//                nucleonRadius: 0.18,      // sphere size for protons/neutrons
//                electronRadius: 0.16,
//                baseRadius: 1.2,          // first-shell ring radius
//                shellSpacing: 0.9,        // additional radius per shell
//              }

import { parseConfig } from './electronConfig.js';

const THREE = window.THREE;

// CPK-style colours for nucleus + electrons (intentionally hex literals — these
// are the universal "physics teacher diagram" colours, not theme tokens).
const COLOR_PROTON   = 0xff5066;
const COLOR_NEUTRON  = 0x5cd97a;
const COLOR_ELECTRON = 0x5099ff;

/** Sum electrons by principal quantum number. Returns { n: count, ... }. */
function shellCountsFromConfig(config) {
  const shells = parseConfig(config);
  const counts = {};
  for (const s of shells) counts[s.n] = (counts[s.n] || 0) + s.count;
  return counts;
}

/** Pack N points into a sphere via the Fibonacci-spiral method. */
function fibSphere(N, radius) {
  const out = new Array(N);
  const offset = 2 / N;
  const inc = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = ((i * offset) - 1) + (offset / 2);
    const r = Math.sqrt(1 - y * y);
    const phi = i * inc;
    out[i] = [
      Math.cos(phi) * r * radius,
      y * radius,
      Math.sin(phi) * r * radius
    ];
  }
  return out;
}

export function createBohrModel(element, opts) {
  opts = opts || {};
  const config = (element && element.config) || '1s1';
  const z      = (element && element.z) || 1;
  const mass   = (element && element.mass) || z * 2;
  // Round neutron count from atomic mass; floor at 0 for hydrogen ¹H.
  const neutronCount = Math.max(0, Math.round(mass - z));
  const totalNucleons = z + neutronCount;

  const counts = shellCountsFromConfig(config);
  const sortedShells = Object.keys(counts).map(Number).sort((a, b) => a - b);

  const ringColorHex     = opts.ringColor    || '#6FE7FF';
  const showNucleus      = opts.showNucleus !== false;
  const nucleonRadius    = opts.nucleonRadius   || 0.18;
  const electronRadius   = opts.electronRadius  || 0.16;
  const baseRadius       = opts.baseRadius      || 1.2;
  const shellSpacing     = opts.shellSpacing    || 0.9;

  // ── Owned resources ──
  const ownedGeos = [];
  const ownedMats = [];

  // Shared geometries (one allocation per model, reused by every instance).
  const protonGeo   = new THREE.SphereGeometry(nucleonRadius,  16, 12); ownedGeos.push(protonGeo);
  const neutronGeo  = new THREE.SphereGeometry(nucleonRadius,  16, 12); ownedGeos.push(neutronGeo);
  const electronGeo = new THREE.SphereGeometry(electronRadius, 16, 12); ownedGeos.push(electronGeo);

  // Materials. Slight emissive feel via additive blending so they pop on dark bg.
  const protonMat = new THREE.MeshBasicMaterial({
    color: COLOR_PROTON,
    transparent: true, opacity: 0.95
  });
  ownedMats.push(protonMat);
  const neutronMat = new THREE.MeshBasicMaterial({
    color: COLOR_NEUTRON,
    transparent: true, opacity: 0.95
  });
  ownedMats.push(neutronMat);
  const electronMat = new THREE.MeshBasicMaterial({
    color: COLOR_ELECTRON,
    transparent: true, opacity: 1.0
  });
  ownedMats.push(electronMat);
  const ringMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(ringColorHex),
    transparent: true, opacity: 0.45,
    side: THREE.DoubleSide
  });
  ownedMats.push(ringMat);

  const root = new THREE.Group();

  // ── Nucleus ─────────────────────────────────────────────────────────
  const nucleus = new THREE.Group();
  if (showNucleus) {
    // Pack radius scales with cube root of nucleon count (real nuclei do this).
    const packRadius = Math.max(nucleonRadius * 0.5,
                                nucleonRadius * Math.pow(totalNucleons, 1/3) * 0.55);
    const positions = fibSphere(totalNucleons, packRadius);
    for (let i = 0; i < totalNucleons; i++) {
      const isProton = i < z;
      const m = new THREE.Mesh(
        isProton ? protonGeo  : neutronGeo,
        isProton ? protonMat  : neutronMat
      );
      const p = positions[i];
      m.position.set(p[0], p[1], p[2]);
      nucleus.add(m);
    }
  }
  root.add(nucleus);

  // ── Shells ──────────────────────────────────────────────────────────
  // Each shell gets one tilted ring + a list of electron meshes whose angles
  // we advance per frame (no quaternion juggling — straight cos/sin updates).
  const shellEntries = [];
  for (let i = 0; i < sortedShells.length; i++) {
    const n = sortedShells[i];
    const eCount = counts[n];
    const radius = baseRadius + (n - 1) * shellSpacing;
    const tube   = 0.022 + 0.004 * n;          // thicker rings for outer shells

    const ringGeo = new THREE.TorusGeometry(radius, tube, 8, Math.max(48, eCount * 8));
    ownedGeos.push(ringGeo);

    // Each shell is its own group so we can tilt it slightly without affecting
    // the others. Tilt pattern alternates direction so adjacent shells don't
    // sit perfectly coplanar (avoids visual z-fight).
    const shellGroup = new THREE.Group();
    shellGroup.rotation.set(
      (n % 2 === 0 ? 1 : -1) * 0.18 * n,
      0,
      0.10 * n
    );

    // Ring sits in the xz plane (y = 0); shellGroup tilt orients it in space.
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    shellGroup.add(ring);

    // Electrons evenly spaced along the ring at y = 0.
    const electrons = new Array(eCount);
    for (let k = 0; k < eCount; k++) {
      const angle = (k / eCount) * Math.PI * 2;
      const e = new THREE.Mesh(electronGeo, electronMat);
      e.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      shellGroup.add(e);
      electrons[k] = { mesh: e, angle: angle };
    }

    // Outer shells orbit slower — roughly Bohr-style: T_n ∝ n³, so ω ∝ 1/n³.
    // We use a gentler 1/sqrt(n) for visual liveliness; "real" Bohr would slow
    // outer shells too much to read on screen.
    const speed = 1.4 / Math.sqrt(n);

    root.add(shellGroup);
    shellEntries.push({
      group: shellGroup,
      ring: ring,
      electrons: electrons,
      radius: radius,
      speed: speed,
      n: n,
      count: eCount
    });
  }

  // ── Animation state ──
  let nucPulseT = 0;
  let driftT   = 0;

  function update(dt) {
    if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
    nucPulseT += dt;
    driftT   += dt;

    // Subtle nucleus pulse (~±4%).
    if (showNucleus) nucleus.scale.setScalar(1 + Math.sin(nucPulseT * 2.2) * 0.04);

    // Advance each electron's angle and reposition. Allocation-free.
    for (let i = 0; i < shellEntries.length; i++) {
      const sh = shellEntries[i];
      const da = sh.speed * dt;
      for (let k = 0; k < sh.electrons.length; k++) {
        const e = sh.electrons[k];
        e.angle += da;
        e.mesh.position.set(
          Math.cos(e.angle) * sh.radius,
          0,
          Math.sin(e.angle) * sh.radius
        );
      }
    }

    // Whole-group drift on Y for a touch of life.
    root.position.y = Math.sin(driftT * 0.4) * 0.06;
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
    shells: shellEntries,
    nucleus: nucleus,
    protonCount: z,
    neutronCount: neutronCount
  };
}

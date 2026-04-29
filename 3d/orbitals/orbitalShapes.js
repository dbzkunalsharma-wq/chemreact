// orbitalShapes.js — build a [THREE.Group](http://THREE.Group) for each subshell type (s/p/d/f).
//
// Shapes are stylised, not physically accurate — designed for fast rendering
// on mid-range Android. All geometry/materials are owned by the returned
// group via group.userData._ownedGeos so the caller can dispose them.
//
// Sizes are normalised to fit within radius ~1.0 — the orbital model scales
// per shell.

const THREE = window.THREE;

const _yAxis = new THREE.Vector3(0, 1, 0);

/**
 * Build a subshell group for the given quantum letter ('s' | 'p' | 'd' | 'f').
 * Caller passes the material (typically MeshBasicMaterial with additive blend);
 * geometry is created locally and tracked for disposal.
 */
export function buildSubshellGroup(l, material) {
  const root = new THREE.Group();
  const ownedGeos = [];

  // Shared dumbbell sphere — reused by p / d / f to keep the geometry count low.
  let dumbGeo = null;
  function makeDumbbell(axis, scale = 1) {
    if (!dumbGeo) {
      dumbGeo = new THREE.SphereGeometry(0.18, 16, 12);
      ownedGeos.push(dumbGeo);
    }
    const g = new THREE.Group();
    const top = new THREE.Mesh(dumbGeo, material);
    top.scale.set(0.7, 1.4, 0.7);
    top.position.set(0, 0.5, 0);
    const bot = new THREE.Mesh(dumbGeo, material);
    bot.scale.set(0.7, 1.4, 0.7);
    bot.position.set(0, -0.5, 0);
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(_yAxis, axis.clone().normalize());
    g.quaternion.copy(q);
    if (scale !== 1) g.scale.setScalar(scale);
    g.add(top);
    g.add(bot);
    return g;
  }

  if (l === 's') {
    // Single sphere — spherically symmetric.
    const geo = new THREE.SphereGeometry(0.55, 24, 16);
    ownedGeos.push(geo);
    root.add(new THREE.Mesh(geo, material));
  } else if (l === 'p') {
    // Three perpendicular dumbbells — px, py, pz.
    root.add(makeDumbbell(new THREE.Vector3(1, 0, 0)));
    root.add(makeDumbbell(new THREE.Vector3(0, 1, 0)));
    root.add(makeDumbbell(new THREE.Vector3(0, 0, 1)));
  } else if (l === 'd') {
    // Four cloverleaf lobes in the xy plane at 45° offsets.
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      root.add(makeDumbbell(new THREE.Vector3(Math.cos(a), Math.sin(a), 0)));
    }
    // dz² ring on z (torus oriented in the xy plane).
    const ringGeo = new THREE.TorusGeometry(0.5, 0.12, 12, 36);
    ownedGeos.push(ringGeo);
    const ring = new THREE.Mesh(ringGeo, material);
    ring.rotation.x = Math.PI / 2;
    root.add(ring);
    // Small dumbbell on z (the dz² lobes).
    root.add(makeDumbbell(new THREE.Vector3(0, 0, 1), 0.7));
  } else if (l === 'f') {
    // Eight lobes — one per octant, each pointing diagonally outward.
    const corners = [
      [ 1,  1,  1], [ 1,  1, -1], [ 1, -1,  1], [ 1, -1, -1],
      [-1,  1,  1], [-1,  1, -1], [-1, -1,  1], [-1, -1, -1]
    ];
    for (const [x, y, z] of corners) {
      root.add(makeDumbbell(new THREE.Vector3(x, y, z).normalize()));
    }
  }

  root.userData._ownedGeos = ownedGeos;
  return root;
}

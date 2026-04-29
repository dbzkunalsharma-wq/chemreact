// orbitalShapes.js — geometry builders for s/p/d/f orbitals.
//
// Each builder returns a THREE.Group with one or more meshes that approximate
// the canonical electron-density lobes you see in textbooks. They are stylised
// (no real wavefunction math) — the goal is recognisable shapes that look good
// rotating, not scientific accuracy.
//
// Shared conventions:
//   - All shapes are centred at (0,0,0) and sized roughly within radius 1.0;
//     the caller scales them per shell (n drives outward radius).
//   - Materials are passed in so the caller controls colour/opacity per shell.
//   - Caller is responsible for disposal — every mesh's geometry is unique
//     so calling .traverse + dispose works as expected.

const THREE = window.THREE;

// ---------- s orbital: single sphere shell ----------
function buildS(material) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.55, 24, 16);
  g.add(new THREE.Mesh(geo, material));
  return g;
}

// ---------- p orbital: 3 perpendicular dumbbells (px, py, pz) ----------
function buildP(material) {
  const g = new THREE.Group();
  const axes = [
    [1, 0, 0],  // px
    [0, 1, 0],  // py
    [0, 0, 1]   // pz
  ];
  for (const [ax, ay, az] of axes) {
    g.add(buildDumbbell(material, ax, ay, az));
  }
  return g;
}

// ---------- d orbital: cloverleaf in xy + dz² ring ----------
function buildD(material) {
  const g = new THREE.Group();

  // 4 cloverleaf lobes in the xy plane, 45° apart.
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const lobe = buildLobe(material, 0.55);
    lobe.position.set(Math.cos(angle) * 0.55, Math.sin(angle) * 0.55, 0);
    lobe.lookAt(0, 0, 0);
    g.add(lobe);
  }

  // dz² torus + small lobe pair on z-axis.
  const ringGeo = new THREE.TorusGeometry(0.5, 0.12, 12, 36);
  const ring = new THREE.Mesh(ringGeo, material);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);

  g.add(buildDumbbell(material, 0, 0, 1, 0.85));
  return g;
}

// ---------- f orbital: 8 lobes in 8 octants (simplified) ----------
function buildF(material) {
  const g = new THREE.Group();
  const r = 0.6;
  for (let sx = -1; sx <= 1; sx += 2) {
    for (let sy = -1; sy <= 1; sy += 2) {
      for (let sz = -1; sz <= 1; sz += 2) {
        const lobe = buildLobe(material, 0.45);
        lobe.position.set(sx * r * 0.5, sy * r * 0.5, sz * r * 0.5);
        lobe.lookAt(sx * r, sy * r, sz * r);
        g.add(lobe);
      }
    }
  }
  return g;
}

// ---------- shared helpers ----------
function buildDumbbell(material, ax, ay, az, length = 1.0) {
  const grp = new THREE.Group();
  const lobeGeo = new THREE.SphereGeometry(0.32, 18, 12);
  const a = new THREE.Mesh(lobeGeo, material);
  const b = new THREE.Mesh(lobeGeo, material);
  a.scale.set(0.7, 1.4, 0.7);
  b.scale.set(0.7, 1.4, 0.7);
  // Stretch each lobe along the chosen axis.
  const dir = new THREE.Vector3(ax, ay, az).normalize();
  a.position.copy(dir.clone().multiplyScalar(length * 0.45));
  b.position.copy(dir.clone().multiplyScalar(-length * 0.45));
  // Orient stretched-Y to point along axis.
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
  a.quaternion.copy(q);
  b.quaternion.copy(q);
  grp.add(a, b);
  return grp;
}

function buildLobe(material, size) {
  const geo = new THREE.SphereGeometry(size, 16, 12);
  const m = new THREE.Mesh(geo, material);
  m.scale.set(0.55, 1.0, 0.55);
  return m;
}

const BUILDERS = { s: buildS, p: buildP, d: buildD, f: buildF };

export function buildSubshellGroup(l, material) {
  const fn = BUILDERS[l];
  return fn ? fn(material) : new THREE.Group();
}

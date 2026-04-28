// spark.js — occasional electric crackle drawn as a short LineSegments path between two
// random atom pairs. "electric" = lightning-frequent, "bright" = a bit less, default = sparse.

const THREE = window.THREE;

const MAX_SEGMENTS = 16; // segments per crackle path
const MAX_SLOTS = 4;     // up to N concurrent crackles

const PROFILES = {
  electric: { perSec: 6, life: 0.18, jitter: 0.10, color: 0x99ddff },
  bright:   { perSec: 4, life: 0.20, jitter: 0.08, color: 0xffe0a0 },
  medium:   { perSec: 2, life: 0.22, jitter: 0.06, color: 0xffffff }
};

function ensureSystem(group) {
  if (group.userData._sparkSystem) return group.userData._sparkSystem;

  const slots = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    const positions = new Float32Array(MAX_SEGMENTS * 2 * 3); // segments → 2 points each
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const line = new THREE.LineSegments(geom, mat);
    line.userData.kind = 'sparkSlot';
    line.frustumCulled = false;
    group.add(line);
    slots.push({ line, geom, mat, positions, life: 0 });
  }

  const sys = { slots, spawnAcc: 0 };
  group.userData._sparkSystem = sys;
  return sys;
}

function getAtoms(group) {
  const atoms = [];
  group.children.forEach((c) => {
    if (c.isMesh && c.userData && c.userData.kind === 'atom') atoms.push(c);
  });
  return atoms;
}

function fillCrackle(slot, a, b, jitter) {
  const arr = slot.positions;
  const ax = a.position.x, ay = a.position.y, az = a.position.z;
  const bx = b.position.x, by = b.position.y, bz = b.position.z;

  let prevX = ax, prevY = ay, prevZ = az;
  for (let s = 0; s < MAX_SEGMENTS; s++) {
    const t1 = (s + 1) / MAX_SEGMENTS;
    const lx = ax + (bx - ax) * t1;
    const ly = ay + (by - ay) * t1;
    const lz = az + (bz - az) * t1;
    const jx = (s === MAX_SEGMENTS - 1) ? 0 : (Math.random() - 0.5) * jitter;
    const jy = (s === MAX_SEGMENTS - 1) ? 0 : (Math.random() - 0.5) * jitter;
    const jz = (s === MAX_SEGMENTS - 1) ? 0 : (Math.random() - 0.5) * jitter;
    const nx = lx + jx, ny = ly + jy, nz = lz + jz;

    const i = s * 6;
    arr[i + 0] = prevX; arr[i + 1] = prevY; arr[i + 2] = prevZ;
    arr[i + 3] = nx;    arr[i + 4] = ny;    arr[i + 5] = nz;
    prevX = nx; prevY = ny; prevZ = nz;
  }
  slot.geom.attributes.position.needsUpdate = true;
}

export function spark(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const p = PROFILES[intensity] || PROFILES.medium;

  const sys = ensureSystem(group);

  // Try to spawn new crackles.
  sys.spawnAcc += dt * p.perSec;
  while (sys.spawnAcc >= 1) {
    sys.spawnAcc -= 1;
    const atoms = getAtoms(group);
    if (atoms.length < 2) break;
    const slot = sys.slots.find((s) => s.life <= 0);
    if (!slot) break;
    let i1 = Math.floor(Math.random() * atoms.length);
    let i2 = Math.floor(Math.random() * atoms.length);
    if (i2 === i1) i2 = (i1 + 1) % atoms.length;
    fillCrackle(slot, atoms[i1], atoms[i2], p.jitter);
    slot.mat.color.setHex(p.color);
    slot.life = p.life;
    slot.totalLife = p.life;
    slot.mat.opacity = 1;
  }

  // Age slots.
  sys.slots.forEach((s) => {
    if (s.life > 0) {
      s.life -= dt;
      if (s.life <= 0) {
        s.life = 0;
        s.mat.opacity = 0;
      } else {
        s.mat.opacity = s.life / s.totalLife;
      }
    }
  });
}

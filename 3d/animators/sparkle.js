// sparkle.js — small THREE.Points sparkles spawn near atom edges (or bonds) and fade out.
// We attach a sparkle system to the group on first call and keep recycling particles.

const THREE = window.THREE;

const MAX_PARTICLES = 80;

const PROFILES = {
  edges:  { spawnPerSec: 30, life: 1.1, size: 0.06, near: 'bond' },
  medium: { spawnPerSec: 18, life: 1.0, size: 0.05, near: 'atom' },
  bright: { spawnPerSec: 35, life: 1.2, size: 0.07, near: 'atom' }
};

function ensureSystem(group) {
  if (group.userData._sparkleSystem) return group.userData._sparkleSystem;

  const positions = new Float32Array(MAX_PARTICLES * 3);
  const alphas = new Float32Array(MAX_PARTICLES);
  const lifeRemaining = new Float32Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) lifeRemaining[i] = 0;

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });

  const points = new THREE.Points(geom, mat);
  points.userData.kind = 'sparkleSystem';
  group.add(points);

  const sys = { points, geom, mat, positions, alphas, lifeRemaining, spawnAcc: 0 };
  group.userData._sparkleSystem = sys;
  return sys;
}

function pickSpawnPos(group, target, mode) {
  // Pick a random atom mesh; bias to edges by offsetting along a random unit vector by atom radius.
  const atoms = [];
  group.children.forEach((c) => {
    if (c.isMesh && c.userData && c.userData.kind === 'atom') atoms.push(c);
  });
  if (atoms.length === 0) {
    target.set(0, 0, 0);
    return;
  }
  const pick = atoms[Math.floor(Math.random() * atoms.length)];
  const r = pick.userData.radius || 0.4;
  const u = Math.random() * 2 - 1;
  const a = Math.random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  const dx = s * Math.cos(a);
  const dy = s * Math.sin(a);
  const dz = u;
  // edges = on surface; atom = around surface
  const surfaceR = mode === 'bond' ? r * 1.05 : r * 1.0;
  target.set(
    pick.position.x + dx * surfaceR,
    pick.position.y + dy * surfaceR,
    pick.position.z + dz * surfaceR
  );
}

const _tmp = window.THREE ? new window.THREE.Vector3() : null;

export function sparkle(group, dt, opts = {}) {
  if (!group) return;
  const intensity = opts.intensity || 'medium';
  const p = PROFILES[intensity] || PROFILES.medium;

  const sys = ensureSystem(group);
  sys.mat.size = p.size;

  // Spawn budget for this frame.
  sys.spawnAcc += dt * p.spawnPerSec;
  const toSpawn = Math.floor(sys.spawnAcc);
  sys.spawnAcc -= toSpawn;

  let spawned = 0;
  for (let i = 0; i < MAX_PARTICLES && spawned < toSpawn; i++) {
    if (sys.lifeRemaining[i] <= 0) {
      pickSpawnPos(group, _tmp, p.near);
      sys.positions[i * 3 + 0] = _tmp.x;
      sys.positions[i * 3 + 1] = _tmp.y;
      sys.positions[i * 3 + 2] = _tmp.z;
      sys.lifeRemaining[i] = p.life;
      spawned++;
    }
  }

  // Age all particles; collapse dead ones to origin (their alpha is zero so they're invisible).
  let anyAlive = false;
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (sys.lifeRemaining[i] > 0) {
      sys.lifeRemaining[i] -= dt;
      if (sys.lifeRemaining[i] <= 0) {
        sys.positions[i * 3 + 0] = 0;
        sys.positions[i * 3 + 1] = 0;
        sys.positions[i * 3 + 2] = 0;
      } else {
        anyAlive = true;
      }
    }
  }

  // Average alpha approximated via material opacity from active count.
  let active = 0;
  for (let i = 0; i < MAX_PARTICLES; i++) if (sys.lifeRemaining[i] > 0) active++;
  sys.mat.opacity = active > 0 ? Math.min(1, 0.4 + active / MAX_PARTICLES) : 0;

  sys.geom.attributes.position.needsUpdate = true;
}

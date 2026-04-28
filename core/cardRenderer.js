// cardRenderer.js — multi-target Three.js renderer for AR card overlays.
//
// One canvas, one scene, one camera, one RAF loop — but many cards. Each card
// (target) is its own THREE.Group whose world matrix is driven directly from
// per-frame transforms emitted by an ARTransformProvider. On top of that
// "card transform" we lift the molecule a fixed amount so it floats above the
// printed surface, and lazily attach a particle effect underneath.
//
// API:
//   const r = new CardRenderer({ canvas, transformProvider, moleculesData,
//                                elementsData, compoundsData, reactionsData });
//   r.setMoleculeForTarget(targetId, formulaId);
//   r.setEffectForTarget(targetId, effectName);
//   r.start(); r.stop(); r.dispose(); r.resize(w?, h?);
//
// Multi-card strategy:
//   - One Map<targetId, { group, molecule, effect, animators, baseScale }>
//   - onTargetFound  → create empty group, add to scene
//   - onMatrixUpdate → group.matrix.fromArray(matrix); group.matrixAutoUpdate=false
//   - onTargetLost   → dispose group + remove from scene
//   - One global RAF loop ticks every group's animators + every effect
//
// Anchoring:
//   - Each card group is the card-anchor in world space.
//   - The molecule is added to a child group offset by FLOAT_HEIGHT on +Y so
//     it appears to float ~0.6 units above the card surface.
//   - Effect is also added under the float-anchor (it rises from there).

const THREE = window.THREE;

import { pickMaterial, createMaterial } from '../3d/materialFactory.js';
import * as Animators from '../3d/animators/index.js';
import { spawnEffect } from '../3d/effects/index.js';

const ATOM_RADIUS = { H: 0.30, DEFAULT: 0.45 };
const NON_ANIMATOR_TOKENS = new Set(['heavy']);

const FLOAT_HEIGHT = 1.0;       // how far above the card the molecule sits
const MOLECULE_TARGET_SIZE = 1.2; // bounding-box max dim, in world units
const EFFECT_INTENSITY = 0.85;
const SHADOW_RADIUS = 0.7;
const SHADOW_BASE_OPACITY = 0.35;
const HALO_RADIUS = 0.7;
const HALO_TUBE = 0.02;

export class CardRenderer {
  constructor({ canvas, transformProvider, moleculesData, elementsData, compoundsData, reactionsData, showHalo = true }) {
    if (!canvas) throw new Error('CardRenderer: canvas is required');
    if (!transformProvider) throw new Error('CardRenderer: transformProvider is required');
    if (!moleculesData || !elementsData) throw new Error('CardRenderer: moleculesData and elementsData are required');

    this.canvas = canvas;
    this.transformProvider = transformProvider;
    this._showHalo = showHalo;
    this._data = {
      molecules: moleculesData,
      elements:  elementsData,
      compounds: compoundsData || {},
      reactions: reactionsData || null
    };

    // Scene + camera + renderer.
    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent — DOM behind shows through

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1); // looks down -Z

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setClearColor(0x000000, 0);

    this._setupLights();

    // Per-target state.
    // Map<targetId, { group, floatAnchor, molecule, effect, animators, formulaId, effectName }>
    this._cards = new Map();

    // Bond material is shared across cards (cheap & uniform).
    this._bondMat = new THREE.MeshStandardMaterial({
      color: 0xbbbbbb,
      metalness: 0.4,
      roughness: 0.5
    });

    // RAF loop bookkeeping.
    this.clock = new THREE.Clock();
    this._running = false;
    this._rafId = null;
    this._loop = this._loop.bind(this);

    // Subscribe to transform provider.
    this._unsubFound  = transformProvider.onTargetFound(({ targetId, matrix }) => this._handleFound(targetId, matrix));
    this._unsubLost   = transformProvider.onTargetLost(({ targetId })          => this._handleLost(targetId));
    this._unsubUpdate = transformProvider.onMatrixUpdate(({ targetId, matrix }) => this._handleUpdate(targetId, matrix));

    // Initial size sync (caller may resize again once layout settles).
    this.resize();
  }

  // ── public API ────────────────────────────────────────────────────────────

  /** Build (or rebuild) the molecule for a given target. */
  setMoleculeForTarget(targetId, formulaId) {
    const card = this._cards.get(targetId);
    if (!card) {
      console.warn('[CardRenderer] setMoleculeForTarget: unknown target', targetId);
      return;
    }
    if (card.formulaId === formulaId && card.molecule) return; // no-op
    this._disposeMolecule(card);
    const mol = this._data.molecules[formulaId];
    if (!mol) {
      console.warn('[CardRenderer] unknown molecule', formulaId);
      return;
    }
    const group = new THREE.Group();
    const atomMeshes = this._buildAtoms(group, mol);
    this._buildBonds(group, mol, atomMeshes);
    this._centerAndScale(group);

    card.molecule = group;
    card.formulaId = formulaId;
    card.floatAnchor.add(group);

    // Animators: from compounds first, then elements, default to slow rotate.
    const profileSrc = (this._data.compounds[formulaId] && this._data.compounds[formulaId].animationProfile)
      || (this._data.elements[formulaId] && this._data.elements[formulaId].animationProfile)
      || ['rotate:medium'];
    card.animators = this._parseAnimationProfile(profileSrc);
  }

  /** Lazily create + attach a named effect under the molecule. */
  setEffectForTarget(targetId, effectName) {
    const card = this._cards.get(targetId);
    if (!card) {
      console.warn('[CardRenderer] setEffectForTarget: unknown target', targetId);
      return;
    }
    if (card.effectName === effectName && card.effect) return;
    this._disposeEffect(card);
    if (!effectName) return; // explicit removal

    const fx = spawnEffect(effectName, {
      intensity: EFFECT_INTENSITY,
      scale: 0.9,
      position: [0, -0.35, 0] // sit just under the floating molecule
    });
    if (!fx) return;
    card.effect = fx;
    card.effectName = effectName;
    card.floatAnchor.add(fx.group);
  }

  start() {
    if (this._running) return;
    this._running = true;
    this.clock.start();
    this._rafId = requestAnimationFrame(this._loop);
  }

  stop() {
    this._running = false;
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  /** Update WebGL backbuffer + camera aspect to match canvas CSS size. */
  resize(width, height) {
    const w = width  || this.canvas.clientWidth  || this.canvas.width  || 1;
    const h = height || this.canvas.clientHeight || this.canvas.height || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Tear down everything: stop loop, dispose all cards, dispose renderer. */
  dispose() {
    this.stop();
    if (this._unsubFound)  this._unsubFound();
    if (this._unsubLost)   this._unsubLost();
    if (this._unsubUpdate) this._unsubUpdate();
    for (const id of Array.from(this._cards.keys())) this._handleLost(id);
    if (this._bondMat) this._bondMat.dispose();
    this.renderer.dispose();
  }

  /** Test helper / debug surface. */
  getTargetIds() {
    return Array.from(this._cards.keys());
  }

  // ── transform-provider event handlers ─────────────────────────────────────

  _handleFound(targetId, matrix) {
    if (this._cards.has(targetId)) return; // already tracking — treat duplicate as no-op
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    if (matrix) {
      group.matrix.fromArray(matrix);
      group.updateMatrixWorld(true);
    }
    // Float anchor: the molecule + effect live here, lifted above the card surface.
    const floatAnchor = new THREE.Group();
    floatAnchor.position.set(0, FLOAT_HEIGHT, 0);
    group.add(floatAnchor);

    // Soft drop-shadow: a flat circle on the card surface (child of group, not
    // floatAnchor) so it stays put when the molecule bobs. Scaled per-frame
    // so it shrinks as the molecule rises — mimicking real-world distance.
    const shadowGeom = new THREE.CircleGeometry(SHADOW_RADIUS, 32);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: SHADOW_BASE_OPACITY,
      depthWrite: false
    });
    const shadow = new THREE.Mesh(shadowGeom, shadowMat);
    shadow.rotation.x = -Math.PI / 2; // lay flat in XZ plane
    shadow.position.set(0, 0.02, 0);  // sit just above card surface
    group.add(shadow);

    // Optional accent halo ring at the molecule's base — visually grounds it.
    let halo = null;
    if (this._showHalo) {
      const haloGeom = new THREE.TorusGeometry(HALO_RADIUS, HALO_TUBE, 8, 48);
      const haloMat = new THREE.MeshBasicMaterial({
        color: 0x00E5CC,
        transparent: true,
        opacity: 0.4,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      halo = new THREE.Mesh(haloGeom, haloMat);
      halo.rotation.x = -Math.PI / 2; // flat ring
      halo.position.set(0, -0.45, 0); // base of float anchor (just under molecule)
      floatAnchor.add(halo);
    }

    const card = {
      targetId,
      group,
      floatAnchor,
      shadow,
      halo,
      molecule: null,
      effect: null,
      animators: [],
      formulaId: null,
      effectName: null,
      bobPhase: Math.random() * Math.PI * 2
    };
    this._cards.set(targetId, card);
    this.scene.add(group);
  }

  _handleLost(targetId) {
    const card = this._cards.get(targetId);
    if (!card) return;
    this._disposeMolecule(card);
    this._disposeEffect(card);
    if (card.shadow) {
      if (card.shadow.geometry) card.shadow.geometry.dispose();
      if (card.shadow.material) card.shadow.material.dispose();
      if (card.shadow.parent) card.shadow.parent.remove(card.shadow);
    }
    if (card.halo) {
      if (card.halo.geometry) card.halo.geometry.dispose();
      if (card.halo.material) card.halo.material.dispose();
      if (card.halo.parent) card.halo.parent.remove(card.halo);
    }
    this.scene.remove(card.group);
    this._cards.delete(targetId);
  }

  _handleUpdate(targetId, matrix) {
    const card = this._cards.get(targetId);
    if (!card) return;
    card.group.matrix.fromArray(matrix);
    card.group.updateMatrixWorld(true);
  }

  // ── molecule construction (mirrors moleculeRenderer.js) ───────────────────

  _buildAtoms(group, mol) {
    const meshes = [];
    for (let i = 0; i < mol.atoms.length; i++) {
      const a = mol.atoms[i];
      const elementRecord = this._data.elements[a.el] || {};
      const radius = a.el === 'H' ? ATOM_RADIUS.H : ATOM_RADIUS.DEFAULT;

      const matName = pickMaterial(elementRecord, 'glass');
      const mat = createMaterial(matName, elementRecord.cpkColor || '#cccccc');

      const geom = new THREE.SphereGeometry(radius, 24, 18);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(a.x, a.y, a.z);
      mesh.userData = { kind: 'atom', element: a.el, radius };
      group.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  _buildBonds(group, mol, atomMeshes) {
    if (!mol.bonds || mol.bonds.length === 0) return;
    for (const bond of mol.bonds) {
      const a = atomMeshes[bond.a];
      const b = atomMeshes[bond.b];
      if (!a || !b) continue;
      const order = bond.order || 1;

      const start = a.position;
      const end   = b.position;
      const axis  = new THREE.Vector3().subVectors(end, start);
      const length = axis.length();
      if (length < 1e-4) continue;

      const dir = axis.clone().normalize();
      let perp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(perp)) > 0.95) perp = new THREE.Vector3(1, 0, 0);
      perp = perp.clone().sub(dir.clone().multiplyScalar(perp.dot(dir))).normalize();

      const gap = 0.08;
      for (let i = 0; i < order; i++) {
        const offset = (i - (order - 1) / 2) * gap;
        const off = perp.clone().multiplyScalar(offset);
        const radius = order > 1 ? 0.06 : 0.08;
        const cylGeom = new THREE.CylinderGeometry(radius, radius, length, 14, 1);
        const cyl = new THREE.Mesh(cylGeom, this._bondMat);

        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5).add(off);
        cyl.position.copy(mid);
        const up = new THREE.Vector3(0, 1, 0);
        const quat = new THREE.Quaternion().setFromUnitVectors(up, dir);
        cyl.quaternion.copy(quat);
        cyl.userData = { kind: 'bond' };
        group.add(cyl);
      }
    }
  }

  _centerAndScale(group) {
    const box = new THREE.Box3().setFromObject(group);
    if (!isFinite(box.min.x)) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    group.children.forEach((c) => {
      if (c.isMesh && c.userData && (c.userData.kind === 'atom' || c.userData.kind === 'bond')) {
        c.position.sub(center);
      }
    });
    group.children.forEach((c) => {
      if (c.userData && c.userData.homePos) c.userData.homePos.copy(c.position);
    });
    const box2 = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box2.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = MOLECULE_TARGET_SIZE / maxDim;
    group.scale.setScalar(scale);
    group.userData._baseScale = group.scale.clone();
    group.userData._driftBaseY = group.position.y;
  }

  _parseAnimationProfile(profile) {
    const out = [];
    for (const entry of profile) {
      if (typeof entry !== 'string') continue;
      const [name, intensity] = entry.split(':');
      if (!name) continue;
      if (NON_ANIMATOR_TOKENS.has(name)) continue;
      const fn = Animators[name];
      if (typeof fn !== 'function') continue;
      out.push({ fn, opts: { intensity: intensity || undefined } });
    }
    return out;
  }

  // ── lights, RAF, dispose ──────────────────────────────────────────────────

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.55);
    this.scene.add(hemi);
    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(1, 1, 1);
    this.scene.add(dir);
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);
  }

  _loop() {
    if (!this._running) return;
    const dt = Math.min(0.05, this.clock.getDelta()); // clamp after tab-out
    const t  = this.clock.getElapsedTime();
    for (const card of this._cards.values()) {
      // Per-card bob + sway on the float anchor — gives the floating molecule
      // the subtle organic motion that sells the "above the card" illusion.
      const phase = card.bobPhase + t;
      const bobY  = Math.sin(phase * 1.2) * 0.08;
      card.floatAnchor.position.y = FLOAT_HEIGHT + bobY;
      card.floatAnchor.rotation.x = Math.sin(phase * 0.7) * 0.08;
      card.floatAnchor.rotation.z = Math.sin(phase * 0.5) * 0.05;

      // Shadow scales/fades inversely with bob — fakes parallax distance.
      if (card.shadow) {
        const shadowScale = 1.0 - bobY * 0.5;
        card.shadow.scale.setScalar(shadowScale);
        card.shadow.material.opacity = SHADOW_BASE_OPACITY * shadowScale;
      }

      // Halo slow rotation.
      if (card.halo) {
        card.halo.rotation.z += dt * 0.6;
      }

      // Animate the molecule subgroup.
      if (card.molecule && card.animators.length) {
        for (const a of card.animators) {
          try { a.fn(card.molecule, dt, a.opts); }
          catch (e) { console.warn('[CardRenderer] animator error:', e); }
        }
      }
      // Tick effect.
      if (card.effect) {
        try { card.effect.update(dt); }
        catch (e) { console.warn('[CardRenderer] effect update error:', e); }
      }
    }
    this.renderer.render(this.scene, this.camera);
    this._rafId = requestAnimationFrame(this._loop);
  }

  _disposeMolecule(card) {
    if (!card.molecule) return;
    card.molecule.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material && obj.material !== this._bondMat) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (card.molecule.parent) card.molecule.parent.remove(card.molecule);
    card.molecule = null;
    card.formulaId = null;
    card.animators = [];
  }

  _disposeEffect(card) {
    if (!card.effect) return;
    try { card.effect.dispose(); } catch (e) { console.warn('[CardRenderer] effect dispose error', e); }
    if (card.effect.group && card.effect.group.parent) {
      card.effect.group.parent.remove(card.effect.group);
    }
    card.effect = null;
    card.effectName = null;
  }
}

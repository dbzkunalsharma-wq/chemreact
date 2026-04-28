// moleculeRenderer.js — main 3D engine for ChemReact molecules.
//
// Builds a THREE.Group from a molecule definition (atoms + bonds), centers and scales it
// to fit the camera, and runs animator functions every frame based on the molecule's
// animationProfile.

const THREE = window.THREE;

import { pickMaterial, createMaterial } from '../3d/materialFactory.js';
import * as Animators from '../3d/animators/index.js';
import { spawnEffect } from '../3d/effects/index.js';

const ATOM_RADIUS = {
  H: 0.30,
  DEFAULT: 0.45
};

// animator-profile tokens like "heavy:true" don't map to an animator — silently ignore them.
const NON_ANIMATOR_TOKENS = new Set(['heavy']);

export class MoleculeRenderer {
  constructor({ canvas, materialName = 'glass', effectName = null } = {}) {
    if (!canvas) throw new Error('MoleculeRenderer: canvas is required');
    this.canvas = canvas;
    this.materialName = materialName;
    this.effectName = effectName;
    this._effect = null;

    this.scene = new THREE.Scene();
    this.scene.background = null; // transparent

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);

    this._setupLights();

    this.group = null;
    this.activeAnimators = []; // [{fn, opts}]
    this.clock = new THREE.Clock();
    this._running = false;
    this._rafId = null;
    this._loop = this._loop.bind(this);

    this._data = null; // {elements, compounds, molecules}
    this._dataPromise = this._loadData();

    this._currentFormulaId = null;

    this._handleResize = this._handleResize.bind(this);
    // Initial size sync (may be 0 if canvas isn't laid out yet — viewer will trigger resize).
    this._handleResize();
  }

  _setupLights() {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 0.55);
    this.scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.9);
    dir.position.set(3, 5, 4);
    this.scene.add(dir);

    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);
  }

  async _loadData() {
    if (this._data) return this._data;
    const base = this._dataBase();
    const [elements, compounds, molecules] = await Promise.all([
      fetch(base + 'elements.json').then((r) => r.json()),
      fetch(base + 'compounds.json').then((r) => r.json()),
      fetch(base + 'molecules.json').then((r) => r.json())
    ]);
    this._data = { elements, compounds, molecules };
    return this._data;
  }

  _dataBase() {
    // Resolve relative to the document so it works whether the page is at /, /screens/, etc.
    try {
      return new URL('../data/', import.meta.url).href;
    } catch (e) {
      return './data/';
    }
  }

  /** Render (build) a molecule by formula id (e.g. "H2O", "Fe", "CH4"). */
  async render(formulaId) {
    await this._dataPromise;
    this._currentFormulaId = formulaId;
    this._disposeGroup();

    const mol = this._data.molecules[formulaId];
    if (!mol) {
      console.warn(`[MoleculeRenderer] Unknown molecule "${formulaId}".`);
      return;
    }

    const group = new THREE.Group();
    this.group = group;
    this.scene.add(group);

    const atomMeshes = this._buildAtoms(group, mol);
    this._buildBonds(group, mol, atomMeshes);

    this._centerAndScale(group);
    this._setupCameraDistance(group);

    // Read animation profile from compounds first, fall back to elements (single-atom case).
    const profileSrc = (this._data.compounds[formulaId] && this._data.compounds[formulaId].animationProfile)
      || (this._data.elements[formulaId] && this._data.elements[formulaId].animationProfile)
      || ['rotate:medium'];
    this.activeAnimators = this._parseAnimationProfile(profileSrc);

    // Spawn the reaction effect (water-ripple under H2O, flame under CH4, etc.) if requested.
    this._spawnEffect();

    if (!this._running) this.start();
  }

  _spawnEffect() {
    // Dispose any prior effect.
    if (this._effect) {
      try { this._effect.dispose(); } catch (_e) {}
      this._effect = null;
    }
    if (!this.effectName) return;
    try {
      const fx = spawnEffect(this.effectName, {
        intensity: 'medium',
        formulaId: this._currentFormulaId  // lets cymatic-bloom pick per-compound palette
      });
      if (fx && fx.group) {
        // Position effect just below the molecule (the molecule sits centered at origin
        // after _centerAndScale; the camera frames around y=0).
        fx.group.position.set(0, -1.2, 0);
        this.scene.add(fx.group);
        this._effect = fx;
      }
    } catch (e) {
      console.warn('[MoleculeRenderer] effect spawn failed:', e);
    }
  }

  setEffect(name) {
    this.effectName = name || null;
    this._spawnEffect();
  }

  _buildAtoms(group, mol) {
    const meshes = [];
    for (let i = 0; i < mol.atoms.length; i++) {
      const a = mol.atoms[i];
      const elementRecord = this._data.elements[a.el] || {};
      const radius = a.el === 'H' ? ATOM_RADIUS.H : ATOM_RADIUS.DEFAULT;

      const matName = this.materialName === 'auto'
        ? pickMaterial(elementRecord, 'glass')
        : this.materialName;
      const mat = createMaterial(matName, elementRecord.cpkColor || '#cccccc');

      const geom = new THREE.SphereGeometry(radius, 32, 24);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(a.x, a.y, a.z);
      mesh.userData = {
        kind: 'atom',
        element: a.el,
        radius
      };
      group.add(mesh);
      meshes.push(mesh);
    }
    return meshes;
  }

  _buildBonds(group, mol, atomMeshes) {
    if (!mol.bonds || mol.bonds.length === 0) return;
    const bondMat = new THREE.MeshStandardMaterial({
      color: 0xbbbbbb,
      metalness: 0.4,
      roughness: 0.5
    });

    for (const bond of mol.bonds) {
      const a = atomMeshes[bond.a];
      const b = atomMeshes[bond.b];
      if (!a || !b) continue;
      const order = bond.order || 1;

      // For multi-bond (order>1) we offset parallel cylinders perpendicular to the bond axis.
      const start = a.position;
      const end = b.position;
      const axis = new THREE.Vector3().subVectors(end, start);
      const length = axis.length();
      if (length < 1e-4) continue;

      // Pick a perpendicular vector for offsetting parallel bonds.
      const dir = axis.clone().normalize();
      let perp = new THREE.Vector3(0, 1, 0);
      if (Math.abs(dir.dot(perp)) > 0.95) perp = new THREE.Vector3(1, 0, 0);
      perp = perp.clone().sub(dir.clone().multiplyScalar(perp.dot(dir))).normalize();

      const gap = 0.08; // separation between parallel cylinders
      for (let i = 0; i < order; i++) {
        // Distribute around center: offsets like -gap*(order-1)/2 + i*gap.
        const offset = (i - (order - 1) / 2) * gap;
        const off = perp.clone().multiplyScalar(offset);

        const radius = order > 1 ? 0.06 : 0.08;
        const cylGeom = new THREE.CylinderGeometry(radius, radius, length, 16, 1);
        const cyl = new THREE.Mesh(cylGeom, bondMat);

        // Cylinder default orientation: along Y axis. Rotate to align with bond axis.
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

    // Recenter children around origin.
    group.children.forEach((c) => {
      if (c.isMesh && c.userData && (c.userData.kind === 'atom' || c.userData.kind === 'bond')) {
        c.position.sub(center);
      }
    });

    // Refresh atom homePos so jitter/attract use the centered positions.
    group.children.forEach((c) => {
      if (c.userData) {
        if (c.userData.homePos) c.userData.homePos.copy(c.position);
      }
    });

    // Recompute box and scale to fit ~2 unit radius.
    const box2 = new THREE.Box3().setFromObject(group);
    const size = new THREE.Vector3();
    box2.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const targetSize = 2.0;
    const scale = targetSize / maxDim;
    group.scale.setScalar(scale);
    group.userData._baseScale = group.scale.clone();
    group.userData._driftBaseY = group.position.y;
  }

  _setupCameraDistance(group) {
    // Place camera so the group fills a comfortable portion of the frame.
    const box = new THREE.Box3().setFromObject(group);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const r = Math.max(0.5, sphere.radius);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = (r / Math.sin(fov / 2)) * 1.4;
    this.camera.position.set(0, 0, dist);
    this.camera.lookAt(0, 0, 0);
  }

  _parseAnimationProfile(profile) {
    const out = [];
    for (const entry of profile) {
      if (typeof entry !== 'string') continue;
      const [name, intensity] = entry.split(':');
      if (!name) continue;
      if (NON_ANIMATOR_TOKENS.has(name)) continue;
      const fn = Animators[name];
      if (typeof fn !== 'function') {
        // Unknown animator — skip silently.
        continue;
      }
      out.push({ fn, opts: { intensity: intensity || undefined } });
    }
    return out;
  }

  /** Switch the material strategy for the current molecule and re-render. */
  setMaterial(name) {
    if (!name) return;
    this.materialName = name;
    if (this._currentFormulaId) {
      // Re-render to apply new material.
      this.render(this._currentFormulaId);
    }
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

  _loop() {
    if (!this._running) return;
    const dt = Math.min(0.05, this.clock.getDelta()); // clamp to avoid huge jumps after tab-out
    if (this.group) {
      for (const a of this.activeAnimators) {
        try { a.fn(this.group, dt, a.opts); }
        catch (e) { console.warn('[MoleculeRenderer] animator error:', e); }
      }
    }
    if (this._effect && typeof this._effect.update === 'function') {
      try { this._effect.update(dt); }
      catch (e) { console.warn('[MoleculeRenderer] effect update error:', e); }
    }
    this.renderer.render(this.scene, this.camera);
    this._rafId = requestAnimationFrame(this._loop);
  }

  /** Resize the renderer to match the canvas's CSS size. */
  resize(width, height) {
    const w = width  || this.canvas.clientWidth  || this.canvas.width  || 1;
    const h = height || this.canvas.clientHeight || this.canvas.height || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _handleResize() {
    this.resize();
  }

  _disposeGroup() {
    if (!this.group) return;
    this.group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.scene.remove(this.group);
    this.group = null;
    this.activeAnimators = [];
  }

  dispose() {
    this.stop();
    this._disposeGroup();
    if (this._effect) {
      try { this._effect.dispose(); } catch (_e) {}
      this._effect = null;
    }
    this.renderer.dispose();
  }
}

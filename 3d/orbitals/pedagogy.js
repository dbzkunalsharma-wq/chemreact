/* ============================================================================
 * pedagogy.js - Pedagogical layer for ChemReact AR Bohr atoms
 * ----------------------------------------------------------------------------
 * CLASSIC <script> tag (no modules). Assigns:
 *   window.PedagogyLayer = function(scene, atom, opts) { ... }
 *
 *   atom = object returned by buildBohrAtom (reads atom.shells, .element, etc.)
 *   opts.camera = THREE.Camera (REQUIRED for HTML label projection)
 *
 * Returns { triggerElectronTransition, showEnergyLabels, pulseValenceShell,
 *           setModelMode, update, dispose }
 *
 * FOUR FEATURES (Class 11 Bohr-model pedagogy):
 *   1) triggerElectronTransition(fromIdx, toIdx, electronIdx?)
 *      Pulse + curved-arc jump + photon flash colored by Rydberg energy gap.
 *      Moves the entry between shells' electrons[] arrays atomically.
 *   2) showEnergyLabels(visible)
 *      HTML overlay cards LEFT of each ring: "n=k" + "E_k = -X.X eV". Hover
 *      reveals the -13.6 * Z_eff^2 / n^2 calculation.
 *   3) pulseValenceShell(enable)
 *      Outermost ring's emissiveIntensity + opacity oscillate via sin wave.
 *   4) setModelMode(mode)  // 'bohr' | 'qm-stylized'
 *      0.6s opacity crossfade between discrete electrons and glass cloud
 *      spheres sized to each shell radius.
 *
 * SAMPLE USAGE:
 *   const atom = buildBohrAtom(BOHR_ELEMENTS['H'], envMap);
 *   scene.add(atom.group);
 *   const pedagogy = PedagogyLayer(scene, atom, { camera });
 *   pedagogy.showEnergyLabels(true);
 *   pedagogy.pulseValenceShell(true);
 *   pedagogy.triggerElectronTransition(2, 1); // H Balmer-alpha → red photon
 *   // per-frame: pedagogy.update(dt);
 *   // on unload: pedagogy.dispose();
 *
 * LIMITATIONS:
 *   - Transition no-ops (returns false) if source shell is empty.
 *   - Bohr breaks for many-electron atoms; energy gaps come from the Slater
 *     Z_eff approximations baked into elements.js.
 *   - Photon color mapping is a teaching simplification (no fine structure).
 *   - HTML labels assume the renderer canvas fills the viewport.
 * ============================================================================
 */
(function () {
  'use strict';

  if (typeof window === 'undefined' || !window.THREE) {
    console.warn('PedagogyLayer: THREE not available on window.');
    return;
  }
  var THREE = window.THREE;

  // ─── Wavelength → CSS color (visible spectrum + UV/IR fallbacks) ──────────
  // Input may be wavelength in nm OR an energy in eV (auto-detected by range).
  // Mapping is a Class-11-friendly simplification of the visible spectrum.
  function wavelengthToColor(nmOrEV) {
    var nm = nmOrEV;
    if (nmOrEV < 50) {
      // Caller passed eV — convert via lambda(nm) = 1240 / E(eV).
      nm = 1240 / Math.max(0.001, nmOrEV);
    }
    if (nm < 380)        return '#9B4DFF'; // UV       → purple
    if (nm < 450)        return '#6A4DFF'; // violet
    if (nm < 500)        return '#4D9BFF'; // blue
    if (nm < 550)        return '#4DFF6A'; // green
    if (nm < 580)        return '#FFE94D'; // yellow
    if (nm < 650)        return '#FF9A4D'; // orange
    if (nm < 700)        return '#FF4D4D'; // red
    return '#8B2A1F';                       // IR       → deep red / brown
  }

  // ─── Smooth easing for transitions / crossfades ───────────────────────────
  function smoothstep(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    return t * t * (3 - 2 * t);
  }

  // ─── Quadratic Bezier on Vector3 (curved electron path: arc outward) ──────
  function quadBezier(out, p0, p1, p2, t) {
    var u = 1 - t;
    out.x = u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x;
    out.y = u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y;
    out.z = u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z;
    return out;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PedagogyLayer factory
  // ══════════════════════════════════════════════════════════════════════════
  window.PedagogyLayer = function (scene, atom, opts) {
    opts = opts || {};
    var camera = opts.camera || null;
    // Owned resources for dispose().
    var ownedGeos = [], ownedMats = [], ownedDivs = [];

    // Photon flash pool — 2 reusable spheres (no per-frame allocation).
    var PHOTON_POOL = [];
    var photonGeo = new THREE.SphereGeometry(0.18, 16, 12);
    ownedGeos.push(photonGeo);
    for (var pi = 0; pi < 2; pi++) {
      var pmat = new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0.0,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      ownedMats.push(pmat);
      var pmesh = new THREE.Mesh(photonGeo, pmat);
      pmesh.visible = false; atom.group.add(pmesh);
      PHOTON_POOL.push({ mesh: pmesh, mat: pmat, active: false, t: 0 });
    }

    // In-flight transitions (multiple may overlap if caller fires fast).
    var transitions = [];
    // Pre-allocated scratch vectors (avoid per-frame allocation).
    var _vA = new THREE.Vector3(), _vC = new THREE.Vector3();
    var _vMid = new THREE.Vector3(), _vProj = new THREE.Vector3();

    // ── Energy labels: HTML overlay container + one card per shell ────────────
    var labelContainer = document.createElement('div');
    labelContainer.className = 'pedagogy-label-layer';
    labelContainer.style.cssText =
      'position:fixed;inset:0;z-index:4;pointer-events:none;overflow:hidden;';
    document.body.appendChild(labelContainer);
    ownedDivs.push(labelContainer);

    // Inject minimal styles once (idempotent across instances).
    if (!document.getElementById('pedagogy-label-style')) {
      var style = document.createElement('style');
      style.id = 'pedagogy-label-style';
      style.textContent = [
        '.pedagogy-label{position:absolute;top:0;left:0;background:rgba(8,14,28,0.82);',
        'border:1px solid rgba(111,231,255,0.28);border-radius:8px;padding:5px 9px;',
        'backdrop-filter:blur(8px) saturate(140%);-webkit-backdrop-filter:blur(8px) saturate(140%);',
        'box-shadow:0 6px 20px rgba(0,0,0,0.35);font:10px/1.3 ui-monospace,Consolas,monospace;',
        'color:#E6F4FF;white-space:nowrap;pointer-events:auto;cursor:help;opacity:0;',
        'transition:opacity 0.25s ease;will-change:transform,opacity;}',
        '.pedagogy-label .pl-n{color:#6FE7FF;font-weight:600;letter-spacing:1.4px;',
        'text-transform:uppercase;font-size:9px;}',
        '.pedagogy-label .pl-e{font-size:11px;margin-top:2px;}',
        '.pedagogy-label .pl-bolt{color:#FFE94D;margin-right:3px;}',
        '.pedagogy-label .pl-calc{display:none;color:rgba(230,244,255,0.65);font-size:9px;margin-top:3px;}',
        '.pedagogy-label:hover .pl-calc{display:block;}'
      ].join('');
      document.head.appendChild(style);
    }

    var labelDivs = [];
    for (var si = 0; si < atom.shells.length; si++) {
      var sh = atom.shells[si];
      var div = document.createElement('div');
      div.className = 'pedagogy-label';
      var energy = (atom.element && atom.element.energyLevels)
        ? atom.element.energyLevels[si] : null;
      var energyStr = (energy !== null && typeof energy === 'number')
        ? energy.toFixed(2) + ' eV' : 'n/a';
      var subscript = (sh.n != null) ? String(sh.n) : String(si + 1);
      div.innerHTML =
        '<div class="pl-n">n = ' + subscript + '</div>' +
        '<div class="pl-e"><span class="pl-bolt">&#9889;</span>E<sub>' +
        subscript + '</sub> = ' + energyStr + '</div>' +
        '<div class="pl-calc">-13.6 &times; Z<sub>eff</sub>&sup2; / n&sup2;</div>';
      labelContainer.appendChild(div);
      labelDivs.push(div);
    }

    var labelsVisible = false;

    function showEnergyLabels(visible) {
      labelsVisible = !!visible;
      for (var i = 0; i < labelDivs.length; i++) {
        labelDivs[i].style.opacity = labelsVisible ? '0.95' : '0';
      }
    }

    function updateLabelPositions() {
      if (!labelsVisible || !camera) return;
      var w = window.innerWidth, h = window.innerHeight;
      for (var i = 0; i < atom.shells.length; i++) {
        var sh = atom.shells[i];
        // Anchor on LEFT side of ring; shell.group's world matrix carries all
        // ancestor transforms, so applying it once is enough.
        _vA.set(-sh.radius - 0.3, 0, 0);
        sh.group.updateWorldMatrix(true, false);
        _vA.applyMatrix4(sh.group.matrixWorld);
        _vProj.copy(_vA).project(camera);
        if (_vProj.z > 1 || _vProj.z < -1) {
          labelDivs[i].style.opacity = '0';
          continue;
        }
        var sx = (_vProj.x * 0.5 + 0.5) * w - 90;
        var sy = (_vProj.y * -0.5 + 0.5) * h - 18;
        labelDivs[i].style.transform =
          'translate3d(' + Math.round(sx) + 'px,' + Math.round(sy) + 'px,0)';
        labelDivs[i].style.opacity = '0.95';
      }
    }

    // ── Valence pulse ────────────────────────────────────────────────────────
    var valencePulseActive = false, pulseT = 0;
    var valenceRing = atom.shells.length ? atom.shells[atom.shells.length - 1].ring : null;
    var baseEmissive = valenceRing ? valenceRing.material.emissiveIntensity : 0.25;
    var baseOpacity  = valenceRing ? valenceRing.material.opacity : 0.8;

    function pulseValenceShell(enable) {
      valencePulseActive = !!enable;
      if (!enable && valenceRing) {
        valenceRing.material.emissiveIntensity = baseEmissive;
        valenceRing.material.opacity = baseOpacity;
      }
    }

    // ── QM-stylized cloud spheres (one per shell, pre-allocated) ─────────────
    var cloudSpheres = [];
    var cpkBase = (atom.element && atom.element.cpkColor) ? atom.element.cpkColor : '#5099FF';
    for (var ci = 0; ci < atom.shells.length; ci++) {
      var sh2 = atom.shells[ci];
      var cloudGeo = new THREE.SphereGeometry(sh2.radius, 32, 24);
      ownedGeos.push(cloudGeo);
      var cloudMat = new THREE.MeshPhysicalMaterial({
        color: cpkBase, metalness: 0.0, roughness: 0.18,
        transmission: 0.9, thickness: 0.6, ior: 1.3,
        clearcoat: 0.4, clearcoatRoughness: 0.4,
        emissive: cpkBase, emissiveIntensity: 0.08,
        transparent: true, opacity: 0.0,
        depthWrite: false, side: THREE.DoubleSide
      });
      ownedMats.push(cloudMat);
      var cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
      cloudMesh.visible = false;
      sh2.group.add(cloudMesh);
      cloudSpheres.push({ mesh: cloudMesh, mat: cloudMat });
    }

    // Mode crossfade state.
    var currentMode = 'bohr';
    var modeTransition = null; // { t, duration }
    var MODE_FADE = 0.6;

    function setModelMode(mode) {
      if (mode !== 'bohr' && mode !== 'qm-stylized') return;
      if (mode === currentMode) return;
      if (mode === 'qm-stylized') {
        for (var k = 0; k < cloudSpheres.length; k++) cloudSpheres[k].mesh.visible = true;
      }
      modeTransition = { t: 0, duration: MODE_FADE };
      currentMode = mode;
    }

    function applyModeFade(progress) {
      // progress 0..1 → 1 = fully in target mode.
      var qmAlpha = (currentMode === 'qm-stylized') ? progress : (1 - progress);
      for (var i = 0; i < cloudSpheres.length; i++) cloudSpheres[i].mat.opacity = qmAlpha * 0.55;
      for (var s = 0; s < atom.shells.length; s++) {
        var sh = atom.shells[s];
        for (var e = 0; e < sh.electrons.length; e++) {
          var em = sh.electrons[e].wrap.children[0];
          if (em && em.material) {
            if (!em.material.transparent) { em.material.transparent = true; em.material.needsUpdate = true; }
            em.material.opacity = 1 - qmAlpha;
          }
        }
      }
    }

    // ── Electron transition ─────────────────────────────────────────────────
    function triggerElectronTransition(fromIdx, toIdx, electronIdx) {
      if (fromIdx == null || toIdx == null || fromIdx === toIdx) return false;
      if (fromIdx < 0 || toIdx < 0 ||
          fromIdx >= atom.shells.length || toIdx >= atom.shells.length) return false;
      var src = atom.shells[fromIdx], dst = atom.shells[toIdx];
      if (!src.electrons || src.electrons.length === 0) {
        console.warn('PedagogyLayer: source shell empty (n=' + (src.n != null ? src.n : fromIdx + 1) + ').');
        return false;
      }
      var eIdx = Math.max(0, Math.min((electronIdx != null) ? electronIdx : 0, src.electrons.length - 1));
      var entry = src.electrons[eIdx];
      if (entry.inTransit) return false;
      entry.inTransit = true;

      // Compute dst-shell-local destination (next free angle on the ring).
      var dstAngle = (dst.electrons.length > 0)
        ? (dst.electrons[dst.electrons.length - 1].angle + Math.PI * 0.4) : 0;
      var endLocalDst = new THREE.Vector3(
        Math.cos(dstAngle) * dst.radius, 0, Math.sin(dstAngle) * dst.radius);
      // Snapshot world-space endpoints (stable even if shells rotate mid-transit).
      src.group.updateWorldMatrix(true, false);
      dst.group.updateWorldMatrix(true, false);
      var startWorld = entry.wrap.getWorldPosition(new THREE.Vector3());
      var endWorld = endLocalDst.clone().applyMatrix4(dst.group.matrixWorld);

      // Energy gap → photon color (lambda nm = 1240 / dE eV).
      // Prefer element-specific energyLevels[]; fall back to plain hydrogenic
      // Bohr -13.6/n^2 for excited states beyond what elements.js stores
      // (e.g. n=3 in H — used to demo Balmer-alpha → red photon).
      var photonColor = '#9B4DFF';
      var nFrom = (src.n != null) ? src.n : (fromIdx + 1);
      var nTo = (dst.n != null) ? dst.n : (toIdx + 1);
      var eFrom, eTo;
      if (atom.element && atom.element.energyLevels) {
        eFrom = atom.element.energyLevels[fromIdx];
        eTo   = atom.element.energyLevels[toIdx];
      }
      if (typeof eFrom !== 'number') eFrom = -13.6 / (nFrom * nFrom);
      if (typeof eTo   !== 'number') eTo   = -13.6 / (nTo   * nTo);
      var dE = Math.abs(eFrom - eTo);
      if (dE > 0.001) photonColor = wavelengthToColor(1240 / dE);

      transitions.push({
        entry: entry, src: src, dst: dst,
        startWorld: startWorld, endWorld: endWorld,
        endLocalDst: endLocalDst, dstAngle: dstAngle,
        t: 0, duration: 1.0,
        photonColor: photonColor, photonFired: false, moved: false,
        baseScale: entry.wrap.scale.x || 1
      });
      return true;
    }

    function updateTransitions(dt) {
      for (var ti = transitions.length - 1; ti >= 0; ti--) {
        var tr = transitions[ti];
        tr.t += dt;
        var u = Math.min(1, tr.t / tr.duration);
        var entry = tr.entry;

        if (u < 0.15) {
          // A: pulse brighter (scale +20%).
          var s = tr.baseScale * (1 + 0.20 * smoothstep(u / 0.15));
          entry.wrap.scale.setScalar(s);
        } else if (u < 0.70) {
          // B: curved arc in WORLD space → convert to atom-local.
          var eased = smoothstep((u - 0.15) / 0.55);
          _vMid.copy(tr.startWorld).add(tr.endWorld).multiplyScalar(0.5);
          _vMid.y += 0.45 * Math.max(tr.src.radius, tr.dst.radius);
          quadBezier(_vA, tr.startWorld, _vMid, tr.endWorld, eased);
          atom.group.updateWorldMatrix(true, false);
          if (!tr.moved) { atom.group.attach(entry.wrap); tr.moved = true; }
          atom.group.worldToLocal(_vA);
          entry.wrap.position.copy(_vA);
          entry.wrap.scale.setScalar(tr.baseScale * 1.10);
        } else if (u < 0.85) {
          // C: photon flash at destination, snap electron into dst shell.
          if (!tr.photonFired) {
            firePhoton(tr.endWorld, tr.photonColor);
            tr.photonFired = true;
            tr.dst.group.attach(entry.wrap);
            entry.wrap.position.copy(tr.endLocalDst);
          }
          var flashU = (u - 0.70) / 0.15;
          entry.wrap.scale.setScalar(tr.baseScale * (1 + 0.15 * (1 - flashU)));
        } else {
          // D: resume normal orbit on new shell.
          var resumeU = (u - 0.85) / 0.15;
          entry.wrap.scale.setScalar(
            tr.baseScale * (1 + 0.15 * (1 - smoothstep(resumeU)))
          );
        }

        if (u >= 1) {
          // Finalize: move entry between shells' electrons[] and clear flag.
          entry.wrap.scale.setScalar(tr.baseScale);
          entry.angle = tr.dstAngle;
          entry.inTransit = false;
          var idx = tr.src.electrons.indexOf(entry);
          if (idx !== -1) tr.src.electrons.splice(idx, 1);
          tr.dst.electrons.push(entry);
          transitions.splice(ti, 1);
        }
      }
    }

    function firePhoton(worldPos, colorHex) {
      var slot = null;
      for (var i = 0; i < PHOTON_POOL.length; i++) if (!PHOTON_POOL[i].active) { slot = PHOTON_POOL[i]; break; }
      if (!slot) slot = PHOTON_POOL[0]; // oldest if all busy
      slot.active = true; slot.t = 0;
      slot.mat.color.set(colorHex); slot.mat.opacity = 0;
      slot.mesh.visible = true; slot.mesh.scale.setScalar(0.001);
      // Position in atom-local space (atom.group may be transformed by AR anchor).
      _vC.copy(worldPos);
      atom.group.updateWorldMatrix(true, false);
      atom.group.worldToLocal(_vC);
      slot.mesh.position.copy(_vC);
    }

    function updatePhotons(dt) {
      for (var i = 0; i < PHOTON_POOL.length; i++) {
        var p = PHOTON_POOL[i];
        if (!p.active) continue;
        p.t += dt;
        var u = p.t / 0.30; // ~300ms lifetime
        if (u >= 1) { p.active = false; p.mesh.visible = false; p.mat.opacity = 0; continue; }
        // Scale 0 → 1.5 → 0; opacity 0 → 0.95 → 0.
        var sc = (u < 0.5) ? (u / 0.5) * 1.5 : (1 - (u - 0.5) / 0.5) * 1.5;
        p.mesh.scale.setScalar(Math.max(0.001, sc));
        p.mat.opacity = (u < 0.3) ? (u / 0.3) * 0.95 : (1 - (u - 0.3) / 0.7) * 0.95;
      }
    }

    // ── Main update tick ─────────────────────────────────────────────────────
    function update(dt) {
      if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
      pulseT += dt;
      // Valence pulse.
      if (valencePulseActive && valenceRing) {
        var factor = (Math.sin(pulseT * 4) + 1) * 0.5; // 0..1, ~1.5s period
        valenceRing.material.emissiveIntensity = baseEmissive + factor * 0.6;
        valenceRing.material.opacity = baseOpacity + factor * 0.18;
      }
      // Mode crossfade.
      if (modeTransition) {
        modeTransition.t += dt;
        var mu = Math.min(1, modeTransition.t / modeTransition.duration);
        applyModeFade(smoothstep(mu));
        if (mu >= 1) {
          if (currentMode === 'bohr') {
            for (var k = 0; k < cloudSpheres.length; k++) cloudSpheres[k].mesh.visible = false;
          }
          modeTransition = null;
        }
      }
      if (transitions.length > 0) updateTransitions(dt);
      updatePhotons(dt);
      if (labelsVisible) updateLabelPositions();
    }

    // ── Cleanup ──────────────────────────────────────────────────────────────
    function dispose() {
      for (var i = 0; i < ownedGeos.length; i++) try { ownedGeos[i].dispose(); } catch (_) {}
      for (var j = 0; j < ownedMats.length; j++) try { ownedMats[j].dispose(); } catch (_) {}
      for (var d = 0; d < ownedDivs.length; d++) {
        try { if (ownedDivs[d].parentNode) ownedDivs[d].parentNode.removeChild(ownedDivs[d]); } catch (_) {}
      }
      for (var p = 0; p < PHOTON_POOL.length; p++) {
        var pm = PHOTON_POOL[p].mesh; if (pm.parent) pm.parent.remove(pm);
      }
      for (var c = 0; c < cloudSpheres.length; c++) {
        var cm = cloudSpheres[c].mesh; if (cm.parent) cm.parent.remove(cm);
      }
      transitions.length = 0;
    }

    return {
      triggerElectronTransition: triggerElectronTransition,
      showEnergyLabels: showEnergyLabels,
      pulseValenceShell: pulseValenceShell,
      setModelMode: setModelMode,
      update: update,
      dispose: dispose,
      // Exposed for tests / debug.
      _wavelengthToColor: wavelengthToColor
    };
  };

  // Also expose helpers on the namespace for debugging.
  window.PedagogyLayer.wavelengthToColor = wavelengthToColor;
})();

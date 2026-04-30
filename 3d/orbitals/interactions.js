/* ════════════════════════════════════════════════════════════════════════
 * interactions.js — gestural input layer for buildBohrAtom
 * ────────────────────────────────────────────────────────────────────────
 * Mounts atop an atom from `window.buildBohrAtom(...)`. Four interactions:
 *
 *   1. TAP SPHERE → info popup (reused `.float-label` div, 3s auto-dismiss).
 *      Raycasts the scene; the picked mesh's userData.kind disambiguates
 *      proton / neutron / electron / shell ring / shell label. Subscribers
 *      via `onTapSphere(fn)` receive the {kind, label, subtitle, detail}.
 *
 *   2. TAP CARD → ionize. Mesh tagged `userData.kind === 'card'` (or passed
 *      via `opts.cardObject`). Calls `atom.setIonized(current + 1)`, runs a
 *      brief scale-pulse flash, fires an "N+ ion formed" toast. Restoration
 *      is host's job: call `atom.setIonized(0)`.
 *
 *   3. LONG-PRESS → explode (>600ms, <8px move). Particles get random
 *      outward velocity (4-8 u/s); 1.5s drift with gentle pull-back, then
 *      0.4s cubic ease-in snap to nominal position. Host MUST skip
 *      `atom.update(dt)` while `I.isExploding` is true.
 *
 *   4. PINCH / WHEEL → zoom. cameraDistance ∈ [minZoom, maxZoom] (4..18
 *      default). Host reads `I.getCameraDistance()` in its camera placement
 *      loop; `setZoomBounds(min,max)` re-tunes (e.g. for QM mode).
 *
 * ── Host integration ──
 *   const I = window.attachInteractions(canvas, atom, scene, camera, {
 *     cardObject: cardMesh, minZoom: 4, maxZoom: 18, initialDistance: 9.5
 *   });
 *   I.onTapSphere(info => { ... });
 *   // Per frame:  camera.position.normalize().multiplyScalar(I.getCameraDistance());
 *   //             if (!I.isExploding) atom.update(dt);
 *   //             I.update(dt);
 *   // Unmount: I.dispose();
 *
 * ── Browser quirks ──
 *   • Pointer Events only (iOS Safari 13+, all evergreen). `touch-action:
 *     none` on canvas prevents pinch-to-zoom hijack.
 *   • Two pointers = pinch; a third pointer cancels until ≤1 remain.
 *
 * Classic <script>-loadable; assigns to window.attachInteractions. No modules.
 * ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (!global.THREE) {
    console.error('[interactions] THREE not found — load three.min.js first.');
    return;
  }
  var THREE = global.THREE;

  var SHELL_MAX = { K: 2, L: 8, M: 18, N: 32, O: 32, P: 18, Q: 8 };
  function buildElectronInfo(shellName, n) {
    var max = SHELL_MAX[shellName] || (2 * n * n);
    return {
      kind: 'electron', shellName: shellName, n: n,
      label: 'Electron in ' + shellName + ' shell',
      subtitle: 'n=' + n + ', max ' + max + ' e⁻',
      detail: 'Charge −1, mass ≈ 1/1836 of a proton'
    };
  }
  var INFO_PROTON  = { kind: 'proton',  label: 'Proton',
                       subtitle: 'Charge +1, mass 1.007 u', detail: 'Found in the nucleus' };
  var INFO_NEUTRON = { kind: 'neutron', label: 'Neutron',
                       subtitle: 'Charge 0, mass 1.009 u',  detail: 'Found in the nucleus' };

  global.attachInteractions = function attachInteractions(canvas, atom, scene, camera, opts) {
    if (!canvas || !atom || !scene || !camera) {
      throw new Error('[attachInteractions] canvas, atom, scene, camera are required');
    }
    opts = opts || {};

    // Tag every interactable mesh so raycaster hits are interpretable.
    for (var i = 0; i < atom.nucleonRecords.length; i++) {
      var nMesh = atom.nucleonRecords[i].group.children[0];
      if (nMesh) nMesh.userData = { kind: i < atom.protonCount ? 'proton' : 'neutron', index: i };
    }
    for (var s = 0; s < atom.shells.length; s++) {
      var sh = atom.shells[s];
      for (var k = 0; k < sh.electrons.length; k++) {
        if (sh.electrons[k].mesh)
          sh.electrons[k].mesh.userData = { kind: 'electron', shellName: sh.name, n: sh.n };
      }
      if (sh.ring)  sh.ring.userData  = { kind: 'shell-ring',  shellName: sh.name, n: sh.n };
      if (sh.label) sh.label.userData = { kind: 'shell-label', shellName: sh.name, n: sh.n };
    }
    if (opts.cardObject && opts.cardObject.userData) {
      opts.cardObject.userData.kind = opts.cardObject.userData.kind || 'card';
    }

    // Reusable scratch state.
    var raycaster = new THREE.Raycaster();
    var ndc = new THREE.Vector2();
    var tmp = new THREE.Vector3();

    // Popup div (created once, reused).
    var popup = document.createElement('div');
    popup.className = 'float-label';
    popup.style.cssText = 'position:fixed;z-index:50;opacity:0;pointer-events:none;' +
                          'transform:translate(-50%,calc(-100% - 12px));';
    document.body.appendChild(popup);
    var popupTimer = 0;
    var POPUP_LIFETIME = 3.0;

    function showPopup(info, screenX, screenY) {
      var sub = info.subtitle ? '<div class="sub">' + info.subtitle + '</div>' : '';
      var det = info.detail   ? '<div class="sub">' + info.detail   + '</div>' : '';
      popup.innerHTML = '<div class="head">' + info.label + '</div>' + sub + det;
      popup.style.left = screenX + 'px';
      popup.style.top  = screenY + 'px';
      popup.style.opacity = '1';
      popupTimer = POPUP_LIFETIME;
    }
    function hidePopup() { popup.style.opacity = '0'; popupTimer = 0; }

    // Tap subscribers.
    var tapHandlers = [];
    function onTapSphere(fn) { if (typeof fn === 'function') tapHandlers.push(fn); }
    function fireTap(info) { for (var i = 0; i < tapHandlers.length; i++) tapHandlers[i](info); }

    // Zoom state.
    var cameraDistance = (opts.initialDistance != null) ? opts.initialDistance : 9.5;
    var minDist = (opts.minZoom != null) ? opts.minZoom : 4;
    var maxDist = (opts.maxZoom != null) ? opts.maxZoom : 18;
    function clampDist() { cameraDistance = Math.max(minDist, Math.min(maxDist, cameraDistance)); }
    function getCameraDistance() { return cameraDistance; }
    function setZoomBounds(mn, mx) { minDist = mn; maxDist = mx; clampDist(); }

    // Explosion state.
    var isExploding = false;
    var explodePhase = 'idle'; // 'drift' | 'snap' | 'idle'
    var explodeT = 0;
    var EXPLODE_DRIFT = 1.5, EXPLODE_SNAP = 0.4;
    var particles = []; // { wrap, basePos, velocity, snapFrom }

    function pushParticle(wrap, basePos) {
      particles.push({ wrap: wrap, basePos: basePos.clone(),
                       velocity: new THREE.Vector3(), snapFrom: new THREE.Vector3() });
    }
    function startExplosion() {
      if (isExploding) return;
      particles.length = 0;
      for (var i = 0; i < atom.nucleonRecords.length; i++)
        pushParticle(atom.nucleonRecords[i].group, atom.nucleonRecords[i].base);
      for (var s2 = 0; s2 < atom.shells.length; s2++)
        for (var k2 = 0; k2 < atom.shells[s2].electrons.length; k2++)
          pushParticle(atom.shells[s2].electrons[k2].wrap, atom.shells[s2].electrons[k2].wrap.position);
      // Spherical-uniform direction × magnitude 4-8 u/s.
      for (var i2 = 0; i2 < particles.length; i2++) {
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2;
        var r = Math.sqrt(Math.max(0, 1 - u * u)), mag = 4 + Math.random() * 4;
        particles[i2].velocity.set(Math.cos(th) * r, u, Math.sin(th) * r).multiplyScalar(mag);
      }
      isExploding = true; explodePhase = 'drift'; explodeT = 0;
      hidePopup();
    }

    function updateExplosion(dt) {
      if (!isExploding) return;
      explodeT += dt;
      if (explodePhase === 'drift') {
        for (var i = 0; i < particles.length; i++) {
          var p = particles[i];
          tmp.copy(p.wrap.position).normalize().multiplyScalar(-0.3 * dt);
          p.velocity.add(tmp);
          tmp.copy(p.velocity).multiplyScalar(dt);
          p.wrap.position.add(tmp);
        }
        if (explodeT >= EXPLODE_DRIFT) {
          for (var j = 0; j < particles.length; j++) particles[j].snapFrom.copy(particles[j].wrap.position);
          explodePhase = 'snap'; explodeT = 0;
        }
      } else { // 'snap' — cubic ease-in to base position
        var t = Math.min(1, explodeT / EXPLODE_SNAP);
        var ease = t * t * t;
        for (var k = 0; k < particles.length; k++)
          particles[k].wrap.position.lerpVectors(particles[k].snapFrom, particles[k].basePos, ease);
        if (t >= 1) {
          for (var m = 0; m < particles.length; m++) particles[m].wrap.position.copy(particles[m].basePos);
          isExploding = false; explodePhase = 'idle'; explodeT = 0;
        }
      }
    }

    // Ionize flash effect.
    var flashT = 0;
    var FLASH_DUR = 0.5;
    var atomBaseScale = atom.group.scale.x || 1;
    function startFlash() { flashT = FLASH_DUR; }
    function updateFlash(dt) {
      if (flashT <= 0) return;
      flashT -= dt;
      var t = 1 - Math.max(0, flashT) / FLASH_DUR;
      var pulse = 1 + Math.sin(t * Math.PI) * 0.08;
      atom.group.scale.setScalar(atomBaseScale * pulse);
      if (flashT <= 0) atom.group.scale.setScalar(atomBaseScale);
    }

    function ionizeOnce() {
      var current = Math.max(0, atom.protonCount - atom.electronCount);
      var valenceName = null;
      for (var s = atom.shells.length - 1; s >= 0; s--) {
        if (atom.shells[s].electrons.length > 0) { valenceName = atom.shells[s].name; break; }
      }
      atom.setIonized(current + 1);
      startFlash();
      var info = {
        kind: 'ionize',
        label: (current + 1) + '+ ion formed',
        subtitle: 'Lost ' + (current + 1) + ' electron' + (current >= 1 ? 's' : '') +
                  (valenceName ? ' from ' + valenceName + ' shell' : ''),
        detail: 'Tap restore to neutralize'
      };
      showPopup(info, window.innerWidth / 2, window.innerHeight * 0.25);
      fireTap(info);
    }

    // Picking helpers — walk parents looking for a kind-tagged ancestor.
    function pickAt(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(scene.children, true);
      for (var i = 0; i < hits.length; i++) {
        var cur = hits[i].object;
        while (cur) {
          if (cur.userData && cur.userData.kind) return cur;
          cur = cur.parent;
        }
      }
      return null;
    }

    function handleTap(clientX, clientY) {
      var hit = pickAt(clientX, clientY);
      if (!hit) { hidePopup(); return; }
      var ud = hit.userData;
      if (ud.kind === 'card') { ionizeOnce(); return; }
      var info;
      if (ud.kind === 'proton')        info = INFO_PROTON;
      else if (ud.kind === 'neutron')  info = INFO_NEUTRON;
      else if (ud.kind === 'electron' || ud.kind === 'shell-ring' || ud.kind === 'shell-label')
        info = buildElectronInfo(ud.shellName, ud.n);
      else return;
      showPopup(info, clientX, clientY);
      fireTap(info);
    }

    // Pointer / gesture state.
    var pointers = {};
    var pointerCount = 0;
    var pressTimer = null;
    var pressStartX = 0, pressStartY = 0;
    var pressActive = false;
    var pinchStartDist = 0;
    var pinchStartCamDist = 0;
    var LONG_PRESS_MS = 600;
    var MOVE_TOLERANCE = 8;
    var TAP_MAX_MS = 350;

    function pinchDistance() {
      var ids = Object.keys(pointers);
      if (ids.length < 2) return 0;
      var a = pointers[ids[0]], b = pointers[ids[1]];
      var dx = a.x - b.x, dy = a.y - b.y;
      return Math.sqrt(dx * dx + dy * dy);
    }
    function cancelPress() {
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      pressActive = false;
    }

    function onPointerDown(e) {
      if (e.pointerType === 'touch') e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
      pointers[e.pointerId] = { x: e.clientX, y: e.clientY,
                                downX: e.clientX, downY: e.clientY,
                                downT: performance.now() };
      pointerCount = Object.keys(pointers).length;
      if (pointerCount === 1) {
        pressStartX = e.clientX; pressStartY = e.clientY;
        pressActive = true;
        pressTimer = setTimeout(function () {
          if (pressActive) startExplosion();
          pressActive = false;
        }, LONG_PRESS_MS);
      } else if (pointerCount === 2) {
        cancelPress();
        pinchStartDist = pinchDistance();
        pinchStartCamDist = cameraDistance;
      } else cancelPress();
    }

    function onPointerMove(e) {
      var p = pointers[e.pointerId];
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (pressActive && pointerCount === 1) {
        var dx0 = e.clientX - pressStartX, dy0 = e.clientY - pressStartY;
        if (dx0 * dx0 + dy0 * dy0 > MOVE_TOLERANCE * MOVE_TOLERANCE) cancelPress();
      }
      if (pointerCount === 2 && pinchStartDist > 0) {
        var d = pinchDistance();
        // Pinch-out (fingers apart) → d > pinchStartDist → ratio<1 → zoom in.
        if (d > 0) { cameraDistance = pinchStartCamDist * (pinchStartDist / d); clampDist(); }
      }
    }

    function onPointerUp(e) {
      var p = pointers[e.pointerId];
      try { canvas.releasePointerCapture(e.pointerId); } catch (_) {}
      if (!p) return;
      var dt = performance.now() - p.downT;
      var dx = e.clientX - p.downX, dy = e.clientY - p.downY;
      var moved2 = dx * dx + dy * dy;
      delete pointers[e.pointerId];
      pointerCount = Object.keys(pointers).length;
      var wasTap = pointerCount === 0 && pressActive && dt < TAP_MAX_MS &&
                   moved2 < MOVE_TOLERANCE * MOVE_TOLERANCE;
      cancelPress();
      if (wasTap && !isExploding) handleTap(e.clientX, e.clientY);
      if (pointerCount < 2) pinchStartDist = 0;
    }

    function onPointerCancel(e) {
      delete pointers[e.pointerId];
      pointerCount = Object.keys(pointers).length;
      cancelPress();
      if (pointerCount < 2) pinchStartDist = 0;
    }

    function onWheel(e) { e.preventDefault(); cameraDistance += e.deltaY * 0.005; clampDist(); }

    // Wire listeners.
    var prevTouchAction = canvas.style.touchAction;
    canvas.style.touchAction = 'none';
    var listeners = [];
    function add(target, type, fn, opt) {
      target.addEventListener(type, fn, opt);
      listeners.push({ target: target, type: type, fn: fn, opts: opt });
    }
    add(canvas, 'pointerdown',   onPointerDown,   { passive: false });
    add(canvas, 'pointermove',   onPointerMove,   { passive: true  });
    add(canvas, 'pointerup',     onPointerUp,     { passive: true  });
    add(canvas, 'pointercancel', onPointerCancel, { passive: true  });
    add(canvas, 'pointerleave',  onPointerCancel, { passive: true  });
    add(canvas, 'wheel',         onWheel,         { passive: false });

    // Per-frame tick (host calls this).
    function update(dt) {
      if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
      updateExplosion(dt);
      updateFlash(dt);
      if (popupTimer > 0) {
        popupTimer -= dt;
        if (popupTimer <= 0) hidePopup();
      }
    }

    function dispose() {
      for (var i = 0; i < listeners.length; i++) {
        var L = listeners[i];
        try { L.target.removeEventListener(L.type, L.fn, L.opts); } catch (_) {}
      }
      listeners.length = 0;
      cancelPress();
      if (popup && popup.parentNode) popup.parentNode.removeChild(popup);
      canvas.style.touchAction = prevTouchAction || '';
      pointers = {}; pointerCount = 0;
      tapHandlers.length = 0; particles.length = 0;
    }

    var api = { onTapSphere: onTapSphere, setZoomBounds: setZoomBounds,
                getCameraDistance: getCameraDistance, update: update, dispose: dispose };
    Object.defineProperty(api, 'isExploding', { get: function () { return isExploding; } });
    return api;
  };
})(typeof window !== 'undefined' ? window : this);

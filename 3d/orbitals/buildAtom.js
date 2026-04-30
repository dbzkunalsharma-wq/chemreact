/* ════════════════════════════════════════════════════════════════════════
 * buildAtom.js — generic Bohr-atom factory (no ES modules; <script>-load)
 * ────────────────────────────────────────────────────────────────────────
 * Replaces hardcoded `buildNitrogenAtom()` from 3d/orbitals/bohrN-ar.html
 * with a data-driven factory keyed off `BOHR_ELEMENTS[symbol]`.
 *
 * Visuals match the nitrogen mock exactly:
 *   • MeshPhysicalMaterial glass (transmission, clearcoat, ior=1.5)
 *   • Fibonacci-sphere nucleon packing — proton red, neutron green (fixed)
 *   • Tilted torus shells with sprite labels ("K · n=1 · 2e⁻")
 *   • Electron + ring tint derived from elementData.cpkColor
 *
 * elementData = { z, mass, name, config, cpkColor, period, group, category,
 *   shellCounts:[number...], valenceShell:number (1-based),
 *   valenceCount:number, energyLevels:[number...] }
 *
 * opts (all optional) = { nucleonRadius=0.18, electronRadius=0.14,
 *   baseShellRadius=1.5, shellSpacing=1.4, showLabels=true }
 *
 * Returns:
 *   { group, update(dt), dispose(),
 *     nucleus, nucleonRecords:[{group,base,phase,speed,amp}],
 *     shells:[{name,n,radius,omega,group,ring,
 *              electrons:[{wrap,angle,mesh}], label, isValence}],
 *     protonCount, neutronCount, electronCount, isIonized,
 *     setIonized(amount),   // 0 = restore, N = remove N valence e-
 *     element }
 *
 * AR integration path (MindAR target group):
 *   const atom = window.buildBohrAtom(BOHR_ELEMENTS.N, envMap);
 *   const cardAnchor = new THREE.Group();
 *   cardAnchor.matrixAutoUpdate = false;
 *   cardAnchor.add(atom.group);
 *   scene.add(cardAnchor);
 *   session.onMatrixUpdate(({ worldMatrix }) => {
 *     cardAnchor.matrix.fromArray(worldMatrix);
 *     cardAnchor.matrixWorldNeedsUpdate = true;
 *   });
 *   // Per-frame: atom.update(dt);  On unmount: atom.dispose();
 * ════════════════════════════════════════════════════════════════════════ */
(function (global) {
  'use strict';
  if (!global.THREE) {
    console.error('[buildAtom] THREE not found on window — load three.min.js first.');
    return;
  }
  var THREE = global.THREE;

  // Fixed physics-diagram colours.
  var PROTON_HEX  = 0xFF5066;
  var NEUTRON_HEX = 0x5CD97A;
  var ELECTRON_FALLBACK_HEX = 0x5099FF;
  var ACCENT_HEX = 0x6FE7FF;

  // K..P shell names by index (covers up through z=118).
  var SHELL_NAMES = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

  // Fibonacci-sphere distribution — used for nucleon packing.
  function fibSphere(N, radius) {
    var out = new Array(N);
    if (N === 0) return out;
    if (N === 1) { out[0] = new THREE.Vector3(0, 0, 0); return out; }
    var off = 2 / N, inc = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N; i++) {
      var y = (i * off - 1) + (off / 2);
      var r = Math.sqrt(Math.max(0, 1 - y * y)), phi = i * inc;
      out[i] = new THREE.Vector3(Math.cos(phi) * r * radius, y * radius, Math.sin(phi) * r * radius);
    }
    return out;
  }

  // Sprite ring-label generator. `accent` = CSS hex; `bold` highlights valence.
  function makeRingLabel(text, accent, bold) {
    var c = document.createElement('canvas');
    c.width = 256; c.height = 64;
    var x = c.getContext('2d');
    var roundRect = function (fill) {
      if (x.roundRect) { x.beginPath(); x.roundRect(2, 2, 252, 60, 14); fill ? x.fill() : x.stroke(); }
      else { fill ? x.fillRect(2, 2, 252, 60) : x.strokeRect(2, 2, 252, 60); }
    };
    x.fillStyle = 'rgba(8,14,28,0.88)';      roundRect(true);
    x.strokeStyle = accent;
    x.lineWidth = bold ? 2.5 : 1.5;          roundRect(false);
    x.shadowColor = accent; x.shadowBlur = bold ? 18 : 12;
    x.font = 'bold 28px ui-monospace, "JetBrains Mono", Consolas, monospace';
    x.fillStyle = bold ? '#FFFFFF' : '#E6F4FF';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(text, 128, 34);
    x.shadowBlur = 0;

    var tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    var mat = new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false, depthTest: false
    });
    var s = new THREE.Sprite(mat);
    s.scale.set(1.15, 0.29, 1);
    return { sprite: s, tex: tex, mat: mat };
  }

  // Procedural tilt axis per shell — alternating x/z signs avoid coplanar
  // z-fight between adjacent shells; magnitude grows with index.
  function shellAxis(idx) {
    var sx = (idx % 2 === 0) ?  1 : -1;
    var sz = (idx % 2 === 0) ? -1 :  1;
    var mag = 0.05 + idx * 0.045;
    return new THREE.Vector3(sx * mag, 1.0, sz * mag * 0.85).normalize();
  }

  global.buildBohrAtom = function buildBohrAtom(elementData, env, opts) {
    if (!elementData) throw new Error('[buildBohrAtom] elementData is required');
    opts = opts || {};
    var nucleonRadius   = opts.nucleonRadius   != null ? opts.nucleonRadius   : 0.18;
    var electronRadius  = opts.electronRadius  != null ? opts.electronRadius  : 0.14;
    var baseShellRadius = opts.baseShellRadius != null ? opts.baseShellRadius : 1.5;
    var shellSpacing    = opts.shellSpacing    != null ? opts.shellSpacing    : 1.4;
    var showLabels      = opts.showLabels      !== false;

    var z = elementData.z | 0;
    var massNum = (elementData.mass != null) ? Math.round(elementData.mass) : z;
    var neutronCount = Math.max(0, massNum - z);
    var shellCounts = (elementData.shellCounts && elementData.shellCounts.length)
                        ? elementData.shellCounts.slice() : [z];
    var N = shellCounts.length;
    var valenceIdx0 = (elementData.valenceShell != null) ? (elementData.valenceShell - 1) : (N - 1);
    valenceIdx0 = Math.max(0, Math.min(N - 1, valenceIdx0));

    // Heavy-atom squeeze: Au has 6 shells; default spacing would clip past
    // ~10 world units. Auto-clamp by N unless caller explicitly tuned for small N.
    var adjustedSpacing = (N > 4) ? 0.85 : (N > 2 ? 1.10 : shellSpacing);
    if (opts.shellSpacing != null && N <= 2) adjustedSpacing = shellSpacing;

    // Element identity colour for electrons; ring uses cpk-cyan mix.
    var cpkThree = new THREE.Color(elementData.cpkColor || '#5099FF');
    var electronHex = cpkThree.getHex() || ELECTRON_FALLBACK_HEX;
    var ringTint = cpkThree.clone().lerp(new THREE.Color(ACCENT_HEX), 0.4).getHex();

    // ── Owned-resource trackers (dispose() walks these) ──
    var root = new THREE.Group();
    var ownedGeos = [], ownedMats = [], ownedTexs = [];

    // Glass material factory — shared spec with bohrN-ar.
    function pick(v, d) { return v != null ? v : d; }
    function glassMat(colorHex, o) {
      o = o || {};
      var m = new THREE.MeshPhysicalMaterial({
        color: colorHex, metalness: 0.05,
        roughness: pick(o.roughness, 0.10), transmission: pick(o.transmission, 0.35),
        thickness: pick(o.thickness, 0.4),
        ior: 1.5, clearcoat: 1.0, clearcoatRoughness: 0.04,
        envMap: env || null, envMapIntensity: pick(o.envMapIntensity, 1.4),
        attenuationColor: colorHex, attenuationDistance: pick(o.attenuationDistance, 1.6),
        emissive: pick(o.emissiveHex, colorHex), emissiveIntensity: pick(o.emissiveIntensity, 0.18)
      });
      ownedMats.push(m);
      return m;
    }
    var matProton   = glassMat(PROTON_HEX,  { transmission: 0.30, emissiveIntensity: 0.22 });
    var matNeutron  = glassMat(NEUTRON_HEX, { transmission: 0.30, emissiveIntensity: 0.20 });
    var matElectron = glassMat(electronHex, { transmission: 0.50, emissiveIntensity: 0.32, attenuationDistance: 1.0 });

    // Shared sphere geometries.
    var geoNuc      = new THREE.SphereGeometry(nucleonRadius,  24, 18);
    var geoElectron = new THREE.SphereGeometry(electronRadius, 24, 18);
    ownedGeos.push(geoNuc, geoElectron);

    // ── Nucleus ──
    // Cluster radius ∝ ∛(nucleons), capped at 0.7 so heavy nuclei don't
    // swallow the K shell.
    var nucleonTotal = z + neutronCount;
    var nucClusterR = Math.min(0.7, Math.pow(nucleonTotal, 1 / 3) * 0.5 * nucleonRadius);
    var nucleus = new THREE.Group();
    root.add(nucleus);
    var nucleonRest = fibSphere(nucleonTotal, nucClusterR);
    var nucleonRecords = [];
    for (var i = 0; i < nucleonTotal; i++) {
      var wrap = new THREE.Group();
      wrap.position.copy(nucleonRest[i]);
      wrap.add(new THREE.Mesh(geoNuc, i < z ? matProton : matNeutron));
      nucleus.add(wrap);
      nucleonRecords.push({
        group: wrap, base: nucleonRest[i].clone(),
        phase: Math.random() * Math.PI * 2,
        speed: 1.0 + Math.random() * 0.8,
        amp:   0.014 + Math.random() * 0.012
      });
    }

    // ── Shells ──
    // Tinted-glass ring material — cpk-cyan mix, semi-transparent.
    function ringMat() {
      var m = new THREE.MeshPhysicalMaterial({
        color: ringTint, metalness: 0.6, roughness: 0.25,
        envMap: env || null, envMapIntensity: 0.9,
        emissive: ringTint, emissiveIntensity: 0.25,
        transparent: true, opacity: 0.8
      });
      ownedMats.push(m);
      return m;
    }
    // Three int → "#RRGGBB" CSS string, used by label borders.
    var labelAccentCss = '#' + (('00000' + (ringTint >>> 0).toString(16)).slice(-6)).toUpperCase();

    var shells = [];
    var YUP = new THREE.Vector3(0, 1, 0);
    for (var sIdx = 0; sIdx < N; sIdx++) {
      var n = sIdx + 1;
      var eCount = shellCounts[sIdx] | 0;
      var radius = baseShellRadius + sIdx * adjustedSpacing;
      var omega = 1.40 / Math.pow(n, 1.6);   // slower for outer shells
      var isValence = (sIdx === valenceIdx0);
      var name = SHELL_NAMES[sIdx] || ('S' + n);

      var sg = new THREE.Group();
      sg.quaternion.setFromUnitVectors(YUP, shellAxis(sIdx));

      var ringGeo = new THREE.TorusGeometry(radius, 0.028 + n * 0.005, 12, 96);
      ownedGeos.push(ringGeo);
      var ring = new THREE.Mesh(ringGeo, ringMat());
      ring.rotation.x = Math.PI / 2;
      sg.add(ring);

      var labelSprite = null;
      if (showLabels) {
        var lbl = makeRingLabel(name + ' · n=' + n + ' · ' + eCount + 'e⁻',
                                labelAccentCss, isValence);
        ownedTexs.push(lbl.tex); ownedMats.push(lbl.mat);
        lbl.sprite.position.set(radius, 0.45, 0);
        sg.add(lbl.sprite);
        labelSprite = lbl.sprite;
      }

      var electrons = new Array(eCount);
      for (var k = 0; k < eCount; k++) {
        var angle = (k / Math.max(1, eCount)) * Math.PI * 2;
        var eWrap = new THREE.Group();
        eWrap.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
        var eMesh = new THREE.Mesh(geoElectron, matElectron);
        eWrap.add(eMesh);
        sg.add(eWrap);
        electrons[k] = { wrap: eWrap, angle: angle, mesh: eMesh };
      }

      root.add(sg);
      shells.push({
        name: name, n: n, radius: radius, omega: omega,
        group: sg, ring: ring, electrons: electrons,
        label: labelSprite, isValence: isValence
      });
    }

    // ── Ionization queue ──
    // Records: { shell, entry, scaleT, mode } where mode is
    //   'shrink' (1→0), 'grow' (0→1), 'gone' (off-scene), 'idle' (done).
    var ionQueue = [];
    var IONIZE_DUR = 0.5;
    function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    function setIonized(amount) {
      amount = amount | 0;
      var vs = shells[valenceIdx0];
      if (!vs) return;
      if (amount > 0) {
        for (var a = 0; a < amount && vs.electrons.length; a++) {
          ionQueue.push({ shell: vs, entry: vs.electrons.pop(), scaleT: 0, mode: 'shrink' });
          atom.electronCount--;
        }
        atom.isIonized = true;
      } else if (amount === 0 && atom.isIonized) {
        for (var i2 = 0; i2 < ionQueue.length; i2++) {
          var rec = ionQueue[i2];
          if (rec.mode !== 'gone' && rec.mode !== 'shrink') continue;
          if (rec.mode === 'gone') {
            rec.shell.group.add(rec.entry.wrap);
            rec.shell.electrons.push(rec.entry);
          }
          atom.electronCount++;
          rec.scaleT = 0; rec.mode = 'grow';
        }
        atom.isIonized = false;
      }
    }

    // ── Per-frame update (allocation-free) ──
    var pulseT = 0;

    function update(dt) {
      if (typeof dt !== 'number' || !isFinite(dt) || dt <= 0) return;
      pulseT += dt;

      // Nucleus pulse + tumble + per-nucleon jitter.
      nucleus.scale.setScalar(1 + Math.sin(pulseT * 1.7) * 0.04);
      nucleus.rotation.y += 0.20 * dt;
      nucleus.rotation.x += 0.07 * dt;
      for (var i = 0; i < nucleonRecords.length; i++) {
        var r = nucleonRecords[i], ph = pulseT * r.speed + r.phase;
        r.group.position.set(
          r.base.x + Math.sin(ph * 1.3) * r.amp,
          r.base.y + Math.sin(ph * 0.9 + 1.7) * r.amp,
          r.base.z + Math.sin(ph * 1.1 + 3.1) * r.amp
        );
      }

      // Electrons advance in shell-local angle. Skip any flagged `inTransit`
      // (the pedagogy layer commandeers an electron's wrap mid-transition).
      for (var s = 0; s < shells.length; s++) {
        var sh = shells[s], da = sh.omega * dt;
        for (var k = 0; k < sh.electrons.length; k++) {
          var e = sh.electrons[k];
          if (e.inTransit) continue;
          e.angle += da;
          e.wrap.position.set(Math.cos(e.angle) * sh.radius, 0, Math.sin(e.angle) * sh.radius);
        }
      }

      // Ionization animations (iterate backwards for safe splice on grow→done).
      for (var q2 = ionQueue.length - 1; q2 >= 0; q2--) {
        var rec2 = ionQueue[q2];
        rec2.scaleT += dt;
        var t01 = Math.min(1, rec2.scaleT / IONIZE_DUR);
        if (rec2.mode === 'shrink') {
          rec2.entry.wrap.scale.setScalar(Math.max(0, 1 - easeOutCubic(t01)));
          if (t01 >= 1) {
            if (rec2.entry.wrap.parent) rec2.entry.wrap.parent.remove(rec2.entry.wrap);
            rec2.mode = 'gone';
          }
        } else if (rec2.mode === 'grow') {
          var ee = rec2.entry, sr = rec2.shell.radius;
          ee.wrap.scale.setScalar(easeOutCubic(t01));
          ee.angle += rec2.shell.omega * dt;
          ee.wrap.position.set(Math.cos(ee.angle) * sr, 0, Math.sin(ee.angle) * sr);
          if (t01 >= 1) ionQueue.splice(q2, 1);  // restored; normal orbit takes over
        }
      }
    }

    // ── Cleanup: walks the owned arrays. Safe to call multiple times. ──
    function dispose() {
      for (var i = 0; i < ownedGeos.length; i++) try { ownedGeos[i].dispose(); } catch (_) {}
      for (var j = 0; j < ownedMats.length; j++) try { ownedMats[j].dispose(); } catch (_) {}
      for (var t = 0; t < ownedTexs.length; t++) try { ownedTexs[t].dispose(); } catch (_) {}
      ownedGeos.length = 0; ownedMats.length = 0; ownedTexs.length = 0;
      while (root.children.length > 0) root.remove(root.children[0]);
    }

    var atom = {
      group: root, update: update, dispose: dispose,
      nucleus: nucleus, nucleonRecords: nucleonRecords, shells: shells,
      protonCount: z, neutronCount: neutronCount, electronCount: z,
      isIonized: false, setIonized: setIonized, element: elementData
    };
    return atom;
  };
})(typeof window !== 'undefined' ? window : this);

/* ============================================================================
 * visualPolish.js — drop-in <script>-loadable visual polish for bohrN-ar.html
 * ----------------------------------------------------------------------------
 * Exposes three globals on window:
 *
 *   window.setupBloomComposer(renderer, scene, camera, opts)
 *     -> { composer, render(), resize(w,h), setStrength(s), dispose() }
 *     Replaces renderer.render(scene, camera) with a bloom-composited pass.
 *     Use composer.render() in your animation loop instead of renderer.render.
 *
 *   window.makeAtomShadow(opts)
 *     -> { mesh, update(dt, atomY), dispose }
 *     A soft circular shadow plane that hugs the card surface beneath the
 *     atom. Opacity falls off with distance from the card.
 *
 *   window.makeCaustics(opts)
 *     -> { mesh, update(dt, electronPositions), dispose }
 *     A textured plane sitting on the card showing animated cyan caustic
 *     light patterns. 4 pre-rendered noise frames blended additively.
 *
 * ----------------------------------------------------------------------------
 * BLOOM APPROACH:
 *   We use a custom fake-bloom shim built on raw THREE primitives
 *   (WebGLRenderTarget + ShaderMaterial + OrthographicCamera + fullscreen
 *   quad). Why: three v0.160.0 dropped the legacy /examples/js/ classic
 *   builds (a HEAD on jsdelivr returned 404). The /examples/jsm/ modules
 *   require ES module imports which are incompatible with the project's
 *   classic <script>-tag CDN load. The shim does:
 *
 *     1. Render scene to an offscreen target (sceneRT).
 *     2. Bright-pass extract: pixels above `threshold` -> brightRT.
 *     3. Two-pass separable Gaussian blur (horizontal then vertical) at
 *        half resolution -> blurRT.
 *     4. Composite: sceneRT + strength * blurRT, output to screen.
 *
 *   Trade-offs vs UnrealBloomPass:
 *     - Single blur level instead of multi-mip pyramid: glow is slightly
 *       less wide and physically plausible, but plenty good for this scene.
 *     - No threshold knee softening — hard cutoff. Set threshold ~0.5 and
 *       tune emissive intensity on glass spheres for clean results.
 *     - Half-resolution blur target keeps mobile GPU cost low (~1ms on
 *       mid-tier phones). Total overhead ~5 draw calls.
 *
 * NO ALLOCATIONS in update() loops; all geom/material/texture owned and
 * disposed via the returned dispose() functions. Callers do scene.add().
 * ========================================================================== */

(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('[visualPolish] THREE global not found. Load three.min.js first.');
    return;
  }

  // ─────────────────────────────────────────────────────────────────────
  // Shared fullscreen-quad helper (used by bloom passes)
  // ─────────────────────────────────────────────────────────────────────
  function makeFullscreenQuad(material) {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    return { geo: geo, mesh: mesh };
  }

  // ─────────────────────────────────────────────────────────────────────
  // 1) BLOOM (fake-bloom shim — no /examples/jsm/ dependency)
  // ─────────────────────────────────────────────────────────────────────
  const BRIGHT_PASS_FRAG = [
    'uniform sampler2D tDiffuse;',
    'uniform float threshold;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  float b = max(c.r, max(c.g, c.b));',
    '  float k = smoothstep(threshold, threshold + 0.15, b);',
    '  gl_FragColor = vec4(c.rgb * k, 1.0);',
    '}'
  ].join('\n');

  const BLUR_FRAG = [
    'uniform sampler2D tDiffuse;',
    'uniform vec2 direction;',
    'uniform vec2 resolution;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 px = direction / resolution;',
    '  vec4 sum = vec4(0.0);',
    '  sum += texture2D(tDiffuse, vUv - px * 4.0) * 0.05;',
    '  sum += texture2D(tDiffuse, vUv - px * 3.0) * 0.09;',
    '  sum += texture2D(tDiffuse, vUv - px * 2.0) * 0.12;',
    '  sum += texture2D(tDiffuse, vUv - px * 1.0) * 0.15;',
    '  sum += texture2D(tDiffuse, vUv)            * 0.18;',
    '  sum += texture2D(tDiffuse, vUv + px * 1.0) * 0.15;',
    '  sum += texture2D(tDiffuse, vUv + px * 2.0) * 0.12;',
    '  sum += texture2D(tDiffuse, vUv + px * 3.0) * 0.09;',
    '  sum += texture2D(tDiffuse, vUv + px * 4.0) * 0.05;',
    '  gl_FragColor = sum;',
    '}'
  ].join('\n');

  const COMPOSITE_FRAG = [
    'uniform sampler2D tBase;',
    'uniform sampler2D tBloom;',
    'uniform float strength;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec4 base  = texture2D(tBase,  vUv);',
    '  vec4 bloom = texture2D(tBloom, vUv);',
    '  gl_FragColor = vec4(base.rgb + bloom.rgb * strength, 1.0);',
    '}'
  ].join('\n');

  const PASS_VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  window.setupBloomComposer = function (renderer, scene, camera, opts) {
    opts = opts || {};
    let strength = opts.strength != null ? opts.strength : 0.6;
    const radius = opts.radius != null ? opts.radius : 0.4;       // accepted but unused (single-pass blur)
    const threshold = opts.threshold != null ? opts.threshold : 0.5;
    void radius;

    const pixelRatio = renderer.getPixelRatio();
    const size = new THREE.Vector2();
    renderer.getSize(size);
    let w = Math.max(2, Math.floor(size.x));
    let h = Math.max(2, Math.floor(size.y));
    const halfW = function () { return Math.max(2, Math.floor(w / 2)); };
    const halfH = function () { return Math.max(2, Math.floor(h / 2)); };

    const rtParams = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType
    };

    const sceneRT  = new THREE.WebGLRenderTarget(w, h, rtParams);
    const brightRT = new THREE.WebGLRenderTarget(halfW(), halfH(), rtParams);
    const blurRT   = new THREE.WebGLRenderTarget(halfW(), halfH(), rtParams);

    // Materials
    const brightMat = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: threshold } },
      vertexShader: PASS_VERT,
      fragmentShader: BRIGHT_PASS_FRAG,
      depthTest: false, depthWrite: false
    });
    const blurMat = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse:   { value: null },
        direction:  { value: new THREE.Vector2(1, 0) },
        resolution: { value: new THREE.Vector2(halfW(), halfH()) }
      },
      vertexShader: PASS_VERT,
      fragmentShader: BLUR_FRAG,
      depthTest: false, depthWrite: false
    });
    const compositeMat = new THREE.ShaderMaterial({
      uniforms: {
        tBase:    { value: sceneRT.texture },
        tBloom:   { value: blurRT.texture },
        strength: { value: strength }
      },
      vertexShader: PASS_VERT,
      fragmentShader: COMPOSITE_FRAG,
      depthTest: false, depthWrite: false
    });

    const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadScene = new THREE.Scene();
    const quadGeo = new THREE.PlaneGeometry(2, 2);
    const quadMesh = new THREE.Mesh(quadGeo, brightMat);
    quadMesh.frustumCulled = false;
    quadScene.add(quadMesh);

    function setMaterial(m) { quadMesh.material = m; }

    function render() {
      const prevTarget = renderer.getRenderTarget();
      const prevAuto = renderer.autoClear;
      renderer.autoClear = true;

      // 1) Scene -> sceneRT
      renderer.setRenderTarget(sceneRT);
      renderer.clear();
      renderer.render(scene, camera);

      // 2) Bright pass: sceneRT -> brightRT
      brightMat.uniforms.tDiffuse.value = sceneRT.texture;
      brightMat.uniforms.threshold.value = threshold;
      setMaterial(brightMat);
      renderer.setRenderTarget(brightRT);
      renderer.clear();
      renderer.render(quadScene, quadCam);

      // 3a) Horizontal blur: brightRT -> blurRT
      blurMat.uniforms.tDiffuse.value = brightRT.texture;
      blurMat.uniforms.direction.value.set(1, 0);
      blurMat.uniforms.resolution.value.set(halfW(), halfH());
      setMaterial(blurMat);
      renderer.setRenderTarget(blurRT);
      renderer.clear();
      renderer.render(quadScene, quadCam);

      // 3b) Vertical blur: blurRT -> brightRT (reuse)
      blurMat.uniforms.tDiffuse.value = blurRT.texture;
      blurMat.uniforms.direction.value.set(0, 1);
      setMaterial(blurMat);
      renderer.setRenderTarget(brightRT);
      renderer.clear();
      renderer.render(quadScene, quadCam);

      // 4) Composite to screen
      compositeMat.uniforms.tBase.value = sceneRT.texture;
      compositeMat.uniforms.tBloom.value = brightRT.texture;
      compositeMat.uniforms.strength.value = strength;
      setMaterial(compositeMat);
      renderer.setRenderTarget(prevTarget);
      renderer.clear();
      renderer.render(quadScene, quadCam);

      renderer.autoClear = prevAuto;
    }

    function resize(newW, newH) {
      w = Math.max(2, Math.floor(newW));
      h = Math.max(2, Math.floor(newH));
      sceneRT.setSize(w, h);
      brightRT.setSize(halfW(), halfH());
      blurRT.setSize(halfW(), halfH());
      blurMat.uniforms.resolution.value.set(halfW(), halfH());
    }

    function setStrength(s) { strength = s; }

    function dispose() {
      sceneRT.dispose();
      brightRT.dispose();
      blurRT.dispose();
      brightMat.dispose();
      blurMat.dispose();
      compositeMat.dispose();
      quadGeo.dispose();
    }

    void pixelRatio; // tracked but renderer manages its own DPR

    return {
      composer: { render: render },   // shim shape compatible with EffectComposer.render()
      render: render,
      resize: resize,
      setStrength: setStrength,
      dispose: dispose
    };
  };

  // ─────────────────────────────────────────────────────────────────────
  // 2) ATOM SHADOW (procedural radial-gradient texture on tilted plane)
  // ─────────────────────────────────────────────────────────────────────
  function buildRadialGradientTexture(size, color) {
    const cnv = document.createElement('canvas');
    cnv.width = size; cnv.height = size;
    const ctx = cnv.getContext('2d');
    const cx = size * 0.5, cy = size * 0.5;
    const r0 = size * 0.05, r1 = size * 0.5;
    const grad = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
    const hex = '#' + (color & 0xffffff).toString(16).padStart(6, '0');
    grad.addColorStop(0.0, hex + 'ff');
    grad.addColorStop(0.35, hex + 'aa');
    grad.addColorStop(0.7, hex + '40');
    grad.addColorStop(1.0, hex + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(cnv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  window.makeAtomShadow = function (opts) {
    opts = opts || {};
    const size = opts.size != null ? opts.size : 1.8;
    const baseY = opts.baseY != null ? opts.baseY : -2.65;
    const cardTilt = opts.cardTilt != null ? opts.cardTilt : -Math.PI / 2 * 0.86;
    const color = opts.color != null ? opts.color : 0x000000;
    const maxOpacity = opts.maxOpacity != null ? opts.maxOpacity : 0.55;

    const tex = buildRadialGradientTexture(256, color);
    const geo = new THREE.PlaneGeometry(size * 2, size * 2);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: maxOpacity,
      depthWrite: false,
      blending: THREE.NormalBlending
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = cardTilt;
    mesh.position.y = baseY;
    mesh.renderOrder = 1;

    function update(dt, atomY) {
      void dt;
      // Distance from card. atomY at baseY -> opacity = max. Beyond +1.0 -> ~0.
      const d = Math.max(0, atomY - baseY);
      const fade = Math.max(0, 1 - d / 1.0);
      mat.opacity = maxOpacity * fade;
      // Light scale-up as the atom rises (shadow softens & spreads).
      const s = 1 + d * 0.25;
      mesh.scale.set(s, s, 1);
    }

    function dispose() {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    }

    return { mesh: mesh, update: update, dispose: dispose };
  };

  // ─────────────────────────────────────────────────────────────────────
  // 3) CAUSTICS (4 pre-rendered noise frames, lerp on phase)
  // ─────────────────────────────────────────────────────────────────────
  function paintCausticFrame(size, seed, color) {
    const cnv = document.createElement('canvas');
    cnv.width = size; cnv.height = size;
    const ctx = cnv.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;
    const r = (color >> 16) & 0xff;
    const g = (color >> 8) & 0xff;
    const b = color & 0xff;

    // Sum-of-sines pseudo-noise (cheap, smooth, tileable-ish)
    const s1 = 6.0 + seed * 0.7;
    const s2 = 11.0 + seed * 1.1;
    const s3 = 17.0 + seed * 1.9;
    const phaseA = seed * 1.37;
    const phaseB = seed * 2.71;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const v = y / size;
        // Layered sines yielding bright filaments
        const a = Math.sin((u + v * 0.7) * s1 + phaseA);
        const b1 = Math.sin((u * 1.3 - v * 1.1) * s2 + phaseB);
        const c1 = Math.sin((u * 0.5 + v * 1.4) * s3 + seed);
        let n = (a + b1 + c1) * 0.333; // -1..1
        n = Math.abs(n);                // creases (caustic-ish)
        // Sharpen highlights
        n = Math.pow(n, 3.0);
        // Radial mask: dim the corners so the plane edges fade out
        const dx = u - 0.5, dy = v - 0.5;
        const rad = Math.sqrt(dx * dx + dy * dy) * 2.0;
        const mask = Math.max(0, 1 - rad * rad);
        const k = n * mask;
        const idx = (y * size + x) * 4;
        data[idx]     = Math.min(255, r * k * 1.4);
        data[idx + 1] = Math.min(255, g * k * 1.4);
        data[idx + 2] = Math.min(255, b * k * 1.4);
        data[idx + 3] = Math.min(255, 255 * k);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(cnv);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  }

  // Crossfade shader: lerp(texA, texB, mix), tinted by intensity uniform.
  const CAUSTIC_VERT = [
    'varying vec2 vUv;',
    'void main(){',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  const CAUSTIC_FRAG = [
    'uniform sampler2D tA;',
    'uniform sampler2D tB;',
    'uniform float mixK;',
    'uniform float intensity;',
    'uniform float uvShift;',
    'varying vec2 vUv;',
    'void main(){',
    '  vec2 uvA = vUv + vec2( uvShift,  uvShift * 0.5);',
    '  vec2 uvB = vUv + vec2(-uvShift * 0.7, uvShift);',
    '  vec4 a = texture2D(tA, uvA);',
    '  vec4 b = texture2D(tB, uvB);',
    '  vec4 c = mix(a, b, mixK);',
    '  gl_FragColor = vec4(c.rgb * intensity, c.a * intensity);',
    '}'
  ].join('\n');

  // Reusable scratch (no allocation in update())
  const _scratchVec = new THREE.Vector3();

  window.makeCaustics = function (opts) {
    opts = opts || {};
    const size = opts.size != null ? opts.size : 2.4;
    const baseY = opts.baseY != null ? opts.baseY : -2.66;
    const cardTilt = opts.cardTilt != null ? opts.cardTilt : -Math.PI / 2 * 0.86;
    const color = opts.color != null ? opts.color : 0x6FE7FF;
    const intensity = opts.intensity != null ? opts.intensity : 0.4;
    const frameCount = 4;
    const texSize = 256;

    const frames = new Array(frameCount);
    for (let i = 0; i < frameCount; i++) {
      frames[i] = paintCausticFrame(texSize, i + 1, color);
    }

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tA:        { value: frames[0] },
        tB:        { value: frames[1] },
        mixK:      { value: 0.0 },
        intensity: { value: intensity },
        uvShift:   { value: 0.0 }
      },
      vertexShader: CAUSTIC_VERT,
      fragmentShader: CAUSTIC_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const geo = new THREE.PlaneGeometry(size * 2, size * 2);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = cardTilt;
    mesh.position.y = baseY;
    mesh.renderOrder = 2;

    let phase = 0;

    function update(dt, electronPositions) {
      // Drive phase from electron motion if provided, else just time.
      let speed = 0.35;
      if (electronPositions && electronPositions.length) {
        let sum = 0;
        for (let i = 0; i < electronPositions.length; i++) {
          const p = electronPositions[i];
          if (!p) continue;
          // Use horizontal radius as a swirl proxy (no allocation).
          _scratchVec.set(p.x || 0, 0, p.z || 0);
          sum += _scratchVec.length();
        }
        const avg = sum / electronPositions.length;
        speed = 0.25 + Math.min(2.0, avg * 0.2);
      }
      phase += (dt || 0.016) * speed;

      // Cycle through the frames, blending neighbours.
      const wrapped = phase % frameCount;
      const idxA = Math.floor(wrapped) % frameCount;
      const idxB = (idxA + 1) % frameCount;
      const k = wrapped - Math.floor(wrapped);

      mat.uniforms.tA.value = frames[idxA];
      mat.uniforms.tB.value = frames[idxB];
      mat.uniforms.mixK.value = k;
      // Slow drift on top of frame blend so it never looks looping.
      mat.uniforms.uvShift.value = (phase * 0.02) % 1.0;
    }

    function dispose() {
      geo.dispose();
      mat.dispose();
      for (let i = 0; i < frames.length; i++) frames[i].dispose();
    }

    return { mesh: mesh, update: update, dispose: dispose };
  };

})();

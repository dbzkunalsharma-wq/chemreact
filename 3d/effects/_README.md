# 3D Effects Library

Particle effects that play **under** the 3D molecule for each chemical reaction.
Designed to feel game-juicy on mid-range Android phones — every effect is capped at ~100 particles, uses a single geometry where possible, and never allocates per frame.

## Contract (`IEffect.js`)

Every effect file in this folder exports a class named `Effect` matching this shape:

```js
export class Effect {
  constructor(opts) {
    // opts: { color?, intensity?, scale?, position?: [x,y,z] }
    // Build a THREE.Group containing all particle meshes/points here.
    // Allocate ALL buffers (Float32Array, geometries, materials) NOW.
  }
  get group() { /* returns the THREE.Group to add to the scene */ }
  update(dt) { /* called every frame; dt is in seconds */ }
  dispose() { /* free geometries, materials, textures */ }
}
```

The `EffectsManager` (`../effectsManager.js`) owns lifecycle: construct, pump
`update(dt)`, and call `dispose()` on removal. Effects do **not** add
themselves to a scene — the manager hands you back the `group` and you attach it.

## Built-in effects

| Name              | Looks like                                              | Use under                                  |
| ----------------- | ------------------------------------------------------- | ------------------------------------------ |
| `water-ripple`    | Concentric blue rings expanding outward in XZ plane     | H2O, dissolution, aqueous reactions        |
| `flame`           | Yellow→orange→red points rising in a tight cone         | CH4, methane combustion, exothermic burn   |
| `smoke`           | Drifting grey wisps rising and spreading                | Combustion residue, follow-up to flame     |
| `crystal-sparkle` | Pale tetrahedra in a spiral, pulsing scale + rotation   | NaCl, salt formation, crystallization      |
| `gas-bubble`      | Translucent spheres rising in a column with sin wobble  | CO2 release, fizzing, electrolysis         |
| `dust`            | Rust-colored falling points with horizontal drift       | Iron oxidation, weathering, decay          |
| `sparks`          | Bright cyan points exploding radially with gravity      | Electric discharge, decomposition flash    |
| `glow-pulse`      | Flat circle pulses radiating outward in XZ plane        | Energy ping, exothermic aura, accent layer |
| `shimmer`         | Golden tetrahedra sweeping in arcs, soft fade in/out    | Au/Ag/Cu shimmer, noble metal coating      |

All effects accept the standard option bag:

```js
{ color: 0xff8800,      // accent / tint (CSS color, hex int, or THREE.Color)
  intensity: 1.0,       // 0..1, scales count/speed/brightness for some effects
  scale: 1.0,           // uniform scale of the whole group
  position: [0, 0, 0]   // [x, y, z] offset
}
```

## Adding a new effect

1. **Write the file** at `D:/chemreact-pwa/3d/effects/myEffect.js`. Export
   `class Effect { ... }` matching the contract. Allocate buffers in the
   constructor, drive everything from `update(dt)`, and dispose cleanly.
2. **Register it** in `./index.js`:
   ```js
   import { Effect as MyEffect } from './myEffect.js';
   // …add to REGISTRY:
   'my-effect': MyEffect,
   ```
3. **Reference by name** in `data/reactions.json` (or wherever you map a
   reaction → effect): `"effect": "my-effect"`. The reaction wiring code calls
   `effectsManager.add('my-effect', { color, position })` and attaches the
   returned group to the scene.

## Performance budget per effect

| Constraint                | Target                                        |
| ------------------------- | --------------------------------------------- |
| Particle count            | ≤ 100 (most are 15–40)                        |
| Per-frame allocations     | **Zero** — all buffers pre-allocated          |
| Geometries per effect     | 1–2 (TetrahedronGeometry, BufferGeometry)     |
| Materials per effect      | 1–2 (mostly `MeshBasicMaterial`)              |
| Lighting cost             | None — `BasicMaterial` only                   |
| Shadow casting            | Off                                           |
| Depth writes              | Off (transparent particles)                   |
| Blending                  | Additive for fire/sparks/glow, normal for smoke/dust |

The mid-range Android target is the Redmi Note 9 / Moto G Power class. With three concurrent effects (e.g. flame + smoke + glow-pulse), total particle count stays under 100 and the GPU does ~3 draw calls — well within budget alongside the molecule mesh.

## Files

- `IEffect.js` — interface contract (documentation + reusable base shell)
- `index.js` — registry + `spawnEffect(name, opts)` factory
- One file per effect: `waterRipple.js`, `flame.js`, `smoke.js`,
  `crystalSparkle.js`, `gasBubble.js`, `dust.js`, `sparks.js`,
  `glowPulse.js`, `shimmer.js`
- `../effectsManager.js` — orchestrator (lives in `3d/`, not `3d/effects/`)

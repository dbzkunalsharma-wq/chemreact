# /future — staging area for upcoming features

This folder is a **deliberate parking lot** for code that isn't wired into the
main app yet but is expected to land later. Anything here:

- Must be importable from the rest of the project (relative paths to
  `../data/*.json` etc. are fine), but the live app **does not import it yet**.
- Must follow the same conventions as the rest of the codebase
  (THREE on `window.THREE`, ES modules, no build step, dispose() lifecycles).
- Should ship with a standalone `demo.html` per module so it can be reviewed
  in isolation before being merged into a screen.

## Modules

### `orbitals/` — per-element rotating orbital models

Builds a stylised 3D representation of an atom's electron configuration.
Reads the `config` field already present in `data/elements.json`
(e.g. `"[Ne]3s2 3p1"`), expands noble-gas shorthand, and constructs one
THREE.Group per subshell (s, p, d, f) with shape-appropriate geometry:

| subshell | shape                                |
|----------|--------------------------------------|
| s        | sphere shell                         |
| p        | three perpendicular dumbbells        |
| d        | xy cloverleaf + dz² torus            |
| f        | 8 octant lobes (simplified)          |

Each subshell rotates on its own axis at its own speed (inner shells fast,
outer slow), the nucleus pulses gently, and the whole atom drifts on Y.

**Public API** (from `future/orbitals/index.js`):

```js
import { createOrbitalModel } from './future/orbitals/index.js';
const model = createOrbitalModel(element);   // element from data/elements.json
scene.add(model.group);
// each frame:
model.update(dt);
// when removed:
model.dispose();
```

**Preview** by serving the project root over a static server and opening
`future/orbitals/demo.html`. The dropdown lists every element from
`data/elements.json` and swaps the live model on change.

```sh
# from project root
python3 -m http.server 8000
# then visit:
# http://localhost:8000/future/orbitals/demo.html
```

**When promoting into the app**, candidate integration points:
- new `screens/orbital.js` route reachable from `elementDetail.js`
- inline preview inside the element-detail screen
- AR-anchored orbital cloud as an alternative to the molecule viewer when a
  single-element card is scanned

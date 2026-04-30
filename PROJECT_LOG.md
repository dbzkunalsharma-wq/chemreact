# ChemReact — Project Log

> **Purpose of this file:** a single drop-in document so a fresh Claude (or
> a human reviewer) can come up to speed on this project in 5 minutes.
> Everything below summarises work done over the **2026-04-28 → 2026-04-30**
> session window. Generated for [Kunal Sharma](https://github.com/dbzkunalsharma-wq).

---

## 1. What ChemReact is

| | |
|---|---|
| **Course** | IIT Delhi — Design Research Methods (DDS256021) |
| **Audience** | Class 10 → 11 chemistry students |
| **Deliverable** | Physical chemistry **board game** (12+ printed element cards + board) **+** companion **AR app** that overlays 3D molecules + reactions when cards are scanned |
| **Wow factor** | Proximity-based AR reaction — bring two element cards close on the table → atoms attract and bond in 3D → a compound forms. No buttons, no AI. Pure tabletop + AR. |
| **Stack (locked)** | Vanilla JS PWA, no build step, no bundler. Three.js (CDN, v0.160.0), MindAR.js (CDN, v1.2.5), PWABuilder.com to wrap into Android APK. |
| **Repo** | https://github.com/dbzkunalsharma-wq/chemreact |
| **Local path** | `D:/chemreact-pwa/` |
| **No-AI rule** | Explicitly no LLM/ML inside the shipped app — pedagogically deterministic. |

**Original 7-day plan (Day 1 = 2026-04-28):**
1. Card design + element list lockdown
2. Print cards
3. MindAR setup + image targets
4. Three.js molecule library
5. COMBINE / proximity-reaction logic
6. Polish (mascot, info overlay, animations)
7. APK build via PWABuilder + Android testing

---

## 2. Architecture (one screen worth of context)

```
D:/chemreact-pwa/
├─ index.html
├─ main.js                  ← entry, wires deps, registers screens
├─ manifest.webmanifest     ← PWA manifest (PWABuilder-ready)
├─ service-worker.js        ← v3, pre-caches ~85 entries
├─ data/                    ← 4 JSON databases (elements/compounds/reactions/molecules)
├─ core/                    ← state, eventBus, nav, tracker(s), audio bridge, combine
├─ 3d/                      ← animators, effects, materials, molecule + card renderers
├─ screens/                 ← 9 screens (one file per screen)
├─ components/              ← primitives + bigger components (mascot, bnav, etc.)
└─ styles/                  ← tokens → figma → base → primitives → screens → components
```

**Hard architecture rules** (also in memory file `project_chemreact_architecture.md`):

1. **Never** put `style="..."` inline in screen JS. Use a primitive or a class.
2. **Never** hardcode hex colors anywhere except `styles/tokens.css`. Use `var(--accent)`, `var(--card)`, etc.
3. All screen rules scoped to `#screen-<name>`.
4. JS contracts for primitives never change — restyling means editing `styles/primitives.css` only.
5. Logic layer is UI-free — `core/state.js`, `core/eventBus.js`, `core/nav.js`, `core/trackerMock.js` import zero DOM.
6. Screens consume primitives + utility classes.

---

## 3. What's shipped (by area)

### 3a. Data

`data/elements.json` — **30 elements** (H, He, Li, Be, B, C, N, O, F, Ne, Na, Mg, Al, Si, P, S, Cl, Ar, K, Ca, Fe, Cu, Zn, Br, I, Ag, Au, Hg, Pb, Ba). Each has `z, mass, group, period, category, phase, color, cpkColor, electroneg, config, mp, bp, discovered, tier, facts, uses, animationProfile`.

`data/compounds.json` — **67 compounds** including all common Class 10/11 syllabus pieces (oxides, chlorides, organics, sulfates, nitrates, hydroxides). Each has `formula, name, components, category, phase, molarMass, uses, facts, animationProfile`.

`data/reactions.json` — **54 reactions** with extended schema. Includes:
- Synthesis (element + element → compound)
- Decomposition (with `trigger: 'heat' | 'light' | 'electricity'`)
- Single + double displacement
- Acid-base neutralisation
- Combustion of compounds
- `cardTriggerable: bool` — flags reactions that the AR card-proximity mechanic can fire (pure-element reactants only).

`data/molecules.json` — **89 entries** with 3D atomic positions and bond data (atoms array of `{el, x, y, z}`, bonds array of `{a, b, order}`). Covers all 67 compounds plus standalone elements.

### 3b. Screens (all 9 functional)

| Screen | File | Status |
|---|---|---|
| splash | `screens/splash.js` + `styles/screens/splash.css` | **Polished** — ASCII chemistry-symbol atom hero (pulse + vignette + nuclear spark + CRT-like effects + chrome on top) |
| home | `screens/home.js` | Functional — bento grid, daily quest, mascot mounted |
| scan | `screens/scan.js` | Functional — uses AR tracker via deps |
| reaction | `screens/reaction.js` | Functional — shows triggered reactions |
| library | `screens/library.js` | Functional — periodic-table grid for all 30 elements with filters |
| elementDetail | `screens/elementDetail.js` | Functional — per-element info screen |
| journal | `screens/journal.js` | Functional — discovery log |
| onboarding | `screens/onboarding.js` | Functional — first-time user flow |
| cardAR | `screens/cardAR.js` | Functional — preview screen for AR card overlay |

### 3c. Splash screen — the polished hero

`screens/splash.js` + `styles/screens/splash.css` + `components/chemAsciiBg.js`.

A canvas-rendered grid of chemistry symbols (`H, O, C, N, Na, Fe, Cu, H₂O, CO₂, NH₃, ...`) arranged so an **atom shape emerges** from the field. Smooth cyan luminance ramp, slow pulse wave from the atom's nucleus, twinkling background symbols, radial vignette darkening corners. A small SVG metaball atom mark + "ChemReact" wordmark + glass play button overlay on top.

Iterated through **8+ revisions** with the user — final state landed at "8.5/10".

### 3d. Bottom nav — metaball morph

`components/bottomNav.js` + relevant CSS in `components.css`.

Three tabs (Library · Scan FAB · Journal). The active highlight is rendered as **two cyan blobs** merged by an SVG goo filter (stdDev=12 for strong merge). When the user taps a different tab, the second blob spawns at the old tab's position, animates to the new tab via JS rAF tween, while the first blob shrinks at the old position. The goo filter creates a **stretchy metaball "tube"** during transit — like a cell pinching off.

Cyan gradient fill (`#14F0D8 → #00B09B`) so the highlight reads as travelling between tabs, including in/out of the centre FAB.

### 3e. AR backbone (mock + real, auto-detected)

| File | Role |
|---|---|
| `core/ITracker.js` | Contract for trackers — emits `ELEMENT_DETECTED`, `ELEMENT_LOST`, `DISTANCE_CHANGE`. |
| `core/ARTransformProvider.js` | Contract for per-frame 4x4 matrix providers. |
| `core/trackerMock.js` | Dev tracker — synthesises events from dev panel buttons. |
| `core/arTransformMock.js` | Mock matrix provider — drifting fake cards. |
| `core/mindARSession.js` | Real MindAR loader (CDN), camera + controller management. |
| `core/trackerMindAR.js` | ITracker impl backed by MindAR. Includes proximity-distance computation. |
| `core/arTransformMindAR.js` | ARTransformProvider impl backed by MindAR. |
| `core/arBootstrap.js` | Auto-detects: HEAD-probes `assets/targets/cards.mind`. If present → real AR. Falls back to mock. Honours `?ar=1` / `?ar=0`. |
| `assets/targets/index.json` | targetIndex → elementId mapping for MindAR. |
| `assets/targets/_README.md` | Instructions for compiling `.mind` from card photos. |

### 3f. COMBINE / proximity-bonding logic

`core/combineLogic.js` — listens for `DISTANCE_CHANGE` from the tracker. When two active elements drop below a threshold, looks up `cardTriggerable` reactions in `reactions.json` whose reactants match the element pair. Emits `COMBINE` and `REACTION_DONE` events. Also emits `REACTION_BROKEN` when cards separate. Wired in `main.js`.

### 3g. Other systems

- **Audio bridge** (`core/audioBridge.js`) — Web Audio for celebration/discovery sounds.
- **Celebration** (`components/celebration.js`) — confetti + level-up overlay on discovery.
- **Demo mode** (`core/demoMode.js`) — `?demo=1` URL flag triggers a presentation walkthrough.
- **Mascot** (`components/mascot.js`) — wired into home with default expression + tap-to-react hooked to DISCOVERY events.
- **Cyberpunk glitch toasts** — error/warn toasts get RGB-split ghost text (magenta + cyan) + scanline overlay + filter flicker.

### 3h. PWA infrastructure

- `manifest.webmanifest` — PWABuilder-ready (name, short_name, description, start_url, scope, display_override, icons × 4, categories, shortcuts).
- `service-worker.js` v3 — pre-caches ~85 entries (every JS module, CSS, JSON), runtime caches data with stale-while-revalidate, CDN with network-first.
- `index.html` — all required meta tags (viewport, apple-mobile-web-app, theme-color, manifest link, icons).
- SW auto-unregisters on `localhost` so dev iteration works without cache headaches.

### 3i. Orbital module (dormant — `3d/orbitals/`)

**NOT wired into main.js or any screen.** Importable but parked for later.

| File | Role |
|---|---|
| `electronConfig.js` | `parseConfig(string)` expands `[He]`/`[Ne]`/`[Ar]`/`[Kr]`/`[Xe]`/`[Rn]` shorthand, returns sorted `[{n, l, count}]` |
| `orbitalShapes.js` | `buildSubshellGroup(l, material)` — s sphere, p three perpendicular dumbbells, d cloverleaf + dz² ring, f octant lobes |
| `orbitalModel.js` | `createOrbitalModel(element, opts)` — quantum-mechanical orbital model (textbook representation) |
| `bohrModel.js` | `createBohrModel(element, opts)` — classical Bohr planetary model |
| `index.js` | Barrel export |
| **`elements.js`** | `BOHR_ELEMENTS` database for **28 elements** with pre-computed `shellCounts`, `valenceShell`, `valenceCount`, `energyLevels` |
| **`buildAtom.js`** | `buildBohrAtom(elementData, env, opts)` — generic Bohr factory, replaces hardcoded nitrogen |
| **`visualPolish.js`** | `setupBloomComposer`, `makeAtomShadow`, `makeCaustics` |
| **`pedagogy.js`** | `PedagogyLayer` class — electron transitions, energy labels, valence pulse, Bohr↔QM toggle |
| **`interactions.js`** | `attachInteractions` — sphere tap, card tap (ionize), long-press explode, pinch zoom |

### 3j. Previews (3d/orbitals/*.html)

| File | What it shows | file:// safe? |
|---|---|---|
| `demo.html` | Element picker pulled from `data/elements.json`, QM orbital view | No (uses ES modules + fetch) |
| `gallery.html` | 4 small canvases (s/p/d/f individual) + 1 big (assembled atom for 9 elements) | **Yes** — inline logic, no imports |
| `bohrN.html` | Classical Bohr nitrogen viewer with floating info labels | **Yes** |
| `bohrN-ar.html` | AR card mock with glass spheres, 3D ring labels, scan-in animation | **Yes** |
| `bohr-mock.html` | **The big one.** Multi-element (28 elements), glass + bloom + pedagogy + interactions | Partially — needs server for sibling `<script src>` loads on stricter browsers |

---

## 4. Notable design decisions and trade-offs

| Decision | Reason |
|---|---|
| **Vanilla JS PWA, no build step** | Ships fast, works offline, low engineering cost, easy for design students to maintain. Unity attempt was scrapped — 87 scripts, 0 prefabs, looked like wireframes. |
| **No AI in shipped app** | Pedagogically deterministic. No LLM hallucination on chemistry facts. Class 10/11 material is well-established and doesn't benefit from generative AI. |
| **Splash visual: ASCII chemistry-symbol atom** | Original. Most chem apps default to "Duolingo gamified". This stands out and is on-theme. |
| **Bohr vs QM in orbital module** | Both implemented. Bohr is what NCERT shows Class 9-10; QM is what Class 11 transitions to. The bohr-mock has a toggle so a student can see the same atom both ways. |
| **Glass spheres (MeshPhysicalMaterial)** | The "wow" upgrade for the AR mock. Required a procedural cube envMap (no HDR file under file://) and ACES tone mapping. |
| **Fake-bloom shim instead of UnrealBloomPass** | Three.js v0.160.0 dropped the legacy `/examples/js/` classic-script builds. The /jsm/ ES modules don't load under classic `<script>` tags. Custom WebGLRenderTarget + ShaderMaterial pipeline. |
| **Bohr radius compression** | Strict r ∝ n² puts the L shell 4× the K shell, which is too extreme for visualisation. We compressed to ~2.35× ratio and flagged the trade-off in code comments. |
| **Bohr ω ∝ 1/n³ → softened to 1/n^1.6** | Strict scaling makes outer shells nearly stationary. We softened so the L shell still visibly moves. |
| **Server bound to 0.0.0.0** | So you can preview on phone/another device on the same Wi-Fi via `http://192.168.0.226:8090/...` |

---

## 5. Repository state

```
4 branches: main (origin tracked)
~10 commits on main, all pushed to origin/main
Latest: c0e9bac — Bohr mock multi-element with glass + pedagogy + interactions
Earlier highlights:
  636206d  AR card mock with glass spheres
  522c932  Bohr nitrogen viewer
  c78df28  Cyberpunk glitch toasts
  4f1a4f1  Phase 1+2 data + AR + cleanup (parallel agent work)
  Initial: full PWA scaffolding
```

**Backups:**
- `D:/chemreact-pwa-backups/2026-04-28-pre-autonomous/` — start of autonomous block
- `D:/chemreact-pwa-backups/2026-04-28-phase2-complete/` — after parallel-agent expansion
- `D:/chemreact-pwa-backups/bohr-model-mock/` — Bohr mock starting point

---

## 6. How to run / preview

**Start the dev server** (from project root):
```bash
python -m http.server 8090 --bind 0.0.0.0
# OR via Claude's preview tool — uses launch.json with no-cache headers
```

**Then open in any browser:**

| URL | What it is |
|---|---|
| `http://localhost:8090/` | The actual app — splash + bnav + all screens |
| `http://localhost:8090/3d/orbitals/bohr-mock.html` | **The big Bohr mock** — 28 elements, glass, pedagogy, interactions |
| `http://localhost:8090/3d/orbitals/bohrN-ar.html` | Nitrogen-only AR card mock with glass |
| `http://localhost:8090/3d/orbitals/gallery.html` | s/p/d/f individual + assembled atom (file://-safe too) |
| `http://localhost:8090/3d/orbitals/demo.html` | QM orbital element picker |

**file:// safe (no server needed) — double-click these:**
- `D:/chemreact-pwa/3d/orbitals/gallery.html`
- `D:/chemreact-pwa/3d/orbitals/bohrN.html`
- `D:/chemreact-pwa/3d/orbitals/bohrN-ar.html`

**To test on phone / LAN:**
The server binds to `0.0.0.0:8090`, so from a device on the same Wi-Fi:
```
http://192.168.0.226:8090/
```
(replace IP with your machine's LAN IP — `ipconfig` to find it).

**Keyboard shortcuts in `bohr-mock.html`:**
- `E` — energy level labels
- `V` — valence shell pulse
- `M` — Bohr ↔ QM toggle
- `T` — trigger electron transition
- `R` — restore (un-ionize)
- `X` — explode atom

---

## 7. What's pending (roughly 18-20% of total project)

### Code side (small)
- Two-card combine preview (place 2 element cards → bond animation → compound from `molecules.json`). The hooks exist (`combineLogic.js`, `cardTriggerable` in reactions, MindAR multi-target session). The animation glue is what's missing.
- Smoke tests / state machine validation.
- Performance audit on real Android device.
- Code cleanup pass for any lingering inline styles.

### Content side (yours, blocking ship)
- **Print-ready card design** (~6-8h). Each card needs visually distinct artwork — not just a symbol on plain background. MindAR's image matcher needs feature richness.
- **Compile `.mind` file** from card photos using https://hiukim.github.io/mind-ar-js-doc/tools/compile/. Drop into `assets/targets/cards.mind`. Then `arBootstrap.js` auto-switches from mock → real.
- **Mascot illustration** (~2-3h). Code mounting exists; just needs the asset.
- **Pitch / process video** (~3-5h).
- **Real-device APK testing**: PWABuilder.com → upload manifest → generate APK → install on Android → test scan flow.
- **Process documentation**: writeup of the design research methodology.

---

## 8. Memory files (persist across Claude sessions)

`C:\Users\Kunal\.claude\projects\D--New-folder\memory\`

| File | What it tracks |
|---|---|
| `MEMORY.md` | Index — pointers to all memory files |
| `user_role.md` | Kunal's role, project context |
| `project_chemreact_ar.md` | Project goal, stack, deadlines, day-by-day plan |
| `project_chemreact_architecture.md` | Architecture rules, file layout, primitive APIs |
| `project_chemreact_session_state.md` | Current UI direction, recent changes, open issues |
| `project_pravasi_probe.md` | Other coursework project context |
| `feedback_autonomous.md` | "Pick sensible defaults, don't pause for routine confirmations" |
| `reference_blender.md` | Blender install + MCP config |

---

## 9. How to continue this work

**Easiest path — open a new Claude conversation:**
1. Memory files auto-load — Claude knows the project context immediately.
2. Just say `continue chemreact` or `pick up where we left off`.
3. The git log + this PROJECT_LOG.md cover the rest.

**To resume in the same session:**
- `claude --resume` (in your terminal) → pick the previous session.
- Or `claude --continue` to resume the latest.

**To onboard a fresh tool / human:**
- Send them this file + the GitHub URL.
- Ask them to read `core/ITracker.js` + `core/ARTransformProvider.js` first — those define the contract everything else implements.
- Then `screens/splash.js` to see the architecture in practice.
- Then `3d/orbitals/bohr-mock.html` for the most-recent visual work.

---

## 10. Quick verbal summary (for if you're in a hurry)

> "ChemReact is a Class 10/11 chemistry board-game-plus-AR-app for IIT Delhi. Vanilla-JS PWA, no build step, 28 elements in the database, MindAR for camera tracking with a mock fallback that auto-detects when targets are missing. The splash screen is an ASCII-chemistry-symbol atom that emerges from a grid of element symbols. The bottom nav has a stretchy cyan metaball that travels between tabs. The orbital module under `3d/orbitals/` has 4 working previews — the headline one is `bohr-mock.html` which renders any of 28 elements as a glass-sphere Bohr atom with bloom, pedagogical features (electron transitions, energy labels, valence pulse, Bohr↔QM toggle), and gestures (tap to ionize, long-press to explode). About 80% complete. The remaining 20% is mostly physical content work — printing cards, compiling a `.mind` target file, drawing the mascot, pitch video, real-device APK testing."

---

*Last updated: 2026-04-30. Generated by Claude (Opus 4.7) at the end of an autonomous work block. If you're a future Claude session reading this — welcome. The user is Kunal Sharma, a design student. He values autonomous execution, dark-cyan aesthetic, and decisive iteration over committee-design. Don't pause for routine confirmations during builds. Make sensible defaults, ship, then iterate.*

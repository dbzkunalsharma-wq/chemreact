# AR target compilation

The real MindAR tracker activates when this folder contains a compiled `.mind`
file plus a matching `index.json` mapping anchor indices to element symbols.

## What you provide

For each element card you want the app to recognise, capture **one clean
photo** of the card front:

- 1024×1024 ish, well-lit, no glare
- Plain background or the actual card stock
- One image per element (H, O, C, ...)

## How to compile

1. Go to **<https://hiukim.github.io/mind-ar-js-doc/tools/compile/>**
2. Upload all card images **in the same order** as the `targets[]` array in
   `index.json` (currently: H, O, C, N, Na, Cl, Mg, Ca, Al, Fe, Cu, Zn).
3. Click **Compile**, wait for the scan-strength preview.
4. Click **Download** — saves `targets.mind`.
5. Rename to `cards.mind` and drop into this folder, alongside this README.

## Wire-up

Nothing else. The app HEAD-probes `cards.mind` on boot:

- **File present** → real MindAR tracker starts, camera prompts.
- **File absent** → mock tracker (current state).

To force one or the other regardless of file presence:

- `?ar=1` in URL — force real (will fall back with a toast if anything fails)
- `?ar=0` — force mock

## index.json

The 12 entries in `index.json` are a starting set covering the most-tested
Class 10/11 elements. To add more:

1. Compile additional images at the END of your image list (preserve order).
2. Add new `{ "index": N, "elementId": "Sym", "label": "Name" }` entries.
3. The `elementId` MUST match a key in `data/elements.json`.

If you reorder the image list during compilation, you MUST update every
`index` field to match — anchor indices are positional, not by filename.

## Tuning

If detection feels jumpy or laggy, edit `core/mindARSession.js`:

- `filterMinCF` (default 0.0001) — lower = more responsive, more jitter
- `filterBeta` (default 0.001) — higher = smoother, more lag
- `warmupTolerance` (default 5) — frames before "found" fires
- `missTolerance` (default 5) — frames before "lost" fires

For COMBINE proximity threshold (how close cards trigger reactions), edit
`core/trackerMindAR.js` `PROXIMITY_THRESHOLD` (default 0.6 world units —
calibrate once you've measured against your printed card size).

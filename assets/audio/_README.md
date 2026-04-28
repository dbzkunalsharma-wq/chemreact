ChemReact audio assets

Today: All sounds are PROCEDURAL via Web Audio API in core/audioMock.js.
No files needed in this folder. App is silent until the user taps (browser
autoplay policy). audioBridge.js wires the first pointerdown/keydown/touchstart
to audio.init() automatically.

------------------------------------------------------------------------
Later: Drop real audio files (mp3/ogg, ~200KB each) into this folder, named:

  ui-tap.ogg
  ui-toggle.ogg
  ui-error.ogg
  scan-detect.ogg
  scan-lose.ogg
  scan-scanline.ogg
  reaction-combine.ogg
  reaction-success.ogg
  reaction-fail.ogg
  discovery-element.ogg
  discovery-compound.ogg
  discovery-levelup.ogg
  ambient-lab.ogg          (loopable, ~30s)

Then in core/audioBridge.js change:
  import audio from './audioMock.js';
to:
  import audio from './audioFile.js';

No other code changes needed.

------------------------------------------------------------------------
Optional: override the default filename map by adding _index.json here:

  {
    "ui.tap": "tap-v2.mp3",
    "discovery.levelup": "fanfare-final.ogg"
  }

Keys are sound IDs (see core/IAudio.js -> SOUND_IDS), values are filenames
relative to this folder. Unlisted sounds fall back to the defaults above.

------------------------------------------------------------------------
Sound design guidance for kids' education app:
- Keep all SFX under 400ms except level-up fanfare (~1.2s) and ambient (loop).
- Master volume is hard-capped at 0.4 in code — design samples to peak around
  -3 dBFS so the cap doesn't crush dynamics.
- Avoid harsh transients above 8 kHz; small phone speakers exaggerate them.
- ambient-lab.ogg should be SEAMLESSLY loopable — encode at the same sample
  rate as the rest, no silence padding at start/end.
- Prefer .ogg over .mp3 for size; both are fine in modern PWAs.

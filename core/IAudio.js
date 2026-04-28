// IAudio.js — audio interface. Implementations must match this shape.
// Today: audioMock.js (procedural via WebAudio).  Later: audioFile.js (mp3/ogg samples).
//
// All implementations export a default object with these methods:
//   init(opts)           — must run after a user gesture (browsers block AudioContext otherwise)
//   play(soundId, opts)  — fire-and-forget. opts: { volume?, pitch?, pan? }
//   stop(soundId)        — stop any active loop
//   setMuted(bool)
//   isReady()            — returns true after init succeeded
//
// Standard sound IDs:
//   ui.tap, ui.toggle, ui.error
//   scan.detect, scan.lose, scan.scanline
//   reaction.combine, reaction.success, reaction.fail
//   discovery.element, discovery.compound, discovery.levelup
//   ambient.lab (loopable)
//
// Screens NEVER import implementations directly — the audioBridge owns the only import.

export const AUDIO_API = ['init', 'play', 'stop', 'setMuted', 'isReady'];

export const SOUND_IDS = [
  'ui.tap', 'ui.toggle', 'ui.error',
  'scan.detect', 'scan.lose', 'scan.scanline',
  'reaction.combine', 'reaction.success', 'reaction.fail',
  'discovery.element', 'discovery.compound', 'discovery.levelup',
  'ambient.lab'
];

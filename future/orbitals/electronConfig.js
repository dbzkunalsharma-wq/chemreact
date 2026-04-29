// electronConfig.js — parse element electron configs into a flat shell list.
//
// Accepts the same string format used in data/elements.json:
//   "1s1", "[He]2s1", "[Ne]3s2 3p1", "[Ar]3d6 4s2", "[Xe]4f14 5d10 6s2 6p2"
//
// Returns an ordered array of { n, l, count } where:
//   n     = principal quantum number (1..7)
//   l     = subshell symbol ('s'|'p'|'d'|'f')
//   count = electron count in that subshell (1..14)
//
// Noble-gas shorthand expansion is hardcoded — no recursion, no surprises.

const NOBLE_CORES = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  Xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  Rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6 4f14 5d10 6s2 6p6'
};

const SUBSHELL_RE = /^(\d)([spdf])(\d{1,2})$/;

export function parseConfig(configString) {
  if (!configString || typeof configString !== 'string') return [];
  let cfg = configString.trim();

  // Expand the noble-gas shorthand if present.
  const m = cfg.match(/^\[([A-Z][a-z]?)\]\s*(.*)$/);
  if (m) {
    const core = NOBLE_CORES[m[1]];
    cfg = (core ? core + ' ' : '') + m[2];
  }

  const shells = [];
  for (const tok of cfg.split(/\s+/)) {
    const sm = tok.match(SUBSHELL_RE);
    if (!sm) continue;
    shells.push({ n: parseInt(sm[1], 10), l: sm[2], count: parseInt(sm[3], 10) });
  }

  // Sort by (n + l-priority) so the visual stack reads outward by energy level.
  const L_ORDER = { s: 0, p: 1, d: 2, f: 3 };
  shells.sort((a, b) => (a.n - b.n) || (L_ORDER[a.l] - L_ORDER[b.l]));
  return shells;
}

// Maximum electrons a subshell can hold — used to drive opacity / fill level.
export function subshellCapacity(l) {
  return { s: 2, p: 6, d: 10, f: 14 }[l] || 0;
}

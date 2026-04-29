// electronConfig.js — parse element electron configurations into shell data.
//
// Accepts strings like:
//   "1s1"
//   "[He]2s1"
//   "[Ne]3s2 3p1"
//   "[Ar]3d6 4s2"
//   "[Xe]4f14 5d10 6s2 6p2"
//
// Returns sorted array of { n, l, count } ordered by (n asc, then l-priority
// s<p<d<f) so the visual stack reads outward by shell number primarily — the
// orbital model uses this order for layered radii.

// Full expansions of every noble-gas core, by (n, l) order.
const NOBLE_CORES = {
  He: '1s2',
  Ne: '1s2 2s2 2p6',
  Ar: '1s2 2s2 2p6 3s2 3p6',
  Kr: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6',
  Xe: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 5s2 5p6',
  Rn: '1s2 2s2 2p6 3s2 3p6 3d10 4s2 4p6 4d10 4f14 5s2 5p6 5d10 6s2 6p6'
};

const L_PRIORITY = { s: 0, p: 1, d: 2, f: 3 };
const SUBSHELL_CAPACITY = { s: 2, p: 6, d: 10, f: 14 };

const TOKEN_RE = /^(\d)([spdf])(\d{1,2})$/;
const NOBLE_RE = /\[(He|Ne|Ar|Kr|Xe|Rn)\]/g;

export function subshellCapacity(l) {
  return SUBSHELL_CAPACITY[l];
}

export function parseConfig(input) {
  if (!input || typeof input !== 'string') return [];
  // Expand noble-gas shorthand inline. Replace each [X] with the X core
  // expansion followed by a space so subsequent tokens stay separated.
  let s = input.trim().replace(NOBLE_RE, (_, sym) => NOBLE_CORES[sym] + ' ');
  s = s.replace(/\s+/g, ' ').trim();
  if (!s) return [];

  const tokens = s.split(' ').filter(Boolean);
  const shells = [];
  for (const tok of tokens) {
    const m = tok.match(TOKEN_RE);
    if (!m) continue;                     // skip unrecognised tokens silently
    shells.push({
      n: parseInt(m[1], 10),
      l: m[2],
      count: parseInt(m[3], 10)
    });
  }
  shells.sort((a, b) => a.n - b.n || L_PRIORITY[a.l] - L_PRIORITY[b.l]);
  return shells;
}

// periodicTile.js — periodic-table-style icon.
//
// Mini tile that mirrors classic textbook periodic-table cell:
//   - atomic number top-left (italic, small)
//   - big bold symbol (white, dominant)
//   - element name bottom (italic, small)
//   - rounded-square dark surface
//
// Used for element icons (home chips, library grid, reaction reactant icons).
// For compounds, pass `{ symbol: 'H₂O', name: 'Water' }` (no number).
//
// usage:
//   const t = mountPeriodicTile(parent, { number: 6, symbol: 'C', name: 'Carbon', size: 56, accent: '#909090' });
//   t.update({ symbol: 'O' });
//   t.unmount();
//
// styling lives in styles/components/periodicTile.css

export function mountPeriodicTile(parent, {
  number = null,
  symbol = '?',
  name   = '',
  size   = 56,
  accent = null,           // optional border/glow color (defaults to subtle white)
  variant = 'dark'         // 'dark' | 'tinted' | 'glass'
} = {}) {
  const el = document.createElement('div');
  el.className = `pt-tile pt-tile-${variant}`;
  el.style.setProperty('--pt-size', `${size}px`);
  if (accent) el.style.setProperty('--pt-accent', accent);

  el.innerHTML = `
    ${number != null ? `<div class="pt-num">${number}</div>` : ''}
    <div class="pt-sym">${symbol}</div>
    ${name ? `<div class="pt-name">${name}</div>` : ''}
  `;

  parent.appendChild(el);

  return {
    el,
    update({ number: n, symbol: s, name: nm, accent: ac } = {}) {
      if (n != null)  el.querySelector('.pt-num')?.replaceChildren(document.createTextNode(String(n)));
      if (s != null)  el.querySelector('.pt-sym').textContent = s;
      if (nm != null) {
        const nameEl = el.querySelector('.pt-name');
        if (nameEl) nameEl.textContent = nm;
      }
      if (ac) el.style.setProperty('--pt-accent', ac);
    },
    unmount() { el.remove(); }
  };
}

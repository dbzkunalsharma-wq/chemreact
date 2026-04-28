// journal.js — list of discoveries grouped by recency.

import { mountPeriodicTile } from '../components/periodicTile.js';

export function mountJournalScreen(container, deps) {
  const { bus, EVENTS, state, elements, compounds } = deps;

  const cellListeners = [];
  function clearCellListeners() {
    cellListeners.forEach(fn => { try { fn(); } catch (_e) {} });
    cellListeners.length = 0;
  }

  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60)   return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60)   return `${min}m ago`;
    const hr  = Math.floor(min / 60);
    if (hr  < 24)   return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7)    return `${day}d ago`;
    return new Date(ts).toLocaleDateString();
  }

  // Convert "#RRGGBB" to "rgba(r,g,b,a)" for periodic-tile accent.
  function hexA(hex, a = 1) {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function bucketFor(ts) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86400000;
    const startOfWeek = startOfToday - 6 * 86400000;
    if (ts >= startOfToday)     return 'Today';
    if (ts >= startOfYesterday) return 'Yesterday';
    if (ts >= startOfWeek)      return 'This Week';
    return 'Earlier';
  }

  function render() {
    clearCellListeners();
    const journal = (state.get().journal || []).slice().sort((a, b) => (b.when || 0) - (a.when || 0));

    container.innerHTML = `
      <div class="lib-top">
        <div class="lib-head">
          <div>
            <div class="lib-title">Discovery Journal</div>
            <div class="lib-sub">Every element and reaction you've found</div>
          </div>
          <div class="lib-count">${journal.length}</div>
        </div>
      </div>

      <div class="edet-back" data-act="back" style="position:absolute;top:calc(40px + var(--safe-t));left:20px;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </div>

      <div class="scroll">
        <div data-list style="padding:8px 20px calc(120px + var(--safe-b));"></div>
      </div>
    `;

    const listHost = container.querySelector('[data-list]');
    const backBtn  = container.querySelector('[data-act="back"]');

    const onBack = () => bus.emit(EVENTS.NAV_TO, 'home');
    backBtn.addEventListener('click', onBack);
    cellListeners.push(() => backBtn.removeEventListener('click', onBack));

    if (journal.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 24px;gap:14px;text-align:center;';
      empty.innerHTML = `
        <div style="font-size:56px;">🔬</div>
        <div style="font-size:15px;font-weight:700;color:var(--text);">No discoveries yet</div>
        <div style="font-size:12px;color:var(--muted);max-width:240px;line-height:1.5;">Scan a card to log your first element or reaction. Every discovery is saved here.</div>
        <button class="filter-tab active" data-act="scan" style="padding:11px 24px;font-size:13px;">📷 Scan a card</button>
      `;
      listHost.appendChild(empty);
      const scanBtn = empty.querySelector('[data-act="scan"]');
      const onScan = () => bus.emit(EVENTS.NAV_TO, 'scan');
      scanBtn.addEventListener('click', onScan);
      cellListeners.push(() => scanBtn.removeEventListener('click', onScan));
      return;
    }

    // Bucket entries.
    const buckets = { 'Today': [], 'Yesterday': [], 'This Week': [], 'Earlier': [] };
    journal.forEach(entry => {
      buckets[bucketFor(entry.when || 0)].push(entry);
    });

    Object.entries(buckets).forEach(([label, items]) => {
      if (items.length === 0) return;
      const sec = document.createElement('div');
      sec.style.cssText = 'margin-top:18px;';
      const h = document.createElement('div');
      h.className = 'edet-box-t';
      h.style.cssText = 'margin-bottom:8px;color:var(--muted);';
      h.textContent = label;
      sec.appendChild(h);

      items.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'rxn-card';
        card.style.marginBottom = '8px';

        let formula, name, tileNumber, tileSymbol, tileName, tileAccent;
        if (entry.type === 'compound') {
          const c = compounds?.[entry.id] || {};
          formula    = c.formula || entry.id;
          name       = c.name || entry.id;
          tileNumber = null;                   // compounds don't have atomic numbers
          tileSymbol = formula;
          tileName   = c.name || '';
          tileAccent = 'rgba(0, 229, 204, 0.4)';
        } else {
          const e = elements?.[entry.id] || {};
          formula    = entry.id;
          name       = e.name || entry.id;
          tileNumber = e.z;
          tileSymbol = entry.id;
          tileName   = e.name || '';
          tileAccent = e.cpkColor ? hexA(e.cpkColor, 0.45) : 'rgba(0, 229, 204, 0.4)';
        }

        // Build inner structure (icon slot + info + arrow)
        const iconSlot = document.createElement('div');
        iconSlot.className = 'rc-icon-slot';
        card.appendChild(iconSlot);

        const info = document.createElement('div');
        info.className = 'rc-info';
        info.innerHTML = `
          <div class="rc-formula">${formula}</div>
          <div class="rc-name">${name} · ${timeAgo(entry.when || Date.now())}</div>
          <div class="rc-tags">
            <div class="rc-tag accent">${entry.type === 'compound' ? 'Reaction' : 'Element'}</div>
          </div>
        `;
        card.appendChild(info);

        const arrow = document.createElement('div');
        arrow.className = 'rc-arrow';
        arrow.textContent = '›';
        card.appendChild(arrow);

        // Mount periodic tile inside the icon slot
        const tileVariant = entry.type === 'compound' ? 'tinted pt-tile-compound' : 'dark';
        mountPeriodicTile(iconSlot, {
          number: tileNumber,
          symbol: tileSymbol,
          name:   tileName,
          size:   60,
          accent: tileAccent,
          variant: tileVariant
        });

        const handler = () => {
          if (entry.type === 'compound') {
            state.set({ lastReaction: entry.id });
            bus.emit(EVENTS.NAV_TO, 'reaction');
          } else {
            state.set({ selectedElement: entry.id });
            bus.emit(EVENTS.NAV_TO, 'elementDetail');
          }
        };
        card.addEventListener('click', handler);
        cellListeners.push(() => card.removeEventListener('click', handler));
        sec.appendChild(card);
      });

      listHost.appendChild(sec);
    });
  }

  // Re-render when discovery happens.
  const offDiscovery = bus.on(EVENTS.DISCOVERY, () => render());

  render();

  return {
    unmount() {
      offDiscovery();
      clearCellListeners();
    },
    refresh() { render(); }
  };
}

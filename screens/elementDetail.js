// elementDetail.js — full info card for one element with hero gradient, properties, reactions.

export function mountElementDetailScreen(container, deps) {
  const { bus, EVENTS, state, elements, reactions, compounds } = deps;

  const id = state.get().selectedElement || 'H';
  const el = (elements && elements[id]) || null;

  if (!el) {
    container.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--muted);gap:12px;">
        <div style="font-size:48px;">⚛️</div>
        <div>Element not found.</div>
        <button class="filter-tab" data-act="back">Back</button>
      </div>`;
    const back = container.querySelector('[data-act="back"]');
    const onBack = () => bus.emit(EVENTS.NAV_TO, 'library');
    back.addEventListener('click', onBack);
    return {
      unmount() { back.removeEventListener('click', onBack); },
      refresh() {}
    };
  }

  const favs = state.get().favoriteElements || [];
  const isFav = favs.includes(id);

  const phaseLabel = (el.phase || '').replace(/^./, c => c.toUpperCase());
  const eneg = el.electroneg == null ? '—' : String(el.electroneg);

  // Pre-compute reactions involving this element.
  const involvingReactions = (reactions?.reactions || []).filter(r => Object.keys(r.reactants || {}).includes(id));

  container.innerHTML = `
    <div class="edet-top">
      <div class="edet-back" data-act="back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      </div>
      <div class="spacer"></div>
      <div class="edet-fav${isFav ? ' on' : ''}" data-act="fav">${isFav ? '⭐' : '☆'}</div>
    </div>

    <div class="edet-hero">
      <div class="edet-card" style="--ecol:${el.cpkColor || '#0D7377'};">
        <div class="edet-card-top">
          <div class="edet-no">No. ${el.z}</div>
          <div class="edet-grp">${(el.category || 'element').toUpperCase()}</div>
        </div>
        <div class="edet-sym">${id}</div>
        <div class="edet-nm">${el.name}</div>
        <div class="edet-ms">${el.mass} u · ${phaseLabel}</div>
      </div>
    </div>

    <div class="scroll">
      <div class="edet-scroll">
        <div class="edet-box">
          <div class="edet-box-t">ABOUT</div>
          <div class="edet-desc">${(el.facts || []).join(' ')}</div>
        </div>

        <div class="edet-box">
          <div class="edet-box-t">PROPERTIES</div>
          <div class="edet-props">
            <div class="edet-prop"><div class="edet-prop-k">Atomic Mass</div><div class="edet-prop-v">${el.mass} u</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Group</div><div class="edet-prop-v">${el.group ?? '—'}</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Period</div><div class="edet-prop-v">${el.period ?? '—'}</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Phase</div><div class="edet-prop-v">${phaseLabel || '—'}</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Melting Pt</div><div class="edet-prop-v">${el.mp ?? '—'} °C</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Boiling Pt</div><div class="edet-prop-v">${el.bp ?? '—'} °C</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Electronegativity</div><div class="edet-prop-v">${eneg}</div></div>
            <div class="edet-prop"><div class="edet-prop-k">Config</div><div class="edet-prop-v">${el.config || '—'}</div></div>
          </div>
        </div>

        <div class="edet-box">
          <div class="edet-box-t">USES</div>
          <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">
            ${(el.uses || []).map(u => `<li style="font-size:13px;color:var(--text2);display:flex;gap:8px;align-items:flex-start;"><span style="color:var(--accent);">•</span><span>${u}</span></li>`).join('') || '<li style="color:var(--muted);font-size:12px;">—</li>'}
          </ul>
        </div>

        <div class="edet-box">
          <div class="edet-box-t">REACTIONS</div>
          <div class="edet-reactions" data-rx-list>
            ${involvingReactions.length === 0 ? '<div style="color:var(--muted);font-size:12px;">No reactions in this dataset.</div>' : ''}
          </div>
        </div>
      </div>
    </div>
  `;

  // Render reaction rows with click handlers.
  const rxListListeners = [];
  const rxList = container.querySelector('[data-rx-list]');
  involvingReactions.forEach(r => {
    const compound = compounds?.[r.product];
    const row = document.createElement('div');
    row.className = 'edet-rx';
    row.innerHTML = `
      <div class="edet-rx-ico" style="background:linear-gradient(135deg,var(--teal),var(--accent));color:white;">⚗️</div>
      <div class="edet-rx-txt">
        <div class="edet-rx-f">${compound?.formula || r.product}</div>
        <div class="edet-rx-n">${compound?.name || r.product} · ${r.balanced}</div>
      </div>
      <div style="color:var(--muted);font-size:18px;">›</div>
    `;
    const handler = () => {
      state.set({ lastReaction: r.product });
      bus.emit(EVENTS.NAV_TO, 'reaction');
    };
    row.addEventListener('click', handler);
    rxListListeners.push(() => row.removeEventListener('click', handler));
    rxList.appendChild(row);
  });

  // Bind back + fav.
  const backBtn = container.querySelector('[data-act="back"]');
  const favBtn  = container.querySelector('[data-act="fav"]');

  const onBack = () => bus.emit(EVENTS.NAV_TO, 'library');
  const onFav  = () => {
    const cur = state.get().favoriteElements || [];
    let next;
    if (cur.includes(id)) {
      next = cur.filter(x => x !== id);
      favBtn.classList.remove('on');
      favBtn.textContent = '☆';
    } else {
      next = [...cur, id];
      favBtn.classList.add('on');
      favBtn.textContent = '⭐';
    }
    state.set({ favoriteElements: next });
  };

  backBtn.addEventListener('click', onBack);
  favBtn.addEventListener('click', onFav);

  return {
    unmount() {
      backBtn.removeEventListener('click', onBack);
      favBtn.removeEventListener('click', onFav);
      rxListListeners.forEach(fn => { try { fn(); } catch (_e) {} });
    },
    refresh() { /* static once mounted */ }
  };
}

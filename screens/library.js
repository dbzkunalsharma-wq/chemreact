// library.js — periodic-table-style grid with search + category filters.

export function mountLibraryScreen(container, deps) {
  const { bus, EVENTS, state, elements } = deps;

  const FILTERS = [
    { id: 'all',     label: 'All',        match: () => true },
    { id: 'metal',   label: 'Metals',     match: (el) => /metal|transition|alkali|alkaline|post-transition/.test(el.category || '') && !/nonmetal/.test(el.category || '') },
    { id: 'nonmetal',label: 'Non-metals', match: (el) => el.category === 'nonmetal' || el.category === 'metalloid' },
    { id: 'halogen', label: 'Halogens',   match: (el) => el.category === 'halogen' },
    { id: 'noble',   label: 'Noble',      match: (el) => el.category === 'noble' }
  ];

  let activeFilter = 'all';
  let searchTerm = '';

  container.innerHTML = `
    <div class="lib-top">
      <div class="lib-head">
        <div>
          <div class="lib-title">Elements</div>
          <div class="lib-sub">Tap to inspect — discover their stories</div>
        </div>
        <div class="lib-count" data-count>0</div>
      </div>

      <div class="lib-search">
        <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <input type="search" placeholder="Search by name or symbol…" data-search />
      </div>

      <div class="filter-row" data-filters>
        ${FILTERS.map(f => `<div class="filter-tab${f.id === 'all' ? ' active' : ''}" data-filter="${f.id}">${f.label}</div>`).join('')}
      </div>
    </div>

    <div class="scroll">
      <div class="lib-grid" data-grid></div>
    </div>

    <div class="edet-back lib-back" data-act="back">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
    </div>
  `;

  // Cache.
  const grid     = container.querySelector('[data-grid]');
  const countEl  = container.querySelector('[data-count]');
  const searchEl = container.querySelector('[data-search]');
  const filterRow = container.querySelector('[data-filters]');
  const backBtn  = container.querySelector('[data-act="back"]');

  const cellListeners = [];

  function clearCellListeners() {
    cellListeners.forEach(fn => { try { fn(); } catch (_e) {} });
    cellListeners.length = 0;
  }

  function getFiltered() {
    const q = (searchTerm || '').trim().toLowerCase();
    const filt = FILTERS.find(f => f.id === activeFilter) || FILTERS[0];
    return Object.entries(elements || {}).filter(([id, el]) => {
      if (!filt.match(el)) return false;
      if (!q) return true;
      return id.toLowerCase().includes(q) || (el.name || '').toLowerCase().includes(q);
    });
  }

  function renderGrid() {
    clearCellListeners();
    grid.innerHTML = '';
    const items = getFiltered();
    countEl.textContent = `${items.length} / ${Object.keys(elements || {}).length}`;
    if (items.length === 0) {
      grid.innerHTML = `<div class="lib-empty">No elements match.</div>`;
      return;
    }
    items.forEach(([id, el]) => {
      const cell = document.createElement('div');
      cell.className = 'lib-el';
      // CPK colors are external chem data; fallback for missing values keeps
      // the gradient ring readable. The CSS reads --el-color as well.
      cell.style.setProperty('--el-color', el.cpkColor || 'var(--muted)');
      cell.innerHTML = `
        <div class="lib-el-top">
          <div class="lib-el-num">${el.z}</div>
          <div class="lib-el-mass">${(el.mass || 0).toFixed(2)}</div>
        </div>
        <div class="lib-el-sym">${id}</div>
        <div class="lib-el-name">${el.name}</div>
      `;
      const handler = () => {
        state.set({ selectedElement: id });
        bus.emit(EVENTS.NAV_TO, 'elementDetail');
      };
      cell.addEventListener('click', handler);
      cellListeners.push(() => cell.removeEventListener('click', handler));
      grid.appendChild(cell);
    });
  }

  // ---- Listeners ----
  const onSearch = (e) => { searchTerm = e.target.value || ''; renderGrid(); };
  searchEl.addEventListener('input', onSearch);

  const onFilter = (e) => {
    const tab = e.target.closest('.filter-tab');
    if (!tab) return;
    const id = tab.dataset.filter;
    if (!id) return;
    activeFilter = id;
    filterRow.querySelectorAll('.filter-tab').forEach(t => t.classList.toggle('active', t.dataset.filter === id));
    renderGrid();
  };
  filterRow.addEventListener('click', onFilter);

  const onBack = () => bus.emit(EVENTS.NAV_TO, 'home');
  backBtn.addEventListener('click', onBack);

  renderGrid();

  return {
    unmount() {
      searchEl.removeEventListener('input', onSearch);
      filterRow.removeEventListener('click', onFilter);
      backBtn.removeEventListener('click', onBack);
      clearCellListeners();
    },
    refresh() { renderGrid(); }
  };
}

// home.js — main hub: trainer, daily quest, stats, elements, reactions, quick actions.

export function mountHomeScreen(container, deps) {
  const { bus, EVENTS, state, elements, compounds, reactions } = deps;

  // Try to dynamically grab the optional component mounters. They might not
  // exist yet; we fall back to inline simple chips/cards if they fail to load.
  let mountElementChip = null;
  let mountReactionCard = null;
  // Fire-and-forget dynamic imports.
  const chipImport = import('../components/elementChip.js')
    .then(m => { mountElementChip = m.mountElementChip || null; renderElementsRow(); })
    .catch(() => { /* fallback used */ });
  const cardImport = import('../components/reactionCard.js')
    .then(m => { mountReactionCard = m.mountReactionCard || null; renderReactionsList(); })
    .catch(() => { /* fallback used */ });

  // Layout shell.
  container.innerHTML = `
    <div class="home-top">
      <div class="trainer-row">
        <div class="trainer-ava" data-act="profile">KM</div>
        <div class="trainer-meta">
          <div class="trainer-hi">Welcome back</div>
          <div class="trainer-name">Dr. Kunal <span class="verified" title="Verified Alchemist"></span></div>
        </div>
        <div class="trainer-actions">
          <div class="icon-btn" data-act="notif" title="Notifications">
            <svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 004 0"/></svg>
          </div>
        </div>
      </div>
    </div>

    <div class="scroll home-scroll">
      <div class="sec" style="padding-top:4px;">
        <div class="daily" data-act="daily">
          <div class="daily-chip"><span class="dot"></span>Daily Quest</div>
          <div class="daily-title">Scan <span>2 new cards</span><br>to unlock a reaction</div>
          <div class="daily-sub">Point your camera at any element card to begin. Combine two to discover a molecule.</div>
          <div class="daily-foot">
            <div class="daily-cta">Start Quest <span style="font-size:16px;">→</span></div>
          </div>
        </div>
      </div>

      <div class="bento">
        <!-- Hero: discoveries (2x2 tall) -->
        <div class="bento-tile bento-hero" data-act="stat-el">
          <div class="bento-eyebrow">Discovered</div>
          <div class="bento-hero-num"><span data-stat-el>0</span></div>
          <div class="bento-hero-lbl">Elements</div>
          <div class="bento-hero-glow"></div>
          <div class="bento-arrow">→</div>
        </div>

        <!-- Reactions (1x1) -->
        <div class="bento-tile bento-reactions" data-act="stat-rx">
          <div class="bento-eyebrow">Reactions</div>
          <div class="bento-mid-num"><span data-stat-rx>0</span></div>
        </div>

        <!-- Scanner CTA (4x1 wide) -->
        <div class="bento-tile bento-scanner" data-act="qa-scan">
          <div class="bento-scanner-icon">⊙</div>
          <div class="bento-scanner-text">
            <div class="bento-scanner-title">Open AR Scanner</div>
            <div class="bento-scanner-sub">Hold cards 12-25 cm away</div>
          </div>
          <div class="bento-scanner-arrow">→</div>
        </div>

        <!-- Badges (2x1) -->
        <div class="bento-tile bento-badges" data-act="stat-bd">
          <div class="bento-eyebrow">Badges</div>
          <div class="bento-mid-num"><span data-stat-bd>0</span></div>
        </div>

        <!-- Lab (2x1) -->
        <div class="bento-tile bento-lab" data-act="qa-lab">
          <div class="bento-eyebrow">Lab</div>
          <div class="bento-mid-line">Coming soon</div>
        </div>
      </div>

      <div class="sec">
        <div class="sec-head">
          <div class="sec-title">Your Elements <em>Collected</em></div>
          <div class="sec-link" data-act="el-all">View all →</div>
        </div>
      </div>
      <div class="el-row" data-el-row></div>

      <div class="sec">
        <div class="sec-head">
          <div class="sec-title">Discovered Reactions</div>
          <div class="sec-link" data-act="rx-all">Journal →</div>
        </div>
      </div>
      <div class="rxn-list" data-rxn-list></div>

      <div class="bento bento-2">
        <div class="bento-tile bento-lib" data-act="qa-lib">
          <div class="bento-eyebrow">Library</div>
          <div class="bento-mid-line">Periodic table</div>
          <div class="bento-arrow">→</div>
        </div>
        <div class="bento-tile bento-ach" data-act="qa-ach">
          <div class="bento-eyebrow">Achievements</div>
          <div class="bento-mid-line">Unlock more</div>
          <div class="bento-arrow">→</div>
        </div>
      </div>
    </div>
  `;

  // Cached refs.
  const elRowHost  = container.querySelector('[data-el-row]');
  const rxnHost    = container.querySelector('[data-rxn-list]');
  const statElEl   = container.querySelector('[data-stat-el]');
  const statRxEl   = container.querySelector('[data-stat-rx]');
  const statBdEl   = container.querySelector('[data-stat-bd]');

  // -------- helpers --------
  function renderHeaderState() {
    const s = state.get();
    statElEl.textContent = String((s.inventory?.elements || []).length);
    statRxEl.textContent = String((s.inventory?.compounds || []).length);
    statBdEl.textContent = String((s.badges || []).length);
  }

  function renderElementsRow() {
    elRowHost.innerHTML = '';
    const ids = Object.keys(elements || {}).slice(0, 8);
    const inv = new Set(state.get().inventory?.elements || []);
    ids.forEach(id => {
      const el = elements[id];
      if (!el) return;
      const cell = document.createElement('div');
      const owned = inv.has(id);
      if (mountElementChip) {
        elRowHost.appendChild(cell);
        try {
          mountElementChip(cell, {
            element: { id, ...el, owned },
            onClick: () => {
              state.set({ selectedElement: id });
              bus.emit(EVENTS.NAV_TO, 'elementDetail');
            }
          });
        } catch (_e) {
          renderFallbackChip(cell, id, el, owned);
        }
      } else {
        renderFallbackChip(cell, id, el, owned);
        elRowHost.appendChild(cell);
      }
    });
  }

  function renderFallbackChip(node, id, el, owned) {
    node.className = 'el-chip' + (owned ? '' : ' locked');
    node.style.setProperty('--el-color', el.cpkColor || '#888');
    node.innerHTML = `
      <div class="el-dot" style="background:${el.cpkColor || '#444'};color:#0a0a0a;">${id}</div>
      <div class="el-sym">${el.name}</div>
      <div class="el-num">${el.z}</div>
      <div class="lock">🔒</div>
    `;
    const handler = () => {
      state.set({ selectedElement: id });
      bus.emit(EVENTS.NAV_TO, 'elementDetail');
    };
    node.addEventListener('click', handler);
    listenerCleanups.push(() => node.removeEventListener('click', handler));
  }

  function renderReactionsList() {
    rxnHost.innerHTML = '';
    const list = (reactions || []).slice(0, 4);
    list.forEach(rxn => {
      const compound = compounds?.[rxn.product] || null;
      const cell = document.createElement('div');
      if (mountReactionCard) {
        rxnHost.appendChild(cell);
        try {
          mountReactionCard(cell, {
            reaction: rxn,
            compound,
            onClick: () => {
              state.set({ lastReaction: rxn.product });
              bus.emit(EVENTS.NAV_TO, 'reaction');
            }
          });
        } catch (_e) {
          renderFallbackReaction(cell, rxn, compound);
        }
      } else {
        renderFallbackReaction(cell, rxn, compound);
        rxnHost.appendChild(cell);
      }
    });
  }

  function renderFallbackReaction(node, rxn, compound) {
    node.className = 'rxn-card';
    const formula = compound?.formula || rxn.product;
    const name = compound?.name || rxn.product;
    node.innerHTML = `
      <div class="rc-icon" style="background:linear-gradient(135deg,var(--teal),var(--accent));color:white;">⚗️</div>
      <div class="rc-info">
        <div class="rc-formula">${formula}</div>
        <div class="rc-name">${name}</div>
        <div class="rc-tags">
          <div class="rc-tag accent">${rxn.type || 'reaction'}</div>
          <div class="rc-tag">${rxn.energy || ''}</div>
        </div>
      </div>
      <div class="rc-arrow">›</div>
    `;
    const handler = () => {
      state.set({ lastReaction: rxn.product });
      bus.emit(EVENTS.NAV_TO, 'reaction');
    };
    node.addEventListener('click', handler);
    listenerCleanups.push(() => node.removeEventListener('click', handler));
  }

  // -------- click bindings --------
  const listenerCleanups = [];

  function bindClick(selector, handler) {
    const node = container.querySelector(selector);
    if (!node) return;
    node.addEventListener('click', handler);
    listenerCleanups.push(() => node.removeEventListener('click', handler));
  }

  bindClick('[data-act="profile"]',  () => bus.emit(EVENTS.TOAST, 'Profile coming soon'));
  bindClick('[data-act="notif"]',    () => bus.emit(EVENTS.TOAST, 'No new notifications'));
  bindClick('[data-act="daily"]',    () => bus.emit(EVENTS.NAV_TO, 'scan'));
  bindClick('[data-act="stat-el"]',  () => bus.emit(EVENTS.NAV_TO, 'library'));
  bindClick('[data-act="stat-rx"]',  () => bus.emit(EVENTS.NAV_TO, 'journal'));
  bindClick('[data-act="stat-bd"]',  () => bus.emit(EVENTS.TOAST, 'Achievements coming soon'));
  bindClick('[data-act="el-all"]',   () => bus.emit(EVENTS.NAV_TO, 'library'));
  bindClick('[data-act="rx-all"]',   () => bus.emit(EVENTS.NAV_TO, 'journal'));
  bindClick('[data-act="qa-scan"]',  () => bus.emit(EVENTS.NAV_TO, 'scan'));
  bindClick('[data-act="qa-lib"]',   () => bus.emit(EVENTS.NAV_TO, 'library'));
  bindClick('[data-act="qa-ach"]',   () => bus.emit(EVENTS.TOAST, 'Achievements coming soon'));
  bindClick('[data-act="qa-lab"]',   () => bus.emit(EVENTS.TOAST, '🔬 Lab coming soon'));

  // Re-render when discovery events fire.
  const offDiscovery = bus.on(EVENTS.DISCOVERY, () => { renderHeaderState(); renderElementsRow(); });

  // First paint.
  renderHeaderState();
  renderElementsRow();
  renderReactionsList();

  return {
    unmount() {
      offDiscovery();
      listenerCleanups.forEach(fn => { try { fn(); } catch (_e) {} });
      listenerCleanups.length = 0;
    },
    refresh() {
      renderHeaderState();
      renderElementsRow();
      renderReactionsList();
    }
  };
}

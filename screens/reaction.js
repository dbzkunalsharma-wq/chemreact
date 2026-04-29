// reaction.js — post-combine result screen.
// 3D molecule viewer + USES + FUN FACTS + balanced equation + library CTA.
//
// CONTRACT:
//   - All visuals live in styles/screens/reaction.css under #screen-reaction.
//   - This file uses primitive components + class names only — no inline styles.
//   - Restyle = edit reaction.css alone. JS contracts unchanged.

import {
  mountStack, mountRow,
  mountHeading, mountText,
  mountCard,
  mountIconButton, mountButton, mountPill
} from '../components/primitives/index.js';

export function mountReactionScreen(container, deps) {
  const { bus, EVENTS, state, compounds, reactions, mountMoleculeViewer } = deps;

  const productId = state.get().lastReaction || 'H2O';
  const compound  = (compounds && compounds[productId])
                    || { formula: productId, name: productId, uses: [], facts: [] };
  const reactionList = Array.isArray(reactions) ? reactions : (reactions?.reactions || []);
  const reaction  = reactionList.find(r => r.product === productId) || null;

  container.classList.add('rxn-screen');

  // ── Header (back + formula/name + fav) ──
  const header = document.createElement('div');
  header.className = 'rxn-header';
  container.appendChild(header);

  const back = mountIconButton(header, {
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>',
    ariaLabel: 'Back to home',
    variant: 'filled',
    size: 'md',
    onClick: () => bus.emit(EVENTS.NAV_TO, 'home')
  });

  const titleWrap = document.createElement('div');
  titleWrap.className = 'rxn-title-wrap';
  header.appendChild(titleWrap);
  mountHeading(titleWrap, { level: 2, text: compound.formula });
  mountText(titleWrap, { text: compound.name, variant: 'muted', as: 'div' });

  const fav = mountIconButton(header, {
    icon: '⭐',
    ariaLabel: 'Save to favourites',
    variant: 'filled',
    size: 'md',
    onClick: () => {
      fav.el.classList.toggle('on');
      bus.emit(EVENTS.TOAST, fav.el.classList.contains('on') ? 'Saved to favourites' : 'Removed from favourites');
    }
  });

  // ── 3D molecule viewer host ──
  const viewerHost = document.createElement('div');
  viewerHost.className = 'rxn-viewer';
  viewerHost.dataset.viewer = '';
  container.appendChild(viewerHost);

  // ── Scroll body ──
  const body = document.createElement('div');
  body.className = 'rxn-body';
  container.appendChild(body);

  // USES card
  const usesCard = mountCard(body, { variant: 'default', padding: 'md' });
  mountText(usesCard.el, { text: 'USES', variant: 'label', as: 'div' });
  const usesList = document.createElement('ul');
  usesList.className = 'rxn-list';
  usesCard.el.appendChild(usesList);
  if (compound.uses?.length) {
    for (const u of compound.uses) {
      const li = document.createElement('li');
      li.className = 'rxn-list-item';
      li.innerHTML = `<span class="rxn-list-bullet">•</span><span>${u}</span>`;
      usesList.appendChild(li);
    }
  } else {
    const li = document.createElement('li');
    li.className = 'rxn-list-empty';
    li.textContent = 'No data yet.';
    usesList.appendChild(li);
  }

  // FUN FACTS card
  const factsCard = mountCard(body, { variant: 'default', padding: 'md' });
  mountText(factsCard.el, { text: 'FUN FACTS', variant: 'label', as: 'div' });
  const factsList = document.createElement('ul');
  factsList.className = 'rxn-list';
  factsCard.el.appendChild(factsList);
  if (compound.facts?.length) {
    for (const f of compound.facts) {
      const li = document.createElement('li');
      li.className = 'rxn-list-item rxn-list-fact';
      li.innerHTML = `<span class="rxn-list-star">★</span><span>${f}</span>`;
      factsList.appendChild(li);
    }
  } else {
    const li = document.createElement('li');
    li.className = 'rxn-list-empty';
    li.textContent = 'No facts yet.';
    factsList.appendChild(li);
  }

  // BALANCED EQUATION card
  const eqCard = mountCard(body, { variant: 'gradient', padding: 'md' });
  mountText(eqCard.el, { text: 'BALANCED EQUATION', variant: 'label', as: 'div' });
  const eq = document.createElement('div');
  eq.className = 'rxn-equation-text';
  eq.textContent = reaction?.balanced || compound.formula;
  eqCard.el.appendChild(eq);
  if (reaction?.context) {
    mountText(eqCard.el, { text: reaction.context, variant: 'muted', as: 'div' }).el.classList.add('rxn-equation-context');
  }
  // Pills describe the REACTION (the equation above them), never the compound.
  // We merge type + energy into one pill so the language unambiguously names
  // a reaction class (e.g. "Synthesis · Exothermic"), and difficulty stays
  // as its own pill since it's a learning-level tag, not a chemistry property.
  if (reaction?.type || reaction?.energy || reaction?.difficulty) {
    const tags = document.createElement('div');
    tags.className = 'rxn-tags';
    eqCard.el.appendChild(tags);
    if (reaction?.type || reaction?.energy) {
      const parts = [];
      if (reaction.type)   parts.push(reaction.type.replace(/-/g, ' '));
      if (reaction.energy) parts.push(reaction.energy);
      mountPill(tags, {
        text: parts.join(' · '),
        variant: reaction.energy === 'exothermic' ? 'warn' : 'accent'
      });
    }
    if (reaction?.difficulty) mountPill(tags, { text: reaction.difficulty, variant: 'neutral' });
  }

  // LIBRARY CTA row
  const ctaCard = mountCard(body, { variant: 'default', padding: 'md', clickable: true,
    onClick: () => bus.emit(EVENTS.NAV_TO, 'library') });
  ctaCard.el.classList.add('rxn-cta-row');
  const ctaLeft = document.createElement('div');
  ctaLeft.className = 'rxn-cta-text';
  mountText(ctaLeft, { text: 'View in Library', variant: 'strong', as: 'div' });
  mountText(ctaLeft, { text: 'Browse all compounds and elements', variant: 'muted', as: 'div' });
  ctaCard.el.appendChild(ctaLeft);
  const arrow = document.createElement('span');
  arrow.className = 'rxn-cta-arrow';
  arrow.textContent = '→';
  ctaCard.el.appendChild(arrow);

  // ── Mount 3D viewer with reaction effect under the molecule ──
  // Use cymatic-bloom as the universal under-molecule animation.
  // The bloom shader picks per-compound colors + lobes from its internal palette,
  // keyed by formulaId. The reaction's `effect` field becomes a fallback only.
  let viewerHandle = null;
  const effectName = 'cymatic-bloom';
  if (mountMoleculeViewer) {
    try {
      viewerHandle = mountMoleculeViewer(viewerHost, {
        formulaId: productId,
        materialName: 'glass',
        effectName
      });
    } catch (e) {
      console.warn('[reaction] viewer mount failed', e);
      viewerHost.innerHTML = `<div class="rxn-viewer-fallback">⚗️<br>${compound.formula}</div>`;
    }
  } else {
    viewerHost.innerHTML = `<div class="rxn-viewer-fallback">⚗️<br>${compound.formula}</div>`;
  }

  return {
    unmount() {
      back.unmount();
      fav.unmount();
      usesCard.unmount();
      factsCard.unmount();
      eqCard.unmount();
      ctaCard.unmount();
      if (viewerHandle?.unmount) {
        try { viewerHandle.unmount(); } catch (_e) {}
      }
      container.classList.remove('rxn-screen');
    },
    refresh() {}
  };
}

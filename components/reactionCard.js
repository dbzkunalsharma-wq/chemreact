// reactionCard.js — horizontal reaction tile with metaball-molecule mark, formula, name, tags.

import { mountMolMark } from './molMark.js';

export function mountReactionCard(container, { reaction, compound, onClick }) {
  let rxn = reaction;
  let cmp = compound;
  let handler = onClick;

  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'rxn-card';

  let tileHandle = null;

  const render = () => {
    if (!rxn) return;
    const formula = (cmp && cmp.formula) || rxn.product || '';
    const name = (cmp && cmp.name) || prettifyId(rxn.product);
    const tags = buildTags(rxn);

    // The tag row describes the FORMATION REACTION, not the compound itself.
    // We prefix with "FORMS VIA" and merge type+energy into one pill so
    // a reader can't mistake "exothermic" as a property of the compound.
    node.innerHTML = `
      <div class="rc-icon-slot"></div>
      <div class="rc-info">
        <div class="rc-formula">${formula}</div>
        <div class="rc-name">${name}</div>
        <div class="rc-tags">
          ${tags.length ? '<span class="rc-tag-label">Forms via</span>' : ''}
          ${tags.map(t => `<span class="rc-tag${t.accent ? ' accent' : ''}">${t.label}</span>`).join('')}
        </div>
      </div>
      <div class="rc-arrow">›</div>
    `;

    // Mount metaball molecule mark in the icon slot. Atoms come from the
    // compound's components map; if the compound is missing (rare — reactions
    // unknown to compounds.json), fall back to the reactants of the reaction.
    const slot = node.querySelector('.rc-icon-slot');
    if (tileHandle) { try { tileHandle.unmount(); } catch (_e) {} }
    const components = (cmp && cmp.components) || rxn.reactants || {};
    tileHandle = mountMolMark(slot, { components, size: 60 });
  };

  const onTap = (e) => {
    e.preventDefault();
    if (typeof handler === 'function' && rxn) handler(rxn);
  };

  render();
  node.addEventListener('click', onTap);
  container.appendChild(node);

  return {
    unmount() {
      node.removeEventListener('click', onTap);
      if (tileHandle) { try { tileHandle.unmount(); } catch (_e) {} }
      node.remove();
    },
    update(payload = {}) {
      if (payload.reaction) rxn = payload.reaction;
      if (payload.compound) cmp = payload.compound;
      render();
    }
  };
}

function buildTags(rxn) {
  const tags = [];
  // Combine type + energy into a single descriptor so the pill clearly
  // names a reaction class (e.g. "Synthesis · Exothermic"), not a property
  // of the displayed compound.
  if (rxn.type || rxn.energy) {
    const parts = [];
    if (rxn.type)   parts.push(prettyType(rxn.type));
    if (rxn.energy) parts.push(prettyType(rxn.energy));
    tags.push({ label: parts.join(' · '), accent: rxn.energy === 'exothermic' });
  }
  if (rxn.difficulty) tags.push({ label: rxn.difficulty });
  return tags;
}

function prettyType(s) {
  if (!s) return '';
  return s.replace(/-/g, ' ');
}

function prettifyId(id = '') {
  return id.replace(/(\d)/g, '$1');
}

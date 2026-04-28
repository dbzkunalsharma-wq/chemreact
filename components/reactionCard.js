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

    node.innerHTML = `
      <div class="rc-icon-slot"></div>
      <div class="rc-info">
        <div class="rc-formula">${formula}</div>
        <div class="rc-name">${name}</div>
        <div class="rc-tags">
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
  if (rxn.energy)     tags.push({ label: rxn.energy, accent: rxn.energy === 'exothermic' });
  if (rxn.type)       tags.push({ label: rxn.type });
  if (rxn.difficulty) tags.push({ label: rxn.difficulty });
  return tags;
}

function prettifyId(id = '') {
  return id.replace(/(\d)/g, '$1');
}

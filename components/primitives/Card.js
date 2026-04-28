// Card — primitive container. NO STYLING DECISIONS HERE.
// Visual variants live in styles/primitives.css under `.card`, `.card-<variant>`.
//
// Usage:
//   const c = mountCard(parent, { variant: 'glass', padding: 'lg' });
//   c.body.appendChild(yourContent);
//   c.unmount();
//
// Variants: default | glass | gradient | outline | warning | danger
// Padding:  none | sm | md | lg

export function mountCard(parent, { variant = 'default', padding = 'md', clickable = false, onClick = null } = {}) {
  const el = document.createElement(clickable ? 'button' : 'div');
  el.className = `card card-${variant} card-pad-${padding}` + (clickable ? ' card-clickable' : '');
  if (clickable) el.type = 'button';

  let handler = null;
  if (clickable && onClick) {
    handler = (e) => onClick(e);
    el.addEventListener('click', handler);
  }

  parent.appendChild(el);

  return {
    el,
    body: el,
    setVariant(v) {
      el.classList.forEach(c => { if (c.startsWith('card-') && !c.startsWith('card-pad-') && c !== 'card-clickable' && c !== 'card') el.classList.remove(c); });
      el.classList.add(`card-${v}`);
    },
    unmount() {
      if (handler) el.removeEventListener('click', handler);
      el.remove();
    }
  };
}

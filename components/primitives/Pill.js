// Pill — primitive small label. NO STYLING DECISIONS.
// Visual lives in styles/primitives.css under `.pill`, `.pill-<variant>`.
//
// Variants: neutral | accent | warn | danger | success | gold

export function mountPill(parent, { text = '', variant = 'neutral', icon = null } = {}) {
  const el = document.createElement('span');
  el.className = `pill pill-${variant}`;

  if (icon) {
    const ic = document.createElement('span');
    ic.className = 'pill-icon';
    if (typeof icon === 'string') ic.textContent = icon;
    else ic.appendChild(icon);
    el.appendChild(ic);
  }

  const t = document.createElement('span');
  t.className = 'pill-text';
  t.textContent = text;
  el.appendChild(t);
  parent.appendChild(el);

  return {
    el,
    setText(v) { t.textContent = v; },
    setVariant(v) {
      el.classList.forEach(c => { if (c.startsWith('pill-') && c !== 'pill-icon' && c !== 'pill-text') el.classList.remove(c); });
      el.classList.add('pill', `pill-${v}`);
    },
    unmount() { el.remove(); }
  };
}

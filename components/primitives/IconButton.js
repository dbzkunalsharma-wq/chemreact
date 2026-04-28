// IconButton — primitive square icon-only button. NO STYLING DECISIONS.
// Visual lives in styles/primitives.css under `.icon-btn`, `.icon-btn-<variant>`.
//
// Variants: ghost (default transparent) | filled | accent | danger
// Sizes:    sm | md | lg

export function mountIconButton(parent, { icon = '', ariaLabel = '', variant = 'ghost', size = 'md', badge = null, onClick = null } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `icon-btn icon-btn-${variant} icon-btn-${size}`;
  el.setAttribute('aria-label', ariaLabel || 'icon button');

  const ic = document.createElement('span');
  ic.className = 'icon-btn-icon';
  if (typeof icon === 'string') ic.innerHTML = icon;
  else ic.appendChild(icon);
  el.appendChild(ic);

  let badgeEl = null;
  if (badge != null) {
    badgeEl = document.createElement('span');
    badgeEl.className = 'icon-btn-badge';
    badgeEl.textContent = String(badge);
    el.appendChild(badgeEl);
  }

  let handler = null;
  if (onClick) {
    handler = (e) => onClick(e);
    el.addEventListener('click', handler);
  }
  parent.appendChild(el);

  return {
    el,
    setBadge(value) {
      if (value == null) {
        if (badgeEl) { badgeEl.remove(); badgeEl = null; }
      } else {
        if (!badgeEl) {
          badgeEl = document.createElement('span');
          badgeEl.className = 'icon-btn-badge';
          el.appendChild(badgeEl);
        }
        badgeEl.textContent = String(value);
      }
    },
    setIcon(newIcon) {
      ic.innerHTML = '';
      if (typeof newIcon === 'string') ic.innerHTML = newIcon;
      else ic.appendChild(newIcon);
    },
    unmount() {
      if (handler) el.removeEventListener('click', handler);
      el.remove();
    }
  };
}

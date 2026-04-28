// Button — primitive. NO STYLING DECISIONS HERE.
// Visual variants live in styles/primitives.css under `.btn`, `.btn-<variant>`, `.btn-<size>`.
//
// Usage:
//   const btn = mountButton(parent, { label: 'Combine', variant: 'primary', size: 'lg', onClick: fn });
//   btn.setLabel('Combining…');  btn.setDisabled(true);  btn.unmount();
//
// Variants (CSS-level): primary | ghost | danger | link
// Sizes:                sm | md | lg
//
// To restyle later: edit `.btn-primary` / `.btn-lg` / etc. in styles/primitives.css.
// JS contract NEVER changes.

export function mountButton(parent, { label = '', variant = 'primary', size = 'md', icon = null, disabled = false, onClick = null, ariaLabel = null } = {}) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `btn btn-${variant} btn-${size}`;
  if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
  if (disabled) el.disabled = true;

  const labelEl = document.createElement('span');
  labelEl.className = 'btn-label';
  labelEl.textContent = label;

  if (icon) {
    const ic = document.createElement('span');
    ic.className = 'btn-icon';
    if (typeof icon === 'string') ic.textContent = icon;
    else ic.appendChild(icon);
    el.appendChild(ic);
  }
  el.appendChild(labelEl);

  let handler = null;
  if (onClick) {
    handler = (e) => { if (!el.disabled) onClick(e); };
    el.addEventListener('click', handler);
  }

  parent.appendChild(el);

  return {
    el,
    setLabel(text) { labelEl.textContent = text; },
    setVariant(v) {
      el.className = el.className.replace(/btn-\w+/g, (m) => m.startsWith('btn-') && ['primary','ghost','danger','link'].includes(m.slice(4)) ? `btn-${v}` : m);
    },
    setDisabled(d) { el.disabled = !!d; },
    setLoading(loading) { el.classList.toggle('btn-loading', !!loading); },
    unmount() {
      if (handler) el.removeEventListener('click', handler);
      el.remove();
    }
  };
}

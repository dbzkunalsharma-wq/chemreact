// Text & Heading primitives — semantic content. NO STYLING DECISIONS.
// Visual lives in styles/primitives.css under `.txt-<variant>`, `.hd-<level>`.
//
// Heading levels: 1 (display) | 2 (page) | 3 (section) | 4 (subsection) | 5 (eyebrow)
// Text variants:  body | muted | caption | label | strong | accent | gold | danger

export function mountHeading(parent, { level = 2, text = '' } = {}) {
  const tag = `h${Math.max(1, Math.min(6, level))}`;
  const el = document.createElement(tag);
  el.className = `hd hd-${level}`;
  el.textContent = text;
  parent.appendChild(el);
  return {
    el,
    setText(t) { el.textContent = t; },
    unmount() { el.remove(); }
  };
}

export function mountText(parent, { text = '', variant = 'body', as = 'span' } = {}) {
  const el = document.createElement(as);
  el.className = `txt txt-${variant}`;
  el.textContent = text;
  parent.appendChild(el);
  return {
    el,
    setText(t) { el.textContent = t; },
    setVariant(v) {
      el.classList.forEach(c => { if (c.startsWith('txt-')) el.classList.remove(c); });
      el.classList.add('txt', `txt-${v}`);
    },
    unmount() { el.remove(); }
  };
}

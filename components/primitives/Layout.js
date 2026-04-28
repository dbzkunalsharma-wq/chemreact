// Layout primitives — Stack, Row, Spacer, Container.
// PURE STRUCTURAL. Use figma.css utilities + tokens for visuals.
//
// Stack — vertical flex column with gap.
// Row   — horizontal flex row with gap.
// Spacer — flexible spacer.
// Container — bounded width container.
//
// All return { el, append(node), unmount() }.

function mountFlexBox(parent, { direction = 'column', gap = 12, align = 'stretch', justify = 'flex-start', wrap = false, padding = 0 } = {}) {
  const el = document.createElement('div');
  el.className = direction === 'row' ? 'lay-row' : 'lay-stack';
  el.style.gap = typeof gap === 'number' ? `${gap}px` : gap;
  el.style.alignItems = align;
  el.style.justifyContent = justify;
  if (wrap) el.style.flexWrap = 'wrap';
  if (padding) el.style.padding = typeof padding === 'number' ? `${padding}px` : padding;
  parent.appendChild(el);
  return {
    el,
    append(node) { el.appendChild(node); return node; },
    unmount() { el.remove(); }
  };
}

export const mountStack = (parent, opts = {}) => mountFlexBox(parent, { ...opts, direction: 'column' });
export const mountRow   = (parent, opts = {}) => mountFlexBox(parent, { ...opts, direction: 'row' });

export function mountSpacer(parent, { size = 'flex' } = {}) {
  const el = document.createElement('div');
  el.className = 'lay-spacer';
  if (size === 'flex') el.style.flex = '1';
  else el.style.minHeight = el.style.minWidth = typeof size === 'number' ? `${size}px` : size;
  parent.appendChild(el);
  return { el, unmount() { el.remove(); } };
}

export function mountContainer(parent, { padding = 'md', maxWidth = null } = {}) {
  const el = document.createElement('div');
  el.className = `lay-container lay-container-pad-${padding}`;
  if (maxWidth) el.style.maxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  parent.appendChild(el);
  return { el, append: (n) => el.appendChild(n), unmount() { el.remove(); } };
}

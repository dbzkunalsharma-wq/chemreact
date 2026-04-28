// levelUpOverlay.js — full-screen celebratory overlay for level-ups & first discoveries.
// Mounts a node, animates in, auto-dismisses after 3s or on tap. Stackable.

let stack = 0;

export function showLevelUpOverlay({
  kind = 'levelup',
  title = 'LEVEL UP!',
  subtitle = '',
  icon = '⭐',
  duration = 3000
} = {}) {
  const root = document.createElement('div');
  root.className = `lvl-overlay lvl-${kind}`;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-live', 'assertive');
  root.innerHTML = `
    <div class="lvl-burst" aria-hidden="true"></div>
    <div class="lvl-content">
      <div class="lvl-icon">${icon}</div>
      <div class="lvl-title">${title}</div>
      <div class="lvl-subtitle">${subtitle || ''}</div>
    </div>
  `;

  // Stagger if another is open so they don't perfectly overlap
  stack++;
  root.style.zIndex = String(9000 + stack);

  document.body.appendChild(root);
  // Trigger entrance via class on next frame
  requestAnimationFrame(() => root.classList.add('show'));

  let closed = false;
  let dismissTimer = null;

  function close() {
    if (closed) return;
    closed = true;
    if (dismissTimer) clearTimeout(dismissTimer);
    root.classList.remove('show');
    root.classList.add('hide');
    root.removeEventListener('click', onTap);
    document.removeEventListener('keydown', onKey);
    setTimeout(() => {
      root.remove();
      stack = Math.max(0, stack - 1);
    }, 360);
  }

  function onTap() { close(); }
  function onKey(e) {
    const k = (e.key || '').toLowerCase();
    if (k === 'escape' || k === 'enter' || k === ' ') close();
  }

  root.addEventListener('click', onTap);
  document.addEventListener('keydown', onKey);
  dismissTimer = setTimeout(close, duration);

  return { close };
}

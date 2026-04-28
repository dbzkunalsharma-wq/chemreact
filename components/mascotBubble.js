// mascotBubble.js — speech-bubble overlay primitive for the mascot.
//
// Renders a glass-blur rounded rectangle with a tail pointing toward the
// mascot element. Subtle slide-in/fade on appear. Auto-dismisses after
// `duration` ms (pass null to keep open). Multiple bubbles for the same
// mascot stack as one — opening a new bubble crossfades out the previous.
//
// Self-contained. No shared imports.
//
// Usage:
//   const b = mountMascotBubble(parent, {
//     mascotEl: mascot.el,
//     message:  'Tap an element to begin!',
//     duration: 4000,
//     position: 'right',  // 'right' | 'left' | 'top'
//   });
//   b.setMessage('Try combining two!');
//   b.close();   // animate out + unmount

const ACTIVE_BUBBLES = new WeakMap(); // mascotEl -> active bubble api

export function mountMascotBubble(parent, {
  mascotEl = null,
  message  = '',
  duration = 4000,
  position = 'right',
} = {}) {
  if (position !== 'left' && position !== 'right' && position !== 'top') {
    position = 'right';
  }

  // Replace any previous bubble bound to this mascot — crossfade.
  if (mascotEl && ACTIVE_BUBBLES.has(mascotEl)) {
    const prev = ACTIVE_BUBBLES.get(mascotEl);
    if (prev && typeof prev.close === 'function') prev.close();
  }

  const el = document.createElement('div');
  el.className = `mascot-bubble mascot-bubble-${position}`;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');

  const inner = document.createElement('div');
  inner.className = 'mascot-bubble-inner';
  el.appendChild(inner);

  const tail = document.createElement('div');
  tail.className = 'mascot-bubble-tail';
  el.appendChild(tail);

  const text = document.createElement('div');
  text.className = 'mascot-bubble-text';
  text.textContent = String(message || '');
  inner.appendChild(text);

  parent.appendChild(el);

  // Force reflow then enter animation.
  void el.offsetHeight;
  el.classList.add('mascot-bubble-in');

  let dismissTimer = null;
  let closed = false;

  const scheduleAuto = () => {
    if (dismissTimer) clearTimeout(dismissTimer);
    if (duration && duration > 0) {
      dismissTimer = setTimeout(() => api.close(), duration);
    }
  };
  scheduleAuto();

  const api = {
    el,
    setMessage(next) {
      // Tiny crossfade on the text only, not the whole bubble.
      text.classList.add('mascot-bubble-text-swap');
      requestAnimationFrame(() => {
        text.textContent = String(next || '');
        text.classList.remove('mascot-bubble-text-swap');
      });
      scheduleAuto(); // reset timer when content changes
    },
    close() {
      if (closed) return;
      closed = true;
      if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
      el.classList.remove('mascot-bubble-in');
      el.classList.add('mascot-bubble-out');
      const onEnd = () => {
        el.removeEventListener('transitionend', onEnd);
        api.unmount();
      };
      el.addEventListener('transitionend', onEnd);
      // Fallback in case transitionend doesn't fire (e.g. display:none).
      setTimeout(() => { if (!closed) return; api.unmount(); }, 400);
    },
    unmount() {
      if (dismissTimer) { clearTimeout(dismissTimer); dismissTimer = null; }
      if (mascotEl && ACTIVE_BUBBLES.get(mascotEl) === api) {
        ACTIVE_BUBBLES.delete(mascotEl);
      }
      if (el.isConnected) el.remove();
    },
  };

  if (mascotEl) ACTIVE_BUBBLES.set(mascotEl, api);

  return api;
}

// toast.js — global toast helper + bus subscriber.
// Floats up from the bottom of the phone, autodismiss after 2.4s, stacks if rapid-fire.

import { bus, EVENTS } from '../core/eventBus.js';

const DURATION = 2400;
const FADE_MS  = 280;
let stackEl = null;
let busUnsub = null;

function ensureStack() {
  if (stackEl && document.body.contains(stackEl)) return stackEl;
  // Anchor inside the phone's inner area so it respects the phone frame.
  const phone = document.querySelector('.phone-inner') || document.body;
  stackEl = document.createElement('div');
  stackEl.className = 'toast-stack';
  phone.appendChild(stackEl);
  return stackEl;
}

export function showToast(message, type = 'info') {
  if (!message) return;
  const host = ensureStack();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.setAttribute('role', 'status');
  // Glitch layers for error/warn toasts read the text via [data-text] —
  // CSS ::before / ::after re-render the same string with RGB offset.
  const isGlitch = type === 'error' || type === 'warn';
  const safe = escapeHtml(String(message));
  t.innerHTML = `
    <span class="toast-ico">${iconFor(type)}</span>
    <span class="toast-msg${isGlitch ? ' glitch' : ''}"${isGlitch ? ` data-text="${safe}"` : ''}>${safe}</span>
  `;
  host.appendChild(t);

  // Force reflow then animate-in.
  void t.offsetHeight;
  t.classList.add('toast-in');

  const dismiss = () => {
    if (!t.isConnected) return;
    t.classList.remove('toast-in');
    t.classList.add('toast-out');
    setTimeout(() => t.remove(), FADE_MS);
  };

  const auto = setTimeout(dismiss, DURATION);
  t.addEventListener('click', () => {
    clearTimeout(auto);
    dismiss();
  }, { once: true });
}

export function mountToastSystem() {
  if (busUnsub) busUnsub();
  busUnsub = bus.on(EVENTS.TOAST, (payload) => {
    if (typeof payload === 'string') return showToast(payload, 'info');
    if (payload && typeof payload === 'object') {
      return showToast(payload.message || '', payload.type || 'info');
    }
  });
  // Expose globally for convenience (matches mockup `toast(...)`).
  window.toast = (msg, type) => showToast(msg, type);
  return {
    unmount() {
      if (busUnsub) busUnsub();
      busUnsub = null;
    }
  };
}

function iconFor(type) {
  switch (type) {
    case 'success': return '✓';
    case 'warn':    return '!';
    case 'error':   return '✕';
    default:        return '•';
  }
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

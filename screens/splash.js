// splash.js — ASCII chemistry-symbol atom hero. User taps PLAY to proceed.
// First-time users go to onboarding; returning users go to home.

import { mountChemAsciiBg } from '../components/chemAsciiBg.js';
import { mountButton } from '../components/primitives/index.js';

export function mountSplashScreen(container, deps) {
  const { state, bus, EVENTS } = deps;

  container.innerHTML = '';
  container.classList.add('splash-screen');

  // ── ASCII chemistry-symbol atom background ──
  // Grid of element symbols + formulas mapped to an atom-shape luminance image.
  // Slow twinkle, pulse wave from nucleus, vignette, warm spark at the core.
  const bgHost = document.createElement('div');
  bgHost.className = 'splash-bloom-host';
  container.appendChild(bgHost);
  const bg = mountChemAsciiBg(bgHost, {
    cols:         62,
    palette:      'cyan',
    sourceImage:  'atom',
    swapInterval: 1100,
    pulseCycle:   5400,
    vignette:     0.92
  });

  // ── Soft radial darken behind the title — keeps text readable over the
  // busy ascii field without killing the bg effect.
  const mask = document.createElement('div');
  mask.className = 'splash-mask';
  container.appendChild(mask);

  // ── Centered logo block ──
  const logoBlock = document.createElement('div');
  logoBlock.className = 'splash-logo-block';
  container.appendChild(logoBlock);

  // Mark: a small SVG atom — 7-circle metaball cluster, same goo style as
  // the rest of the project. Reads as "atom" without competing with the
  // larger atom shape behind in the canvas.
  logoBlock.innerHTML = `
    <div class="splash-mark">
      <svg viewBox="0 0 64 64" class="splash-mark-svg" aria-label="ChemReact">
        <defs>
          <filter id="sp-goo" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.3" result="b"/>
            <feColorMatrix in="b" mode="matrix" values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 22 -10" result="g"/>
            <feComposite in="SourceGraphic" in2="g" operator="atop"/>
          </filter>
          <linearGradient id="sp-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%"  stop-color="#14F0D8"/>
            <stop offset="100%" stop-color="#00B09B"/>
          </linearGradient>
        </defs>
        <g filter="url(#sp-goo)" fill="url(#sp-grad)">
          <circle cx="32" cy="32" r="9.5"/>
          <circle cx="32" cy="13" r="5.2"/>
          <circle cx="32" cy="51" r="5.2"/>
          <circle cx="14" cy="22" r="4.8"/>
          <circle cx="50" cy="22" r="4.8"/>
          <circle cx="14" cy="42" r="4.8"/>
          <circle cx="50" cy="42" r="4.8"/>
        </g>
      </svg>
    </div>
    <h1 class="splash-name">Chem<span>React</span></h1>
    <div class="splash-tag">AR Chemistry · Class 10/11</div>
  `;

  // ── Glass PLAY button — small, glowing, on-theme reaction arrow ──
  const playWrap = document.createElement('div');
  playWrap.className = 'splash-play-wrap';
  container.appendChild(playWrap);

  // Reaction arrow as the icon (chemistry's "yields" symbol).
  const playIcon = document.createElement('span');
  playIcon.className = 'splash-play-icon';
  playIcon.textContent = '→';

  const playBtn = mountButton(playWrap, {
    label: "Let's React",
    icon: playIcon,
    variant: 'ghost',
    size: 'sm',
    ariaLabel: "Let's React",
    onClick: () => {
      const next = state?.get?.().onboardingDone ? 'home' : 'onboarding';
      bus.emit(EVENTS.NAV_TO, next);
    }
  });
  playBtn.el.classList.add('splash-play-btn');

  // ── Bottom credit ──
  const credit = document.createElement('div');
  credit.className = 'splash-credit';
  credit.textContent = 'v0.5 · IIT Delhi · Kunal';
  container.appendChild(credit);

  return {
    unmount() {
      try { bg.unmount(); } catch (_) {}
      try { playBtn.unmount(); } catch (_) {}
      container.classList.remove('splash-screen');
    },
    refresh() { /* nothing dynamic */ }
  };
}

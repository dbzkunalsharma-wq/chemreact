// onboarding.js — first-time user onboarding (3 slides, Next/Back + dots).
// On final "Get Started" press → state.set({ onboardingDone: true }) and nav to home.

import { mountButton, mountHeading, mountText } from '../components/primitives/index.js';

const SLIDES = [
  {
    emoji: '⚛️',
    title: 'Discover Elements',
    body: 'Scan element cards to bring them to life in augmented reality.'
  },
  {
    emoji: '🧪',
    title: 'Combine to React',
    body: 'Place 2 cards together to discover compounds and trigger reactions.'
  },
  {
    emoji: '📖',
    title: 'Build Your Lab',
    body: 'Track every discovery in your journal and grow your collection.'
  }
];

export function mountOnboardingScreen(container, deps) {
  const { state, bus, EVENTS } = deps;

  let index = 0;
  const cleanups = [];

  // --- root layout ---
  container.innerHTML = `
    <div class="ob-bg"></div>
    <div class="ob-top">
      <button class="ob-skip" type="button">Skip</button>
    </div>
    <div class="ob-stage">
      <div class="ob-hero" data-ob-hero>
        <div class="ob-hero-glow"></div>
        <div class="ob-hero-emoji" data-ob-emoji></div>
      </div>
      <div class="ob-copy">
        <div class="ob-heading-host" data-ob-heading-host></div>
        <div class="ob-body-host" data-ob-body-host></div>
      </div>
    </div>
    <div class="ob-foot">
      <div class="ob-dots" data-ob-dots></div>
      <div class="ob-actions">
        <button class="ob-back" type="button" data-ob-back>Back</button>
        <div class="ob-next-host" data-ob-next-host></div>
      </div>
    </div>
  `;

  const emojiEl   = container.querySelector('[data-ob-emoji]');
  const headHost  = container.querySelector('[data-ob-heading-host]');
  const bodyHost  = container.querySelector('[data-ob-body-host]');
  const dotsHost  = container.querySelector('[data-ob-dots]');
  const nextHost  = container.querySelector('[data-ob-next-host]');
  const backBtn   = container.querySelector('[data-ob-back]');
  const skipBtn   = container.querySelector('.ob-skip');
  const heroEl    = container.querySelector('[data-ob-hero]');

  // Build dots once.
  SLIDES.forEach((_s, i) => {
    const dot = document.createElement('span');
    dot.className = 'ob-dot';
    dot.setAttribute('data-i', String(i));
    dotsHost.appendChild(dot);
  });
  const dotEls = Array.from(dotsHost.querySelectorAll('.ob-dot'));

  // Mount dynamic primitives once; we'll update text in renderSlide.
  const heading = mountHeading(headHost, { level: 1, text: SLIDES[0].title });
  const body    = mountText(bodyHost, { text: SLIDES[0].body, variant: 'muted', as: 'p' });
  const nextBtn = mountButton(nextHost, {
    label: 'Next',
    variant: 'primary',
    size: 'lg',
    onClick: () => goNext()
  });

  function renderSlide() {
    const s = SLIDES[index];

    // Animate hero on each render.
    heroEl.classList.remove('ob-hero-pop');
    void heroEl.offsetWidth; // reflow to restart animation
    heroEl.classList.add('ob-hero-pop');

    emojiEl.textContent = s.emoji;
    heading.setText(s.title);
    body.setText(s.body);

    dotEls.forEach((d, i) => d.classList.toggle('active', i === index));

    backBtn.toggleAttribute('hidden', index === 0);
    backBtn.style.visibility = index === 0 ? 'hidden' : 'visible';

    nextBtn.setLabel(index === SLIDES.length - 1 ? 'Get Started' : 'Next');
  }

  function goNext() {
    if (index < SLIDES.length - 1) {
      index += 1;
      renderSlide();
    } else {
      finish();
    }
  }

  function goBack() {
    if (index > 0) {
      index -= 1;
      renderSlide();
    }
  }

  function finish() {
    state.set({ onboardingDone: true });
    bus.emit(EVENTS.NAV_TO, 'home');
  }

  // Wire static buttons.
  const onBack = () => goBack();
  const onSkip = () => finish();
  backBtn.addEventListener('click', onBack);
  skipBtn.addEventListener('click', onSkip);
  cleanups.push(() => backBtn.removeEventListener('click', onBack));
  cleanups.push(() => skipBtn.removeEventListener('click', onSkip));

  // Dot tap to jump to slide.
  dotEls.forEach(dot => {
    const handler = () => {
      const i = Number(dot.getAttribute('data-i'));
      if (Number.isFinite(i)) { index = i; renderSlide(); }
    };
    dot.addEventListener('click', handler);
    cleanups.push(() => dot.removeEventListener('click', handler));
  });

  // First paint.
  renderSlide();

  return {
    unmount() {
      cleanups.forEach(fn => { try { fn(); } catch (_e) {} });
      cleanups.length = 0;
      try { heading.unmount(); } catch (_e) {}
      try { body.unmount(); }    catch (_e) {}
      try { nextBtn.unmount(); } catch (_e) {}
    },
    refresh() { renderSlide(); }
  };
}

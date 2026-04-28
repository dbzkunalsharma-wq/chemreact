// main.js — ChemReact PWA entry point.
// Loads JSON data, wires up router, mounts the toast and dev-panel systems,
// and kicks off the splash screen.

import { state } from './core/state.js';
import { bus, EVENTS } from './core/eventBus.js';
import { nav } from './core/nav.js';
import { trackerMock } from './core/trackerMock.js';

import { mountSplashScreen }        from './screens/splash.js';
import { mountHomeScreen }          from './screens/home.js';
import { mountScanScreen }          from './screens/scan.js';
import { mountReactionScreen }      from './screens/reaction.js';
import { mountLibraryScreen }       from './screens/library.js';
import { mountElementDetailScreen } from './screens/elementDetail.js';
import { mountJournalScreen }       from './screens/journal.js';
import { mountOnboardingScreen }    from './screens/onboarding.js';
import { mountCardARScreen }        from './screens/cardAR.js';

import { mountMoleculeViewer }            from './components/moleculeViewer.js';
import { mountToastSystem, showToast }    from './components/toast.js';
import { mountDevPanel }                  from './components/devPanel.js';
import { mountBottomNav }                 from './components/bottomNav.js';

import { setupAudioBridge }                from './core/audioBridge.js';
import { setupDemoMode }                   from './core/demoMode.js';
import { setupCelebration }                from './components/celebration.js';

(async () => {
  // ── Load all JSON data in parallel ──
  const [elements, compounds, reactionsRaw, molecules] = await Promise.all([
    fetch('./data/elements.json').then(r => r.json()),
    fetch('./data/compounds.json').then(r => r.json()),
    fetch('./data/reactions.json').then(r => r.json()),
    fetch('./data/molecules.json').then(r => r.json())
  ]);

  const reactions = reactionsRaw.reactions;
  const invalidExplanations = reactionsRaw.invalidExplanations;

  const deps = {
    tracker: trackerMock,
    state, bus, EVENTS,
    elements, compounds, reactions, molecules, invalidExplanations,
    mountMoleculeViewer
  };

  // ── Init router ──
  const root = document.getElementById('app');
  nav.init({ root, dependencies: deps });

  nav.register('splash',        mountSplashScreen);
  nav.register('home',          mountHomeScreen);
  nav.register('scan',          mountScanScreen);
  nav.register('reaction',      mountReactionScreen);
  nav.register('library',       mountLibraryScreen);
  nav.register('elementDetail', mountElementDetailScreen);
  nav.register('journal',       mountJournalScreen);
  nav.register('onboarding',    mountOnboardingScreen);
  nav.register('cardAR',        mountCardARScreen);

  // ── Global systems ──
  mountToastSystem();
  mountDevPanel({ tracker: trackerMock, state });
  mountBottomNav({ container: root, bus, EVENTS, nav });

  // Audio (procedural Web Audio — silent until first user gesture due to autoplay policy)
  const audioBridge = setupAudioBridge({ bus, EVENTS, state });

  // Celebration: confetti + level-up overlay on discovery / level-up
  const celebrationBridge = setupCelebration({ bus, EVENTS, state, compounds });

  // Demo mode: ?demo=1 URL flag or `D` key triggers a presentation walkthrough
  const demo = setupDemoMode({ bus, EVENTS, state, nav, tracker: trackerMock });

  trackerMock.start();
  state.bumpStreak();

  await nav.go('splash');

  // ── Console debugging surface ──
  window.cr = { state, bus, EVENTS, nav, tracker: trackerMock, deps, showToast,
                audio: audioBridge, demo, celebration: celebrationBridge };
})();

// ── Service worker registration ──
// Registers ./service-worker.js for offline support in production builds.
// During local development the cache-first strategy hides edits, so we SKIP
// registration on localhost / 127.0.0.1 and proactively unregister any
// existing worker. `?nosw=1` forces unregister anywhere (e.g. on a deployed
// build during debugging). To re-enable on localhost, append `?sw=1`.
if ('serviceWorker' in navigator) {
  const params = new URLSearchParams(window.location.search);
  const host = window.location.hostname;
  const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
  const forceOff = params.has('nosw');
  const forceOn  = params.has('sw');

  if (forceOff || (isLocalhost && !forceOn)) {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(reg => reg.unregister());
      if (window.caches) caches.keys().then(keys => keys.forEach(k => caches.delete(k)));
      console.info('[sw] unregistered (dev mode or ?nosw=1)');
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(err => {
        console.warn('[sw] register failed', err);
      });
    });
  }
}


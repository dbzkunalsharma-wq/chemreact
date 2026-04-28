// cardARView.js — DOM wrapper around CardRenderer.
//
// Mounts a fullscreen canvas inside the supplied container, instantiates a
// CardRenderer wired to the supplied transformProvider, and returns a small
// imperative API for the parent screen.
//
// usage:
//   const view = mountCardARView(container, {
//     transformProvider: arTransformMock,
//     moleculesData, elementsData, compoundsData, reactionsData
//   });
//   view.addCard('cardA', 'H2O', 'water-ripple');
//   view.removeCard('cardA');
//   view.unmount();

import { CardRenderer } from '../core/cardRenderer.js';

export function mountCardARView(container, {
  transformProvider,
  moleculesData,
  elementsData,
  compoundsData,
  reactionsData
} = {}) {
  if (!container) throw new Error('mountCardARView: container is required');
  if (!transformProvider) throw new Error('mountCardARView: transformProvider is required');

  // Make sure absolute positioning works inside the container.
  const prevPos = container.style.position;
  if (!prevPos || prevPos === 'static') {
    container.style.position = 'relative';
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'card-ar-canvas';
  container.appendChild(canvas);

  const renderer = new CardRenderer({
    canvas,
    transformProvider,
    moleculesData,
    elementsData,
    compoundsData,
    reactionsData
  });

  const resize = () => {
    const rect = container.getBoundingClientRect();
    renderer.resize(Math.max(1, Math.floor(rect.width)), Math.max(1, Math.floor(rect.height)));
  };
  resize();

  let ro = null;
  if (typeof ResizeObserver !== 'undefined') {
    ro = new ResizeObserver(() => resize());
    ro.observe(container);
  } else {
    window.addEventListener('resize', resize);
  }

  // Start rendering immediately — even with zero cards, the loop is cheap and
  // it means the first card to appear renders without a kickoff race.
  renderer.start();
  // Start the transform provider too, so addCard immediately receives a matrix.
  if (typeof transformProvider.start === 'function') transformProvider.start();

  let mounted = true;

  // Track cards we asked the (mock) provider to simulate, so unmount can
  // clean them up — otherwise a singleton mock would accumulate targets
  // across remounts and silently no-op the second addTarget().
  const ownedTargets = new Set();

  /**
   * Convenience: ask the mock provider to add a target, then set its molecule
   * and effect. Real (MindAR) providers ignore addTarget — but for them the
   * caller would call setMoleculeForTarget directly when their own onTargetFound
   * fires. Either way, this method covers the preview path.
   */
  function addCard(targetId, formulaId, effectName, basePosition) {
    if (!mounted) return;
    if (typeof transformProvider.addTarget === 'function') {
      transformProvider.addTarget(targetId, basePosition);
      ownedTargets.add(targetId);
    }
    if (formulaId) renderer.setMoleculeForTarget(targetId, formulaId);
    if (effectName) renderer.setEffectForTarget(targetId, effectName);
  }

  function removeCard(targetId) {
    if (!mounted) return;
    if (typeof transformProvider.removeTarget === 'function') {
      transformProvider.removeTarget(targetId);
    }
    ownedTargets.delete(targetId);
  }

  function setCardMolecule(targetId, formulaId) {
    if (!mounted) return;
    renderer.setMoleculeForTarget(targetId, formulaId);
  }

  function setCardEffect(targetId, effectName) {
    if (!mounted) return;
    renderer.setEffectForTarget(targetId, effectName);
  }

  function unmount() {
    if (!mounted) return;
    mounted = false;
    // Remove the targets we own first, so a remount on a singleton provider
    // (e.g. arTransformMock) starts from a clean slate.
    if (typeof transformProvider.removeTarget === 'function') {
      for (const id of ownedTargets) {
        try { transformProvider.removeTarget(id); }
        catch (e) { console.warn('[cardARView] removeTarget error', e); }
      }
    }
    ownedTargets.clear();
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    try { renderer.dispose(); } catch (e) { console.warn('[cardARView] dispose error', e); }
    if (typeof transformProvider.stop === 'function') {
      try { transformProvider.stop(); } catch (e) { console.warn('[cardARView] provider stop error', e); }
    }
    if (canvas.parentNode === container) container.removeChild(canvas);
    if (prevPos === '' || prevPos == null) container.style.position = '';
  }

  return {
    renderer,
    addCard,
    removeCard,
    setCardMolecule,
    setCardEffect,
    resize,
    unmount
  };
}

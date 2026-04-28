// moleculeViewer.js — DOM wrapper around MoleculeRenderer.
//
// usage:
//   const v = mountMoleculeViewer(container, { formulaId: 'H2O', materialName: 'glass' });
//   v.setMolecule('CO2');
//   v.setMaterial('crystal');
//   v.unmount();

import { MoleculeRenderer } from '../core/moleculeRenderer.js';
import { playGlitchReveal } from './glitchReveal.js';

export function mountMoleculeViewer(container, { formulaId, materialName = 'glass', effectName = null } = {}) {
  if (!container) throw new Error('mountMoleculeViewer: container is required');

  // Make sure container is positioned so the absolute canvas fills it.
  const prevPos = container.style.position;
  if (!prevPos || prevPos === 'static') {
    container.style.position = 'relative';
  }

  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  container.appendChild(canvas);

  const renderer = new MoleculeRenderer({ canvas, materialName, effectName });

  // ResizeObserver keeps the renderer matched to the container's actual size.
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

  let activeGlitch = null;
  function fireGlitchReveal(label) {
    if (activeGlitch) activeGlitch.close();
    activeGlitch = playGlitchReveal(container, { duration: 1200, label: label || 'ANALYZING' });
  }

  if (formulaId) {
    renderer.render(formulaId);
    fireGlitchReveal(formulaId);
  }

  let mounted = true;

  function unmount() {
    if (!mounted) return;
    mounted = false;
    if (ro) ro.disconnect();
    else window.removeEventListener('resize', resize);
    try { renderer.dispose(); } catch (e) { console.warn('[moleculeViewer] dispose error:', e); }
    if (canvas.parentNode === container) container.removeChild(canvas);
    if (prevPos === '' || prevPos == null) container.style.position = '';
  }

  function setMolecule(id) {
    if (!mounted) return;
    renderer.render(id);
    fireGlitchReveal(id);
  }

  function setMaterial(name) {
    if (!mounted) return;
    renderer.setMaterial(name);
  }

  function setEffect(name) {
    if (!mounted) return;
    renderer.setEffect(name);
  }

  return { unmount, setMolecule, setMaterial, setEffect };
}

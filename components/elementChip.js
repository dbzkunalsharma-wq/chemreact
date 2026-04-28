// elementChip.js — small element card used in row scrollers.
// Card 82x140px with tinted top glow using element.cpkColor.

export function mountElementChip(container, { element, onClick }) {
  let el = element;
  let handler = onClick;

  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'el-chip';

  const render = () => {
    if (!el) return;
    // CPK colors come from external chem data; muted fallback when missing.
    node.style.setProperty('--el-color', el.cpkColor || 'var(--muted)');
    node.innerHTML = `
      <div class="el-glow"></div>
      <div class="el-num">${el.z}</div>
      <div class="el-sym">${getSymbol(el)}</div>
      <div class="el-name">${el.name}</div>
    `;
  };

  const onTap = (e) => {
    e.preventDefault();
    if (typeof handler === 'function' && el) handler(getId(el));
  };

  render();
  node.addEventListener('click', onTap);
  container.appendChild(node);

  return {
    unmount() {
      node.removeEventListener('click', onTap);
      node.remove();
    },
    update(newElement) {
      el = newElement;
      render();
    }
  };
}

// elements.json keys are element symbols ("H", "He", ...) — we infer it from name fallback.
function getSymbol(element) {
  return element.symbol || element.sym || guessSymbolFromName(element.name);
}

// elements.json doesn't store the symbol directly inside the value object.
// We expose an `id` if the caller passed it, otherwise derive from name.
function getId(element) {
  return element.id || element.symbol || element.sym || guessSymbolFromName(element.name);
}

function guessSymbolFromName(name) {
  if (!name) return '?';
  // crude fallback; library always passes id explicitly.
  return name.slice(0, 2);
}

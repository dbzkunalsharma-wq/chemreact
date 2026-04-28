// Input — primitive text input. NO STYLING DECISIONS HERE.
// Visual lives in styles/primitives.css under `.input`, `.input-<variant>`.
//
// Usage:
//   const i = mountInput(parent, { placeholder: 'Search…', onChange: (v) => ... });
//   i.focus();  i.setValue('Au');  i.unmount();
//
// Variants: default | search | underline

export function mountInput(parent, { value = '', placeholder = '', variant = 'default', type = 'text', onChange = null, onSubmit = null, leadingIcon = null } = {}) {
  const wrap = document.createElement('label');
  wrap.className = `input input-${variant}`;

  if (leadingIcon) {
    const ic = document.createElement('span');
    ic.className = 'input-icon';
    if (typeof leadingIcon === 'string') ic.textContent = leadingIcon;
    else ic.appendChild(leadingIcon);
    wrap.appendChild(ic);
  }

  const input = document.createElement('input');
  input.type = type;
  input.value = value;
  input.placeholder = placeholder;
  input.className = 'input-field';
  wrap.appendChild(input);

  let inputHandler = null, keyHandler = null;
  if (onChange) {
    inputHandler = () => onChange(input.value);
    input.addEventListener('input', inputHandler);
  }
  if (onSubmit) {
    keyHandler = (e) => { if (e.key === 'Enter') onSubmit(input.value); };
    input.addEventListener('keydown', keyHandler);
  }

  parent.appendChild(wrap);

  return {
    el: wrap,
    input,
    getValue() { return input.value; },
    setValue(v) { input.value = v; },
    focus() { input.focus(); },
    unmount() {
      if (inputHandler) input.removeEventListener('input', inputHandler);
      if (keyHandler) input.removeEventListener('keydown', keyHandler);
      wrap.remove();
    }
  };
}

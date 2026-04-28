// confetti.js — lightweight 2D canvas confetti burst. No deps.
// Usage: fireConfetti({ origin: 'center' | {x,y}, particleCount, colors, duration })

function readVar(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  } catch { return fallback; }
}

function defaultColors() {
  return [
    readVar('--accent', '#4cd6ff'),
    readVar('--gold',   '#ffd166'),
    readVar('--teal',   '#2bd9c4'),
    readVar('--streak', '#ff7a5c'),
    '#ffffff'
  ];
}

function resolveOrigin(origin) {
  if (origin && typeof origin === 'object' && Number.isFinite(origin.x) && Number.isFinite(origin.y)) {
    return { x: origin.x, y: origin.y };
  }
  return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
}

export function fireConfetti({
  origin = 'center',
  particleCount = 80,
  colors = null,
  duration = 2500
} = {}) {
  const palette = (Array.isArray(colors) && colors.length) ? colors : defaultColors();
  const start = resolveOrigin(origin === 'center' ? null : origin);

  // Canvas setup
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  function size() {
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }
  size();
  const onResize = () => size();
  window.addEventListener('resize', onResize);
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Particles
  const particles = [];
  for (let i = 0; i < particleCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    // Bias upward a touch — stage feel
    const upBias = -Math.PI / 2;
    const spread = (Math.random() - 0.5) * Math.PI * 1.4; // wide
    const dir = Math.random() < 0.7 ? upBias + spread : angle;
    const speed = 4 + Math.random() * 8;
    particles.push({
      x: start.x,
      y: start.y,
      vx: Math.cos(dir) * speed,
      vy: Math.sin(dir) * speed,
      g: 0.18 + Math.random() * 0.12,
      drag: 0.985 + Math.random() * 0.01,
      size: 6 + Math.random() * 6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      color: palette[(Math.random() * palette.length) | 0],
      shape: Math.random() < 0.6 ? 'rect' : 'circle',
      life: 1
    });
  }

  let raf = null;
  let cancelled = false;
  const t0 = performance.now();

  function tick(now) {
    if (cancelled) return;
    const elapsed = now - t0;
    const t = Math.min(1, elapsed / duration);
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    for (const p of particles) {
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.rot += p.vr;
      // Fade-out in the last 30%
      p.life = t < 0.7 ? 1 : Math.max(0, 1 - (t - 0.7) / 0.3);

      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        const w = p.size, h = p.size * 0.55;
        ctx.fillRect(-w / 2, -h / 2, w, h);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (elapsed < duration) {
      raf = requestAnimationFrame(tick);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
    window.removeEventListener('resize', onResize);
    canvas.remove();
  }

  raf = requestAnimationFrame(tick);

  return { stop: cleanup };
}

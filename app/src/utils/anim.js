export function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Fa salire un numero fino al suo valore invece di farlo comparire di colpo.
// `format` decide come renderizzare ogni passo (es. una cifra decimale).
export function animateCount(el, to, { duration = 700, format } = {}) {
  const render = format || (v => String(Math.round(v)));
  if (!el || !isFinite(to)) return;
  if (prefersReducedMotion()) { el.textContent = render(to); return; }
  const start = performance.now();
  function step(now) {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubica
    el.textContent = render(to * eased);
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

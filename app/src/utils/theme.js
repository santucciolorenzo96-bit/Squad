const THEME_KEY = 'bbapp_theme';

export function teamInitials(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

export function userInitials(name) {
  return teamInitials(name);
}

// ======================= Tema chiaro/scuro/sistema =======================

export function getStoredThemeMode() {
  return localStorage.getItem(THEME_KEY) || 'system';
}

export function resolvedTheme(mode) {
  const m = mode || getStoredThemeMode();
  if (m === 'system') return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  return m;
}

function applyThemeAttribute(mode) {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode);
}

export function initTheme() {
  applyThemeAttribute(getStoredThemeMode());
  window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
    if (getStoredThemeMode() === 'system') applyThemeAttribute('system');
  });
}

export function setTheme(mode) {
  localStorage.setItem(THEME_KEY, mode);
  const allowTransition = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (allowTransition) {
    document.documentElement.classList.add('theme-transitioning');
    setTimeout(() => document.documentElement.classList.remove('theme-transitioning'), 400);
  }
  applyThemeAttribute(mode);
}

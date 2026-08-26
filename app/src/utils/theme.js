const THEME_KEY = 'bbapp_theme';

export function applyTheme(teamProfile) {
  const rawPrimary = (teamProfile && teamProfile.primary_color) || '#FF6A13';
  const rawSecondary = (teamProfile && teamProfile.secondary_color) || '#FFC53D';
  const isLight = resolvedTheme() === 'light';
  const primary = isLight ? ensureReadableOnLight(rawPrimary) : rawPrimary;
  const secondary = isLight ? ensureReadableOnLight(rawSecondary) : rawSecondary;
  const root = document.documentElement.style;
  root.setProperty('--orange', primary);
  root.setProperty('--gold', secondary);
  root.setProperty('--orange-dim', hexToRgba(primary, isLight ? 0.12 : 0.18));
}

export function hexToRgba(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgb(hex) {
  hex = (hex || '#FF6A13').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
}

function rgbToHex(r, g, b) {
  const c = v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function relativeLuminance([r, g, b]) {
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// Un colore societario troppo chiaro (es. giallo/oro) diventa illeggibile su sfondo
// chiaro: lo scurisce finché il contrasto non è ragionevole, senza cambiarne la tinta.
function ensureReadableOnLight(hex) {
  let [r, g, b] = hexToRgb(hex);
  let factor = 1;
  while (relativeLuminance([r, g, b]) > 0.42 && factor > 0.35) {
    factor -= 0.06;
    [r, g, b] = hexToRgb(hex).map(v => v * factor);
  }
  return rgbToHex(r, g, b);
}

export function teamInitials(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
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

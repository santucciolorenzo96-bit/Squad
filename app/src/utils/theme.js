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

// Il tema "squadra" non e' una terza palette: e' il tema scuro con gli accenti
// della societa'. L'attributo resta quindi quello scuro.
function applyThemeAttribute(mode) {
  if (mode === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', mode === 'squadra' ? 'dark' : mode);
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

// ======================= Tema "Squadra" =======================
// teams.primary_color e secondary_color esistono dal primo schema e nessuno
// li ha mai letti: erano rimasti sui default pre-rebrand (#FF6A13 arancione,
// #FFC53D oro). Collegarli significa che ogni società vede SQUAD nei propri
// colori, presi dal suo logo.
//
// È una scelta, non un default: chi non fa niente resta sulla palette SQUAD.
// Il tema "squadra" sostituisce "sistema" nel selettore — seguire le
// preferenze del sistema operativo è una comodità che quasi nessuno nota,
// mentre vedere i propri colori si nota subito.

const TEAM_ACCENT_ID = 'team-accent-style';

function isHexColor(v) {
  return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim());
}

// Luminanza relativa, per decidere se il testo sopra l'accento va chiaro o
// scuro: una società con i colori gialli renderebbe illeggibile il bianco.
function readableOn(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.42 ? '#04121C' : '#FFFFFF';
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

export function applyTeamAccent(team) {
  const existing = document.getElementById(TEAM_ACCENT_ID);
  if (existing) existing.remove();
  if (getStoredThemeMode() !== 'squadra') return;

  const primary = isHexColor(team && team.primary_color) ? team.primary_color.trim() : null;
  const secondary = isHexColor(team && team.secondary_color) ? team.secondary_color.trim() : null;
  if (!primary) return;

  // Si sostituiscono solo gli accenti: sfondi, vetro e gerarchia restano
  // quelli di SQUAD, altrimenti ogni società avrebbe un'app diversa invece
  // della stessa app nei propri colori.
  const style = document.createElement('style');
  style.id = TEAM_ACCENT_ID;
  style.textContent = `:root{
    --orange:${primary};
    --orange-dim:rgba(${hexToRgb(primary)},0.16);
    --gold:${secondary || primary};
    --on-accent:${readableOn(primary)};
  }`;
  document.head.appendChild(style);
}

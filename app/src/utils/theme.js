export function applyTheme(teamProfile) {
  const primary = (teamProfile && teamProfile.primary_color) || '#FF6A13';
  const secondary = (teamProfile && teamProfile.secondary_color) || '#FFC53D';
  const root = document.documentElement.style;
  root.setProperty('--orange', primary);
  root.setProperty('--gold', secondary);
  root.setProperty('--orange-dim', hexToRgba(primary, 0.18));
}

export function hexToRgba(hex, alpha) {
  hex = (hex || '#FF6A13').replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const r = parseInt(hex.substr(0, 2), 16), g = parseInt(hex.substr(2, 2), 16), b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function teamInitials(name) {
  return (name || '').trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';
}

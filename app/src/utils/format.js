export function uid(p) {
  return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function esc(s) {
  const d = document.createElement('div');
  d.textContent = s == null ? '' : String(s);
  return d.innerHTML;
}

export function fmtClock(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function fmtMin(sec) {
  return Math.floor(sec / 60) + "'";
}

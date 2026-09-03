export function uid(p) {
  return (p || 'id') + '_' + Math.random().toString(36).slice(2, 9);
}

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Escape per l'inserimento in HTML.
//
// La versione precedente passava per textContent + innerHTML del DOM, che
// NON codifica gli apici. In 62 punti dell'app il risultato di esc() finisce
// dentro un attributo — value="${esc(...)}", data-x="${esc(...)}" — e un
// valore contenente una virgoletta doppia usciva dall'attributo:
//
//   fiscal_code = '" onfocus="…" autofocus x="'
//
// Un genitore può modificare i dati anagrafici del proprio figlio, quindi il
// codice sarebbe stato eseguito nel browser di chiunque dello staff avesse
// aperto quella scheda — con il token di sessione a portata di JavaScript.
//
// Ora l'escape è testuale e comprende entrambi gli apici. Come effetto
// secondario la funzione non dipende più dal DOM, quindi è verificabile.
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, ch => HTML_ESCAPES[ch]);
}

export function fmtClock(sec) {
  sec = Math.max(0, sec);
  const m = Math.floor(sec / 60), s = sec % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function fmtMin(sec) {
  return Math.floor(sec / 60) + "'";
}

// ======================= Password =======================
// La regola stava scritta in tre punti diversi, tutti a sei caratteri: sotto
// la soglia minima che Supabase stesso raccomanda, e impossibile da alzare
// senza ricordarsi di tutti e tre. Ora è una sola.
//
// Otto caratteri e non di più: allungare il minimo su un'app usata da genitori
// e ragazzi produce password scritte su un foglietto, non password migliori.
// Quello che serve davvero — il blocco delle password già trapelate — lo fa
// Supabase, e si attiva dalla dashboard (Authentication → Password).
export const PASSWORD_MIN = 8;

export function passwordProblem(pass, { field = 'La password' } = {}) {
  const p = pass || '';
  if (p.length < PASSWORD_MIN) return `${field} deve avere almeno ${PASSWORD_MIN} caratteri.`;
  if (!/[a-zA-Z]/.test(p) || !/[0-9]/.test(p)) return `${field} deve contenere almeno una lettera e un numero.`;
  return null;
}

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

/* Cercare un nome italiano.
 *
 * Chi cerca scrive di fretta e in minuscolo, e non va a prendere l'accento
 * giusto sulla tastiera: «nicolo» deve trovare «Nicolò», «DAMBROSIO» deve
 * trovare «D'Ambrosio». Una ricerca che pretende la grafia esatta e' una
 * ricerca che non si usa la seconda volta.
 *
 * NFD separa la lettera dal suo accento, e togliere i segni diacritici lascia
 * la lettera nuda: e' il modo piu' corto di far combaciare due grafie della
 * stessa parola senza tenere una tabella di corrispondenze.
 */
export function senzaAccenti(s) {
  return String(s == null ? '' : s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2018\u2019']/g, '')
    .toLowerCase()
    .trim();
}

// Una ricerca vuota trova tutto: il filtro non deve svuotare l'elenco finche'
// non si e' scritto qualcosa.
export function contiene(testo, ago) {
  const a = senzaAccenti(ago);
  if (!a) return true;
  return senzaAccenti(testo).indexOf(a) >= 0;
}

/* LE DATE SENZA ORA.
 *
 * In quest'app una data è una stringa «2026-09-22»: un giorno del calendario,
 * non un istante. Allenamenti, partite, scadenze — nessuna di queste cose ha
 * un fuso orario, hanno un giorno.
 *
 * `toISOString()` invece converte in UTC, e per farlo deve scegliere un
 * istante. Da mezzanotte locale in Italia sono le 22:00 del giorno prima, e
 * la stringa che ne esce è il giorno sbagliato. Al contrario, `new Date()`
 * dopo le 22:00 diventa già domani.
 *
 * Due difetti veri, che nessuno dei due si annuncia:
 *
 *  - l'allenatore che dopo cena aggiunge l'allenamento di stasera trova la
 *    data di domani già scritta nel modulo;
 *  - un programma fisso «ogni martedì» generava tutti lunedì, sempre, perché
 *    partiva dalla mezzanotte locale del martedì e la scriveva in UTC.
 *
 * Qui il fuso si toglie prima di convertire: il giorno resta quello che è
 * sull'orologio di chi guarda, che è l'unico che conta per un allenamento.
 */
export function giornoISO(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (isNaN(d.getTime())) return '';
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function oggiISO() {
  return giornoISO(new Date());
}

// Fra N giorni, sempre in giorni di calendario: `setDate` attraversa i cambi
// di ora legale senza sbagliare, una somma di millisecondi no.
export function fraGiorniISO(n, da) {
  const d = da instanceof Date ? new Date(da) : new Date();
  d.setDate(d.getDate() + n);
  return giornoISO(d);
}

/* IL CRONOMETRO, E I MINUTI GIOCATI CHE NE DISCENDONO.
 *
 * Era stato tolto di proposito, e la ragione era scritta nel descrittore del
 * basket: nel basket il tempo si ferma di continuo, ed è l'unica statistica
 * che si corrompe da sola — scorre anche quando nessuno la guarda. Una pausa
 * dimenticata durante due tiri liberi regala novanta secondi fantasma a cinque
 * giocatori insieme, in silenzio. Ogni altro dato nasce da un tocco, quindi se
 * manca è un buco che si vede; un minuto sbagliato no.
 *
 * Quella ragione resta vera. Torna perché serve la cosa che ci sta attaccata —
 * quanto ha giocato ognuno — e perché due accorgimenti rendono l'errore
 * visibile invece che invisibile:
 *
 *   1. il cronometro si CORREGGE. Si tocca il numero e si scrive quello del
 *      tabellone della palestra. Un orologio che non si può rimettere a posto
 *      accumula per tutta la partita; uno che si può correggere sbaglia fino
 *      alla prossima occhiata al tabellone, e non oltre.
 *
 *   2. i minuti NON si misurano sull'orologio da parete: si misurano sul
 *      cronometro. Se è fermo non passa tempo per nessuno. Un time out di tre
 *      minuti con il cronometro fermo costa zero minuti giocati, che è giusto,
 *      e un cronometro che qualcuno ha scordato di fermare si vede subito
 *      perché scende da solo mentre non succede niente.
 *
 * NON TICCHETTA NEL DATABASE. Scrivere la riga ogni secondo vorrebbe dire un
 * salvataggio al secondo, un conflitto di revisione ogni volta che due
 * dispositivi guardano, e la batteria del tablet. Si scrivono tre cose quando
 * CAMBIANO — quanto manca, se sta andando, da quando — e «quanto manca adesso»
 * è un conto, non un dato. Così una pagina ricaricata a metà periodo ritrova
 * il tempo giusto, e un secondo dispositivo che guarda vede lo stesso numero.
 */

// Dieci minuti: il periodo FIBA. Il minibasket gioca periodi più corti, ed è
// per questo che la durata si può cambiare in partita invece di essere fissa.
export const DURATA_PREDEFINITA = 10 * 60;

/** Quanto dura un periodo, in secondi. */
export function durataPeriodo(g, conf) {
  const suo = Number((g || {}).quarterLength);
  if (suo > 0) return Math.floor(suo);
  const dallosport = Number(((conf || {}).period || {}).minutes);
  if (dallosport > 0) return Math.floor(dallosport * 60);
  return DURATA_PREDEFINITA;
}

/* QUANTO MANCA, ADESSO.
 *
 * `clock` è quanto mancava all'ultimo cambio di stato, `clockFrom` l'istante
 * di quel cambio. Mentre va, il tempo passato si sottrae; da fermo, `clock`
 * è già la risposta.
 *
 * Tutte le vie di fuga portano a `clock`, cioè all'ultimo valore certo: una
 * data illeggibile e un orologio del dispositivo che va indietro non devono
 * produrre un numero inventato, e soprattutto non devono far crescere il tempo
 * residuo — un cronometro che torna indietro da solo è peggio di uno fermo.
 */
export function restano(g, adesso = Date.now()) {
  if (!g) return 0;
  const fermo = Math.max(0, Math.floor(Number(g.clock) || 0));
  if (!g.clockRunning || !g.clockFrom) return fermo;

  const da = new Date(g.clockFrom).getTime();
  if (!isFinite(da)) return fermo;

  const passati = Math.floor((adesso - da) / 1000);
  if (!(passati > 0)) return fermo;          // orologio indietro, o stesso istante

  return Math.max(0, fermo - passati);
}

/** Sta andando per davvero: in moto e non ancora a zero. */
export function inMoto(g, adesso = Date.now()) {
  return !!(g && g.clockRunning) && restano(g, adesso) > 0;
}

/* Avviare. A zero non si avvia: non c'è niente da far scorrere, e un
 * cronometro «in moto» fermo a zero direbbe il falso allo scout e
 * continuerebbe a non dare minuti a nessuno. */
export function avvia(g, adesso = Date.now()) {
  if (!g) return g;
  const resto = restano(g, adesso);
  if (resto <= 0) return g;
  g.clock = resto;
  g.clockRunning = true;
  g.clockFrom = new Date(adesso).toISOString();
  return g;
}

/** Fermare: si fissa quanto manca e si dimentica da quando. */
export function ferma(g, adesso = Date.now()) {
  if (!g) return g;
  g.clock = restano(g, adesso);
  g.clockRunning = false;
  g.clockFrom = null;
  return g;
}

export function scambia(g, adesso = Date.now()) {
  return (g && g.clockRunning) ? ferma(g, adesso) : avvia(g, adesso);
}

/* LA CORREZIONE, che è il motivo per cui questo cronometro si può accettare.
 *
 * Si scrive il numero del tabellone della palestra. Se era in moto riparte da
 * lì, perché chi corregge durante il gioco non vuole anche ritrovarsi il
 * cronometro fermo.
 */
export function imposta(g, secondi, conf, adesso = Date.now()) {
  if (!g) return g;
  const tetto = durataPeriodo(g, conf);
  const n = Math.max(0, Math.min(tetto, Math.floor(Number(secondi) || 0)));
  const andava = !!g.clockRunning && n > 0;
  g.clock = n;
  g.clockRunning = andava;
  g.clockFrom = andava ? new Date(adesso).toISOString() : null;
  return g;
}

/** Un periodo nuovo comincia pieno e FERMO: la palla non è ancora in gioco. */
export function nuovoPeriodo(g, conf) {
  if (!g) return g;
  g.clock = durataPeriodo(g, conf);
  g.clockRunning = false;
  g.clockFrom = null;
  return g;
}

/* I SECONDI DI UN TURNO.
 *
 * Un turno sono cinque persone in campo da un certo momento. Il momento lo
 * segna il cronometro, non l'orologio da parete: `cl` è quanto mancava quando
 * sono entrate. Quando il turno si chiude, i secondi giocati sono la
 * differenza — e se il cronometro era fermo per tutto il turno la differenza
 * è zero, che è esattamente quello che si vuole.
 *
 * Il numero è sempre >= 0. Un turno non può mai attraversare l'azzeramento di
 * fine periodo — il tracker chiude i turni quando chiude il periodo — ma se un
 * domani qualcuno cambiasse quell'ordine, un turno a cavallo del confine
 * darebbe una differenza negativa: meglio zero minuti che minuti all'indietro.
 */
export function secondiDelTurno(turno, restoOra) {
  const prima = Number((turno || {}).cl);
  const dopo = Number(restoOra);
  if (!isFinite(prima) || !isFinite(dopo)) return 0;
  return Math.max(0, Math.floor(prima - dopo));
}

/** «9:04», «0:07». Il formato del tabellone, non «544 s». */
export function mmss(secondi) {
  const n = Math.max(0, Math.floor(Number(secondi) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m + ':' + String(s).padStart(2, '0');
}

/** I minuti nel tabellino: «24:10», oppure «—» per chi non è mai entrato. */
export function minutiGiocati(stats) {
  const n = Math.max(0, Math.floor(Number((stats || {}).seconds) || 0));
  return n > 0 ? mmss(n) : '—';
}

import { calcolaPunteggi } from './punteggio.js';

/* COSA SUCCEDE QUANDO SI TOCCA UN PULSANTE DELLO SCOUT.
 *
 * È il cuore della partita: le statistiche del giocatore, il registro delle
 * azioni, il punteggio del periodo, e — nella pallavolo — il punto che il
 * nostro errore regala agli avversari.
 *
 * Stava dentro il componente React, insieme al lampo sul gettone e alla
 * domanda successiva. Sta qui per una ragione sola: **si deve poter far giocare
 * una partita intera senza un browser.** Un test che imitasse queste
 * venticinque righe proverebbe la propria imitazione; un test che chiama questa
 * funzione prova quello che tocca chi segna.
 *
 * Il componente resta responsabile di tutto ciò che è schermo — il riscontro
 * sul gettone, il pannello che si chiude, il salvataggio, la vibrazione — e di
 * `chiudiScambio`, che è la contabilità delle fasi della pallavolo e ha bisogno
 * di poter avvisare a voce quando il sestetto gira.
 *
 * NON DEVE LANCIARE MAI. Una partita può arrivare da una copia scritta a metà,
 * e uno scout in piedi che segna un'azione in meno vale infinitamente più di
 * uno schermo bianco a metà del primo quarto.
 */
export function applicaAzione({ g, sport, giocatore, azione, punto, linea, chiudiScambio }) {
  if (!g || !sport || !giocatore || !azione) return null;
  const conf = sport.scout || {};

  // Le statistiche ci devono essere PRIMA di scriverci dentro. La lettura qui
  // sotto è prudente, la scrittura no: su un giocatore senza `stats` — uno
  // aggiunto da un'altra parte, una copia vecchia — si lanciava al primo tocco
  // sul suo gettone.
  if (!giocatore.stats) giocatore.stats = sport.newStats();
  const s = giocatore.stats;

  /* Quanto vale questa azione in punti lo dice lo SPORT, non l'azione: nel
   * basket sta scritto (2, 3, 1), nella pallavolo è un `points: 1` dentro le
   * statistiche. Si misura la differenza prima e dopo, e va bene per tutti e
   * tre. */
  const primaPunti = sport.score(s || {});

  Object.entries(azione.apply || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });

  if (azione.nested) {
    Object.entries(azione.nested).forEach(([contenitore, chiave]) => {
      s[contenitore] = s[contenitore] || {};
      s[contenitore][chiave] = (s[contenitore][chiave] || 0) + 1;
    });
  }

  if (azione.teamFoul && conf.teamFouls) {
    g.quarterFouls = g.quarterFouls || {};
    g.quarterFouls[g.quarter] = (g.quarterFouls[g.quarter] || 0) + 1;
  }

  // Da dove è partito il tiro, quando qualcuno l'ha detto. Sta dentro il
  // giocatore perché è suo, e perché così viaggia con il tabellino.
  if (punto) {
    s.tiri = [...(s.tiri || []), {
      x: punto.x, y: punto.y, act: azione.act, dentro: !!azione.dentro, q: g.quarter || 1
    }];
  }

  // Da dove è partita la palla e dove è caduta. Come i tiri del basket, sta
  // dentro chi l'ha giocata.
  if (linea) {
    s.traiettorie = [...(s.traiettorie || []), { ...linea, act: azione.act, q: g.quarter || 1 }];
  }

  // Nel registro ci va OGNI azione, non solo quelle che fanno punti: un
  // rimbalzo e una palla persa non muovono il tabellone ma dicono com'è andato
  // quel quarto.
  annota(g, { a: azione.act, p: giocatore.id });

  // Il punteggio del periodo in corso cresce subito: è il numero che chi segna
  // confronta col tabellone della palestra.
  const guadagnati = sport.score(s || {}) - primaPunti;
  if (guadagnati) {
    segnaPeriodo(g, 'us', guadagnati);
    if (chiudiScambio) chiudiScambio('us');
  }

  /* I nostri errori sono punti loro: è la regola del gioco, e prima la doveva
   * applicare a mano chi segnava — due tocchi per un evento solo, e quello
   * dimenticato falsava il punteggio senza dirlo. */
  if (azione.puntoLoro) {
    annota(g, { a: 'loro', n: 1 });
    segnaPeriodo(g, 'them', 1);
    if (chiudiScambio) chiudiScambio('them');
  }

  calcolaPunteggi(g, sport);
  return { guadagnati };
}

/* IL REGISTRO DELLE AZIONI.
 *
 * Una riga per ogni cosa che succede, in ordine, con il periodo in cui è
 * successa. I totali dicono QUANTO; questo dice QUANDO — ed è l'unico modo per
 * avere il massimo vantaggio, il parziale più lungo e le statistiche periodo
 * per periodo, che dai totali non si ricavano.
 *
 * Tre forme sole: una nostra azione (`a` è il nome dell'azione, `p` chi l'ha
 * fatta), i punti degli avversari (`a: 'loro'`), una correzione del nostro
 * punteggio fatta a mano (`a: 'noi'`). I punti non si scrivono: si ricavano
 * rileggendo l'azione nella configurazione, così restano una verità sola.
 *
 * Non fa niente di più che aggiungere in fondo. È importante: se un domani
 * questa riga sbagliasse, il punteggio e il tabellino resterebbero giusti lo
 * stesso — a mancare sarebbero solo le sezioni nuove del referto.
 */
export function annota(g, voce) {
  if (!g || !voce) return;
  g.storia = [...(Array.isArray(g.storia) ? g.storia : []), { q: g.quarter || 1, ...voce }];
}

/* Il punteggio del periodo in corso, da una parte o dall'altra.
 *
 * Serve per forza in due casi che non passano dalle azioni dei nostri: i punti
 * che l'avversario fa — e che nessuno di noi ha «prodotto» — e, nella
 * pallavolo, i punti che prendiamo noi per un errore avversario, che non si
 * possono assegnare a nessun giocatore.
 */
export function segnaPeriodo(g, lato, delta) {
  if (!g) return;
  const idx = (g.quarter || 1) - 1;
  if (!Array.isArray(g.periodScores)) g.periodScores = [];
  const riga = g.periodScores[idx] || { us: 0, them: 0 };
  const nuovo = Math.max(0, (riga[lato] || 0) + delta);
  if (nuovo === riga[lato] && delta < 0) return;      // già a zero: niente da togliere
  /* Si COPIA la riga invece di rifarla: dentro ci sono anche chi batte, la
   * rotazione e i conti delle fasi, e riscriverla da zero li cancellerebbe. */
  g.periodScores[idx] = { ...riga, [lato]: nuovo };
}

/* COSA VUOL DIRE TOCCARE UNA FACCIA IN PANCHINA.
 *
 * Lo stesso gesto fa quattro cose diverse a seconda del momento della
 * partita, ed è la cosa più facile da sbagliare di tutto lo scout: un tocco
 * che a volte assegna un canestro e a volte manda uno in campo, senza una
 * regola che si possa dire ad alta voce, è un tocco di cui non ci si fida.
 *
 * La regola si dice ad alta voce, e sta qui: dal più esplicito al più
 * generico. Se c'è un evento armato, quell'evento sta aspettando un nome e
 * non c'è nient'altro da interpretare. Se c'è qualcuno che sta uscendo, la
 * domanda aperta è chi entra. Se il campo non è al completo, l'unica cosa
 * sensata è completarlo. Altrimenti lo si sceglie e basta.
 *
 * Sta fuori dal componente perché una regola con quattro rami si prova, e
 * perché scriverla una volta sola impedisce che la panchina stretta e quella
 * larga finiscano per comportarsi in due modi diversi.
 */
export function cosaFaIlTocco({ armato, sostituzione, campoCorto }) {
  if (armato) return 'assegna';
  if (sostituzione) return 'sostituisci';
  if (campoCorto) return 'inCampo';
  return 'scegli';
}

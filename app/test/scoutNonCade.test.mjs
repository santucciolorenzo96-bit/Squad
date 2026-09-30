import { describe, test, is, ok } from './run.mjs';
import { calcolaPunteggi } from '../src/utils/punteggio.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { CALCIO } from '../src/utils/sports/calcio.js';

/* LO SCOUT NON DEVE CADERE. MAI.
 *
 * Uno scout è stato dato a qualcuno per segnare un'amichevole, e dopo cinque
 * minuti è sparito dallo schermo. Non era un crash del browser: era
 * un'eccezione dentro un componente. L'app non aveva un error boundary, quindi
 * React ha smontato tutto l'albero e ha lasciato una pagina bianca — senza
 * messaggio, senza appiglio, senza niente da raccontare dopo.
 *
 * Il rimedio è in tre parti, e questa è la terza:
 *
 *   1. una rete di sicurezza (`Rete.jsx`), perché un'eccezione non deve più
 *      poter far scomparire una partita in corso;
 *   2. le guardie nei punti dove si scriveva senza chiedere;
 *   3. questi test, sulla funzione che gira PIÙ SPESSO DI TUTTE.
 *
 * `calcolaPunteggi` viene chiamata a ogni disegno dello scout. Se lancia lei,
 * lancia il disegno, e lo scout scompare. Sta in un file suo proprio perché
 * dentro un file con dentro React non si può provare niente su Node — e la
 * funzione che non deve poter lanciare è esattamente quella che va provata.
 *
 * I casi qui sotto non sono teorici. Una partita arriva da una copia scritta su
 * un telefono che stava esaurendo lo spazio, da una riga di database più
 * vecchia del codice che la legge, da un conflitto fra due dispositivi risolto
 * male. In palestra, senza rete, quello che c'è è quello che c'è.
 */

const SPORT = [['basket', BASKET], ['pallavolo', PALLAVOLO], ['calcio', CALCIO]];

// Le forme storte che una partita può avere davvero.
const STORTE = [
  ['vuota', {}],
  ['senza giocatori', { periodScores: [{ us: 10, them: 8 }] }],
  ['giocatori a null', { players: null, periodScores: [] }],
  ['giocatori non elenco', { players: { p1: {} }, periodScores: [] }],
  ['un giocatore a null nell elenco', { players: [null, { stats: {} }], periodScores: [] }],
  ['giocatori senza statistiche', { players: [{ id: 'a', name: 'Chi' }], periodScores: [] }],
  ['statistiche a null', { players: [{ id: 'a', stats: null }], periodScores: [] }],
  ['periodi a null', { players: [], periodScores: null }],
  ['periodi con buchi', { players: [], periodScores: [null, { us: 3 }, undefined, { them: 2 }] }],
  ['periodi non elenco', { players: [], periodScores: 'tre' }],
  ['tutto a null', { players: null, periodScores: null, storia: null, quarter: null }]
];

describe('il punteggio si calcola su qualunque partita, anche storta', () => {
  SPORT.forEach(([nome, sport]) => {
    STORTE.forEach(([come, base]) => {
      test(nome + ': una partita ' + come + ' non fa lanciare niente', () => {
        const g = Object.assign({ quarter: 1 }, base);
        // Non si controlla il risultato: si controlla che ci SIA un risultato.
        calcolaPunteggi(g, sport);
        ok(typeof g.teamScore === 'number' || g.teamScore === undefined,
          'il punteggio nostro e` venuto fuori ' + JSON.stringify(g.teamScore));
      });
    });
  });

  test('e senza sport non fa niente invece di lanciare', () => {
    const g = { players: [] };
    calcolaPunteggi(g, null);
    calcolaPunteggi(null, BASKET);
    calcolaPunteggi(g, {});
    ok(true);
  });
});

describe('il punteggio, quando la partita e in ordine', () => {
  test('nel basket e la somma dei punti dei giocatori', () => {
    const g = {
      quarter: 2,
      players: [
        // Nel basket i punti non sono una colonna: si ricavano dai tiri
        // segnati. 5 da due e 1 da tre fanno 13.
        { stats: Object.assign(BASKET.newStats(), { fgm2: 5, fgm3: 1 }) },
        { stats: Object.assign(BASKET.newStats(), { fgm2: 2, ftm: 2 }) }
      ],
      periodScores: [{ us: 10, them: 11 }, { us: 9, them: 6 }]
    };
    calcolaPunteggi(g, BASKET);
    is(g.teamScore, 19);
    is(g.oppScore, 17);
  });

  test('nella pallavolo sono i set vinti, e solo quelli chiusi', () => {
    const g = {
      quarter: 3, chiusi: 2,
      players: [],
      periodScores: [{ us: 25, them: 20 }, { us: 18, them: 25 }, { us: 20, them: 14 }]
    };
    calcolaPunteggi(g, PALLAVOLO);
    // Il terzo set è in corso: sul 20-14 nessuno ha ancora vinto niente.
    is(g.teamScore, 1);
    is(g.oppScore, 1);
  });

  test('una statistica assurda non porta via il conto degli altri', () => {
    // Un `points` arrivato come stringa, o come NaN, da una riga vecchia.
    const g = {
      quarter: 1,
      players: [
        { stats: Object.assign(BASKET.newStats(), { fgm2: 5 }) },
        // Un conteggio arrivato come parola da una riga vecchia: moltiplicato
        // per due fa NaN, e senza guardia il totale di tutta la squadra
        // diventa NaN.
        { stats: Object.assign(BASKET.newStats(), { fgm2: 'tre' }) },
        { stats: Object.assign(BASKET.newStats(), { ftm: 5 }) }
      ],
      periodScores: []
    };
    calcolaPunteggi(g, BASKET);
    // Senza la guardia il totale sarebbe NaN e sul tabellone si leggerebbe
    // «NaN - 0»: i quindici punti veri di due giocatori, cancellati dal dato
    // sporco di un terzo.
    is(g.teamScore, 15);
  });
});

/* -------------------------------------------------------------- l'annulla */

/* IL DIFETTO DELL'ANNULLA, riprodotto.
 *
 * L'annulla non modifica la partita: la SOSTITUISCE con una copia di prima.
 * Poi chiamava `salva()`, che leggeva la partita del disegno in corso — cioè
 * quella NON annullata. A schermo l'annullamento si vedeva; sul dispositivo e
 * sul server finiva l'azione che si era appena tolta, con la revisione che
 * avanzava.
 *
 * Chi annullava e poi ricaricava la pagina — o passava il tabellino a un altro
 * dispositivo — se la ritrovava. Il pulsante che serve a correggere un errore
 * era quello che ne faceva uno più difficile da vedere.
 *
 * Qui si rifà il giro con le stesse due funzioni dello scout: si memorizza, si
 * cambia, si annulla, e si guarda COSA sarebbe stato salvato.
 */
describe('annullare salva la partita annullata, non quella di prima', () => {
  function scout() {
    const pila = [];
    let partita = { punti: 0, storia: [] };
    let salvata = null;
    return {
      get partita() { return partita; },
      get salvata() { return salvata; },
      memorizza() { pila.push(JSON.stringify(partita)); },
      segna(n) {
        this.memorizza();
        // Come `esegui`: si scrive dentro la partita e poi si salva QUELLA.
        partita.punti += n;
        partita.storia = [...partita.storia, n];
        salvata = JSON.parse(JSON.stringify(partita));
      },
      /* Come era: si sostituisce la partita e si salva quella del disegno,
       * cioè la variabile che il codice aveva già in mano. */
      annullaComeEra() {
        const g = partita;                      // il `g` del disegno
        partita = JSON.parse(pila.pop());
        salvata = JSON.parse(JSON.stringify(g));
      },
      // Come è adesso: si dice quale partita salvare.
      annulla() {
        const prima = JSON.parse(pila.pop());
        partita = prima;
        salvata = JSON.parse(JSON.stringify(prima));
      }
    };
  }

  test('prima: a schermo tornava indietro, salvato restava avanti', () => {
    const s = scout();
    s.segna(3);
    s.annullaComeEra();
    is(s.partita.punti, 0, 'a schermo l’annullamento si vedeva');
    is(s.salvata.punti, 3, 'e nel salvato no: e` il difetto');
  });

  test('adesso: quello che si vede e quello che si salva sono la stessa cosa', () => {
    const s = scout();
    s.segna(3);
    s.annulla();
    is(s.partita.punti, 0);
    is(s.salvata.punti, 0);
  });

  test('e il registro delle azioni torna indietro insieme al punteggio', () => {
    const s = scout();
    s.segna(2);
    s.segna(3);
    s.annulla();
    is(s.partita.punti, 2);
    is(s.salvata.storia.length, 1);
  });

  test('due annullamenti di fila tornano di due passi', () => {
    const s = scout();
    s.segna(2);
    s.segna(3);
    s.annulla();
    s.annulla();
    is(s.salvata.punti, 0);
    is(s.salvata.storia.length, 0);
  });
});

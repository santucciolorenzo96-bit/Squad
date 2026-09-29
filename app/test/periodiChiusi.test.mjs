import { describe, test, is } from './run.mjs';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { quantiChiusi, refertoPartita } from '../src/utils/referto.js';

/* QUANTI PERIODI SONO FINITI DAVVERO.
 *
 * Il referto di una partita di pallavolo finita 0-3 mostrava il risultato
 * giusto e solo due set. Il documento si contraddiceva da solo, ed è il genere
 * di errore che toglie fiducia a tutto il resto della pagina.
 *
 * Il motivo: «quanti set sono finiti» non si ricava dal numero del set in
 * corso, perché l'ultimo set di una partita già decisa si chiude senza aprirne
 * un altro. Per questo c'è `chiusi` — che però non veniva salvato, e alla
 * rilettura non c'era più.
 */

const set = (us, them) => ({ us, them });

const finita = (periodi, extra) => Object.assign({
  oppName: 'Riccione', status: 'finished',
  periodScores: periodi, players: []
}, extra || {});

describe('una partita finita 0-3', () => {
  /* Tre set giocati e persi. Il terzo chiude la partita, quindi non se ne apre
   * un quarto: `quarter` resta 3, e «tre meno uno» ne perderebbe uno. */
  const g = finita([set(20, 25), set(22, 25), set(19, 25)], { quarter: 3, chiusi: 3 });

  test('con chiusi salvato, i set sono tre', () => {
    is(quantiChiusi(g), 3);
  });

  /* IL CASO CHE HA PRODOTTO L'ERRORE: la partita archiviata prima che `chiusi`
   * venisse salvato. Senza quel campo si ripiegava su «set in corso meno uno»,
   * cioe' due. */
  test('e anche senza, perche si contano i set in cui qualcuno ha segnato', () => {
    const vecchia = finita([set(20, 25), set(22, 25), set(19, 25)], { quarter: 3 });
    is(quantiChiusi(vecchia), 3);
  });

  test('il referto disegna tre righe, non due', () => {
    const vecchia = finita([set(20, 25), set(22, 25), set(19, 25)], { quarter: 3 });
    is(refertoPartita(vecchia, PALLAVOLO).set.length, 3);
  });

  test('e i set del referto raccontano lo stesso risultato del punteggio', () => {
    const r = refertoPartita(g, PALLAVOLO);
    const nostri = r.set.filter(s => s.us > s.them).length;
    const loro = r.set.filter(s => s.them > s.us).length;
    is(nostri, 0);
    is(loro, 3);
    is(nostri + loro, r.chiusi);
  });
});

describe('una partita ancora in corso non conta il periodo aperto', () => {
  /* Qui il ripiego NON deve scattare: il terzo set si sta giocando, e mostrarlo
   * fra quelli finiti vorrebbe dire dare per chiuso un set aperto. */
  const viva = {
    oppName: 'Riccione', status: 'live', quarter: 3, chiusi: 2,
    periodScores: [set(25, 20), set(21, 25), set(11, 8)], players: []
  };

  test('i set finiti sono due, non tre', () => {
    is(quantiChiusi(viva), 2);
  });

  test('anche senza chiusi in memoria', () => {
    is(quantiChiusi({ ...viva, chiusi: 0 }), 2);
  });
});

describe('i casi limite', () => {
  test('una partita finita senza nessun punto non inventa periodi', () => {
    is(quantiChiusi(finita([], { quarter: 1 })), 0);
  });

  test('un periodo rimasto a zero a zero non conta come giocato', () => {
    // Una riga puo' nascere anche solo da una rotazione registrata: si
    // guardano i punti, non l'esistenza della riga.
    const g = finita([set(25, 20), set(25, 22), set(0, 0)], { quarter: 3 });
    is(quantiChiusi(g), 2);
  });

  test('e il basket finito al quarto periodo ne conta quattro', () => {
    const g = finita([set(18, 15), set(20, 22), set(14, 19), set(25, 17)], { quarter: 4 });
    is(quantiChiusi(g), 4);
    is(refertoPartita(g, BASKET).set.length, 4);
  });

  test('un supplementare giocato si conta come tutti gli altri', () => {
    const g = finita(
      [set(18, 15), set(20, 22), set(14, 19), set(20, 16), set(9, 7)],
      { quarter: 5 }
    );
    is(quantiChiusi(g), 5);
  });
});

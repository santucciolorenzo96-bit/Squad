import { describe, test, is } from './run.mjs';
import {
  periodiRegolamentari, eSupplementare, nomePeriodo, periodiMancanti, pareggioImpossibile
} from '../src/utils/periodi.js';
import { SPORTS } from '../src/utils/sports/index.js';

/* I periodi di una partita.
 *
 * I casi sono scritti sui tre sport veri, non su una configurazione inventata:
 * la regola deve valere per quello che l'app ha davvero in mano, e la
 * pallavolo è qui perché è l'unica che NON ha i supplementari numerati — il
 * quarto set è il quarto set.
 */

const basket = SPORTS.basket.scout;
const calcio = SPORTS.calcio.scout;
const pallavolo = SPORTS.pallavolo.scout;

const ufficiale = (patch) => ({ friendly: false, teamScore: 0, oppScore: 0, ...patch });
const amichevole = (patch) => ({ friendly: true, teamScore: 0, oppScore: 0, ...patch });

describe('quanti periodi prevede il regolamento', () => {
  test('basket quattro, calcio due, pallavolo tre', () => {
    is(periodiRegolamentari(basket), 4);
    is(periodiRegolamentari(calcio), 2);
    is(periodiRegolamentari(pallavolo), 3);
  });

  test('senza configurazione non si va sotto uno', () => {
    is(periodiRegolamentari(null), 1);
    is(periodiRegolamentari({}), 1);
    is(periodiRegolamentari({ period: { count: 0 } }), 1);
  });
});

describe('il quinto periodo di una partita ufficiale è il primo supplementare', () => {
  test('nel basket il quinto, il sesto e il settimo sono supplementari', () => {
    is(eSupplementare(basket, 4), false);
    is(eSupplementare(basket, 5), true);
    is(eSupplementare(basket, 7), true);
  });

  test('e si chiamano col loro numero, non col numero del periodo', () => {
    is(nomePeriodo(basket, 4), '4º Periodo');
    is(nomePeriodo(basket, 5), '1º Supplementare');
    is(nomePeriodo(basket, 6), '2º Supplementare');
    is(nomePeriodo(basket, 7), '3º Supplementare');
  });

  test('sul tabellone stanno in due caratteri', () => {
    is(nomePeriodo(basket, 3, { breve: true }), 'P3');
    is(nomePeriodo(basket, 5, { breve: true }), 'S1');
    is(nomePeriodo(basket, 6, { breve: true }), 'S2');
  });

  test('nel calcio il terzo tempo è il primo supplementare', () => {
    is(nomePeriodo(calcio, 2), '2º Tempo');
    is(nomePeriodo(calcio, 3), '1º Supplementare');
  });
});

describe('la pallavolo non ha supplementari: il quarto set è il quarto set', () => {
  test('il quarto e il quinto set non diventano supplementari', () => {
    is(eSupplementare(pallavolo, 4), false);
    is(eSupplementare(pallavolo, 5), false);
  });

  test('e si chiamano col loro numero', () => {
    is(nomePeriodo(pallavolo, 4), '4º Set');
    is(nomePeriodo(pallavolo, 5), '5º Set');
    is(nomePeriodo(pallavolo, 5, { breve: true }), 'S5');
  });
});

describe('in amichevole il quinto quarto è il quinto quarto', () => {
  /* È la differenza che l'utente ha chiesto a parole: in amichevole «se
   * voglio fare il quinto quarto posso farlo», e non è un supplementare —
   * non c'è nessuna fine prevista dopo cui venga. */
  test('niente supplementari', () => {
    is(eSupplementare(basket, 5, { amichevole: true }), false);
    is(eSupplementare(basket, 9, { amichevole: true }), false);
  });

  test('il nome resta quello del periodo', () => {
    is(nomePeriodo(basket, 5, { amichevole: true }), '5º Periodo');
    is(nomePeriodo(basket, 6, { amichevole: true, breve: true }), 'P6');
  });
});

describe('quanti periodi restano da chiudere', () => {
  test('una partita ufficiale a meta del secondo quarto: ne restano tre', () => {
    is(periodiMancanti(basket, ufficiale({ numQuarters: 4 }), 1), 3);
  });

  test('tutti chiusi: zero, non un numero negativo', () => {
    is(periodiMancanti(basket, ufficiale({ numQuarters: 4 }), 4), 0);
    is(periodiMancanti(basket, ufficiale({ numQuarters: 4 }), 6), 0);
  });

  test('UN SUPPLEMENTARE APERTO NON È UN PERIODO CHE MANCA', () => {
    /* Chiudendo il quarto quarto lo scout apre comunque il quinto periodo, e
     * `numQuarters` diventa cinque. Contando da `numQuarters`, una normale
     * vittoria al quarto quarto finiva con «ne resta ancora uno da chiudere»
     * e il pulsante rosso: un allarme su una partita giocata per intero. */
    is(periodiMancanti(basket, ufficiale({ numQuarters: 5 }), 4), 0);
  });

  test('e un supplementare giocato non ne fa mancare un altro', () => {
    is(periodiMancanti(basket, ufficiale({ numQuarters: 6 }), 5), 0);
  });

  test('chiudere al secondo quarto resta un avviso, come prima', () => {
    is(periodiMancanti(basket, ufficiale({ numQuarters: 4 }), 2), 2);
  });

  test('IN AMICHEVOLE SEMPRE ZERO, anche al primo quarto', () => {
    is(periodiMancanti(basket, amichevole({ numQuarters: 4 }), 0), 0);
    is(periodiMancanti(basket, amichevole({ numQuarters: 4 }), 1), 0);
    is(periodiMancanti(basket, amichevole({ numQuarters: 4 }), 2), 0);
  });

  test('senza partita non manca niente', () => {
    is(periodiMancanti(basket, null, 0), 0);
  });
});

describe('una partita ufficiale di basket non finisce in parità', () => {
  test('in parità sì, e lo dice', () => {
    is(pareggioImpossibile(basket, ufficiale({ teamScore: 61, oppScore: 61 })), true);
  });

  test('con un vincitore no', () => {
    is(pareggioImpossibile(basket, ufficiale({ teamScore: 62, oppScore: 61 })), false);
  });

  test('a zero a zero sì: una partita non ancora cominciata è in parità', () => {
    // Non è un falso positivo: chiudere un tabellino 0–0 è proprio la cosa
    // che non si vuole archiviare per sbaglio.
    is(pareggioImpossibile(basket, ufficiale({ teamScore: 0, oppScore: 0 })), true);
  });

  test('IN AMICHEVOLE UN PAREGGIO È UN PAREGGIO', () => {
    is(pareggioImpossibile(basket, amichevole({ teamScore: 61, oppScore: 61 })), false);
  });

  test('nel calcio un pareggio è un risultato, anche in campionato', () => {
    is(pareggioImpossibile(calcio, ufficiale({ teamScore: 1, oppScore: 1 })), false);
  });

  test('nella pallavolo non ci si arriva: si contano i set', () => {
    is(pareggioImpossibile(pallavolo, ufficiale({ teamScore: 2, oppScore: 2 })), false);
  });
});

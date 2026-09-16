import { describe, test, is, ok } from './run.mjs';
import { chiaveQuintetto, saldoTurno, sommaQuintetto, quintettiOrdinati } from '../src/utils/regole.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { refertoPartita } from '../src/utils/referto.js';

/* I quintetti.
 *
 * Non costano un tocco in più: i cambi si segnano già, il punteggio si muove
 * già. Tutto quello che serve è ricordare com'era il tabellone quando quei
 * cinque sono entrati. Quindi la cosa da provare è una sola — che il saldo
 * finisca sempre a chi era in campo, e mai a chi è appena entrato.
 */

const CINQUE = ['a', 'b', 'c', 'd', 'e'];

describe('il quintetto: cinque persone, non un ordine', () => {
  test('gli stessi cinque si riconoscono comunque siano stati composti', () => {
    is(chiaveQuintetto(['e', 'a', 'd', 'c', 'b']), chiaveQuintetto(CINQUE));
  });

  test('cambiarne uno è un altro quintetto', () => {
    ok(chiaveQuintetto(['a', 'b', 'c', 'd', 'f']) !== chiaveQuintetto(CINQUE));
  });
});

describe('il saldo di un turno', () => {
  const turno = { ids: CINQUE, us: 10, them: 8 };

  test('è la differenza fra com’era e com’è', () => {
    const e = saldoTurno(turno, 22, 14);
    is(e.f, 12);
    is(e.s, 6);
    is(e.saldo, 6);
  });

  test('un turno in cui si è andati sotto ha saldo negativo', () => {
    is(saldoTurno(turno, 12, 18).saldo, -8);
  });

  test('un turno senza punti non si registra', () => {
    // Tre cambi di fila a un time out creano quintetti che non hanno mai
    // visto un pallone: contarli riempirebbe la tabella di righe 0–0.
    is(saldoTurno(turno, 10, 8), null);
  });

  test('senza turno aperto non c’è niente da chiudere', () => {
    is(saldoTurno(null, 20, 10), null);
    is(saldoTurno({ ids: [], us: 0, them: 0 }, 20, 10), null);
  });
});

describe('i turni si sommano', () => {
  test('gli stessi cinque che tornano in campo continuano la loro storia', () => {
    let q = {};
    q = sommaQuintetto(q, saldoTurno({ ids: CINQUE, us: 0, them: 0 }, 10, 6));
    q = sommaQuintetto(q, saldoTurno({ ids: CINQUE, us: 30, them: 28 }, 36, 30));
    const riga = q[chiaveQuintetto(CINQUE)];
    is(riga.f, 16);
    is(riga.s, 8);
    is(riga.turni, 2);
  });

  test('un saldo nullo non crea una riga', () => {
    is(Object.keys(sommaQuintetto({}, null)).length, 0);
  });
});

describe('i quintetti in tabella', () => {
  const q = {
    'a|b|c|d|e': { f: 20, s: 10, turni: 3 },   // +10
    'a|b|c|d|f': { f: 8, s: 14, turni: 1 },    // −6
    'a|b|c|g|h': { f: 12, s: 12, turni: 4 }    // 0
  };

  test('dal migliore al peggiore', () => {
    is(quintettiOrdinati(q).map(x => x.saldo).join(','), '10,0,-6');
  });

  test('senza registro non si rompe', () => {
    is(quintettiOrdinati(null).length, 0);
    is(quintettiOrdinati({}).length, 0);
  });
});

describe('il referto: i quintetti con i nomi', () => {
  const partita = {
    oppName: 'Aurora', teamScore: 68, oppScore: 54, quarter: 4, chiusi: 4,
    periodScores: [{ us: 20, them: 12 }, { us: 14, them: 16 }, { us: 18, them: 13 }, { us: 16, them: 13 }],
    players: [
      { id: 'a', number: '4', name: 'Rossi', stats: BASKET.newStats() },
      { id: 'b', number: '7', name: 'Bianchi', stats: BASKET.newStats() },
      { id: 'c', number: '9', name: 'Verdi', stats: BASKET.newStats() },
      { id: 'd', number: '11', name: 'Neri', stats: BASKET.newStats() },
      { id: 'e', number: '13', name: 'Gialli', stats: BASKET.newStats() }
    ],
    quintetti: { 'a|b|c|d|e': { f: 40, s: 28, turni: 5 } }
  };

  test('al posto degli identificativi ci sono i numeri di maglia', () => {
    const r = refertoPartita(partita, BASKET);
    is(r.quintetti.length, 1);
    is(r.quintetti[0].saldo, 12);
    is(r.quintetti[0].nomi.join(' '), '#4 #7 #9 #11 #13');
  });

  test('una partita senza registro non mostra nessun quintetto', () => {
    is(refertoPartita({ ...partita, quintetti: undefined }, BASKET).quintetti.length, 0);
  });

  test('nella pallavolo non c’è nessun registro da tenere', () => {
    // La struttura della pallavolo è la rotazione, non il quintetto, e i
    // cambi sono un'altra cosa: lo scout non apre nemmeno un turno.
    is(BASKET.scout.quintetti, true);
    ok(!PALLAVOLO.scout.quintetti);
  });
});

describe('i punti avversari, come li fanno', () => {
  test('il basket dichiara uno, due e tre', () => {
    is((BASKET.scout.manoPunti || []).join(','), '1,2,3');
  });
});

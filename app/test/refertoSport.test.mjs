import { describe, test, is, ok } from './run.mjs';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { CALCIO } from '../src/utils/sports/calcio.js';
import { refertoPartita } from '../src/utils/referto.js';

/* OGNI SPORT HA IL SUO REFERTO.
 *
 * Il referto della pallavolo mostrava i rimbalzi a zero e quattro anelli vuoti
 * al posto delle percentuali al tiro: non era un referto incompleto, era il
 * referto di un altro gioco. Le sezioni le dichiara lo sport, e questi test
 * servono a non farle tornare a mescolarsi.
 */

const partitaVolley = () => ({
  oppName: 'Riccione', teamScore: 3, oppScore: 1, quarter: 4, chiusi: 4,
  periodScores: [{ us: 25, them: 20 }, { us: 21, them: 25 }, { us: 25, them: 22 }, { us: 25, them: 19 }],
  players: [{
    id: 'a', number: '4', name: 'Baroncini',
    stats: Object.assign(PALLAVOLO.newStats(), {
      points: 21, kills: 18, attacks: 44, attackErrors: 6, attackPos: 12,
      aces: 3, serveErrors: 4, servePos: 9,
      recPerf: 10, recPos: 14, recNeg: 5, receptionErrors: 3,
      digs: 11, digNeg: 4, digErrors: 2, blocks: 4, assists: 2, attackBlocked: 5
    })
  }]
});

describe('la pallavolo ha i fondamentali, non i tiri', () => {
  const c = PALLAVOLO.ciambelle(partitaVolley().players[0].stats);

  test('quattro anelli, e sono i quattro fondamentali', () => {
    is(c.map(x => x.etichetta).join(','), 'Attacco,Ricezione,Difesa,Servizio');
  });

  test('l attacco e la percentuale di vincenti sui tentati', () => {
    is(c[0].pct, 41);          // 18 su 44
    is(c[0].righe[0][0], 18);
    is(c[0].righe[1][0], 6);
  });

  test('la ricezione e la positivita: perfette piu positive sul totale', () => {
    is(c[1].pct, 75);          // (10+14) su 32
  });

  test('i due conteggi si chiamano come si chiamano nella pallavolo', () => {
    is(c[0].righe[0][1], 'vincenti');
    is(c[0].righe[1][1], 'errori');
    is(c[3].righe[0][1], 'ace');
  });

  test('senza nessuna palla giocata non si disegna niente', () => {
    is(PALLAVOLO.ciambelle(PALLAVOLO.newStats()), null);
  });
});

describe('i numeri della pallavolo non sono quelli del basket', () => {
  const r = PALLAVOLO.riepilogo(partitaVolley().players[0].stats);
  const nomi = r.map(x => x.etichetta);

  test('ci sono muri, ace e punti regalati', () => {
    ok(nomi.includes('muri punto'));
    ok(nomi.includes('ace'));
    ok(nomi.includes('punti regalati'));
  });

  /* IL TEST CHE PRENDE L'ERRORE SEGNALATO. */
  test('e NON ci sono rimbalzi, palle rubate o stoppate', () => {
    ['rimbalzi', 'offensivi', 'difensivi', 'palle rubate', 'stoppate', 'falli'].forEach(x => {
      is(nomi.includes(x), false, x + ' non c’entra niente con la pallavolo');
    });
  });

  test('l efficienza si calcola togliendo gli errori', () => {
    // (18 - 6) / 44 = 27%
    const eff = r.find(x => x.etichetta === 'efficienza att.');
    is(eff.valore, '27%');
  });

  test('i punti regalati sono la somma dei nostri errori', () => {
    // 6 attacco + 4 servizio + 3 ricezione + 2 difesa
    is(r.find(x => x.etichetta === 'punti regalati').valore, 15);
  });
});

describe('il basket resta quello che era', () => {
  const s = Object.assign(BASKET.newStats(), {
    fgm2: 9, fga2: 20, fgm3: 4, fga3: 10, ftm: 7, fta: 10, orb: 6, drb: 21, ast: 11
  });

  test('quattro anelli al tiro', () => {
    is(BASKET.ciambelle(s).map(x => x.etichetta).join(','), 'Dal campo,Da due,Da tre,Tiri liberi');
  });

  test('«dal campo» somma due e tre e lascia fuori i liberi', () => {
    is(BASKET.ciambelle(s)[0].pct, 43);
  });

  test('e i rimbalzi ci sono, perche nel basket esistono', () => {
    const nomi = BASKET.riepilogo(s).map(x => x.etichetta);
    ok(nomi.includes('rimbalzi'));
    is(BASKET.riepilogo(s).find(x => x.etichetta === 'rimbalzi').valore, 27);
  });

  test('ma non ci sono ace ne muri', () => {
    const nomi = BASKET.riepilogo(s).map(x => x.etichetta);
    is(nomi.includes('ace'), false);
    is(nomi.includes('muri punto'), false);
  });
});

describe('il calcio non ha anelli', () => {
  test('non dichiara ciambelle: otto tiri non fanno una percentuale', () => {
    is(typeof CALCIO.ciambelle, 'undefined');
  });

  test('ma ha i suoi conteggi', () => {
    const nomi = CALCIO.riepilogo(CALCIO.newStats()).map(x => x.etichetta);
    ok(nomi.includes('gol'));
    ok(nomi.includes('parate'));
  });
});

describe('il referto completo di una partita di pallavolo', () => {
  const r = refertoPartita(partitaVolley(), PALLAVOLO);

  test('porta i fondamentali della pallavolo', () => {
    is(r.ciambelle[0].etichetta, 'Attacco');
  });

  test('e nei numeri di squadra non c e niente del basket', () => {
    is(r.riepilogo.map(x => x.etichetta).includes('rimbalzi'), false);
  });

  test('senza registro non ci sono i set uno per uno', () => {
    is(r.ciambellePeriodi, null);
  });
});

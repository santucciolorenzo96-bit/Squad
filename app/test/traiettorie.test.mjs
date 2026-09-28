import { describe, test, is, ok } from './run.mjs';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { refertoPartita, traiettoriePartita } from '../src/utils/referto.js';

/* Le traiettorie dei punti.
 *
 * Il tabellino dice che Rossi ha fatto quattordici punti. La mappa dice che
 * dodici sono partiti dalla stessa zona e caduti nello stesso metro
 * quadrato, e che gli avversari non l'hanno mai coperto. Sono due
 * informazioni diverse, e la seconda esiste solo se la si disegna.
 */

const conLinee = (linee) => ({
  oppName: 'Riccione', teamScore: 3, oppScore: 1, quarter: 4, chiusi: 4,
  periodScores: [{ us: 25, them: 20 }, { us: 21, them: 25 }, { us: 25, them: 22 }, { us: 25, them: 19 }],
  players: [{
    id: 'r', number: '4', name: 'Baroncini',
    stats: Object.assign(PALLAVOLO.newStats(), { traiettorie: linee })
  }]
});

describe('il campo intero esiste solo dove serve', () => {
  test('la pallavolo lo porta con sé, con le sue proporzioni', () => {
    ok(PALLAVOLO.campoIntero);
    is(PALLAVOLO.campoInteroRatio, 200 / 90);
  });

  test('il basket no: una traiettoria lì non vuol dire niente', () => {
    ok(!BASKET.campoIntero);
  });

  test('solo il punto chiede la traiettoria', () => {
    const azioni = PALLAVOLO.scout.groups.flatMap(g => g.actions);
    const conT = azioni.filter(a => a.traiettoria).map(a => a.act);
    is(conT.join(','), 'kill');
  });
});

describe('le traiettorie nel referto', () => {
  test('finiscono in un elenco solo, con chi le ha giocate', () => {
    const r = refertoPartita(conLinee([
      { x1: 20, y1: 30, x2: 78, y2: 60, act: 'kill', q: 1 },
      { x1: 22, y1: 28, x2: 80, y2: 62, act: 'kill', q: 2 }
    ]), PALLAVOLO);
    is(r.traiettorie.length, 2);
    is(r.traiettorie[0].numero, '4');
    is(r.traiettorie[0].nome, 'Baroncini');
  });

  test('una partita senza traiettorie non ne mostra una mappa vuota', () => {
    is(refertoPartita(conLinee([]), PALLAVOLO).traiettorie, null);
  });

  test('senza giocatori non si rompe', () => {
    is(traiettoriePartita({ players: [] }), null);
    is(traiettoriePartita({}), null);
  });

  test('la statistica nasce con l’elenco vuoto, non indefinito', () => {
    // Senza, il primo `push` su una partita vecchia esploderebbe.
    ok(Array.isArray(PALLAVOLO.newStats().traiettorie));
  });
});

/* ---------------------------------------------------------- per atleta ---- */
/* La mappa di squadra risponde a «dove cadono i nostri punti». Il referto lo
 * si guarda per un'altra domanda: «dove attacca la 4». */
describe('le traiettorie divise per chi le ha giocate', () => {
  const due = {
    oppName: 'Riccione', teamScore: 3, oppScore: 0, quarter: 3, chiusi: 3,
    periodScores: [{ us: 25, them: 20 }, { us: 25, them: 22 }, { us: 25, them: 19 }],
    players: [
      { id: 'a', number: '4', name: 'Baroncini', stats: Object.assign(PALLAVOLO.newStats(), {
        traiettorie: [
          { x1: 20, y1: 40, x2: 80, y2: 70, act: 'kill', q: 1 },
          { x1: 22, y1: 41, x2: 79, y2: 72, act: 'kill', q: 2 }
        ]
      }) },
      { id: 'b', number: '9', name: 'Conti', stats: Object.assign(PALLAVOLO.newStats(), {
        traiettorie: [{ x1: 60, y1: 40, x2: 30, y2: 75, act: 'kill', q: 1 }]
      }) },
      { id: 'c', number: '7', name: 'Senza', stats: PALLAVOLO.newStats() }
    ]
  };

  const r = refertoPartita(due, PALLAVOLO);

  test('c e una riga per ogni atleta che ha attaccato', () => {
    is(r.traiettorieAtleti.length, 2);
  });

  test('e nessuna per chi non ha traiettorie', () => {
    is(r.traiettorieAtleti.some(x => x.id === 'c'), false);
  });

  test('chi ha attaccato di piu sta in cima', () => {
    is(r.traiettorieAtleti[0].numero, '4');
    is(r.traiettorieAtleti[0].linee.length, 2);
  });

  test('ognuno si porta nome e numero: la mappa senza nome non serve', () => {
    is(r.traiettorieAtleti[1].nome, 'Conti');
    is(r.traiettorieAtleti[1].numero, '9');
  });

  test('la mappa di squadra resta, con tutte e tre', () => {
    is(r.traiettorie.length, 3);
  });

  test('e senza traiettorie l elenco e vuoto, non nullo', () => {
    const vuoto = refertoPartita(conLinee([]), PALLAVOLO);
    is(vuoto.traiettorieAtleti.length, 0);
  });
});

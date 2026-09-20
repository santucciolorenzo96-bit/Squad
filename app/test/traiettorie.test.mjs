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

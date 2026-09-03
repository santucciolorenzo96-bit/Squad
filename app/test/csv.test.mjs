import { describe, test, is } from './run.mjs';
import { toCsv, safeName } from '../src/utils/csv.js';

describe('export CSV', () => {
  test('separa con punto e virgola, come si aspetta Excel italiano', () => {
    is(toCsv(['A', 'B'], [[1, 2]]), 'A;B\n1;2');
  });

  // Un nome che contiene il separatore romperebbe le colonne: diventa virgola.
  test('un separatore dentro un valore non spezza le colonne', () => {
    const out = toCsv(['Nome'], [['Rossi; Mario']]);
    is(out.split('\n')[1], 'Rossi, Mario');
  });

  test('gli a capo dentro un valore non creano righe finte', () => {
    const out = toCsv(['Nota'], [['prima\nseconda']]);
    is(out.split('\n').length, 2);
  });

  test('null e undefined diventano celle vuote', () => {
    is(toCsv(['A', 'B'], [[null, undefined]]), 'A;B\n;');
  });

  test('il nome file resta utilizzabile su qualunque sistema', () => {
    is(safeName('Basket Catania / U15'), 'basket_catania_u15');
    is(safeName(''), 'squad');
  });
});

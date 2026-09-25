import { describe, test, is, ok } from './run.mjs';
import {
  normalizzaNumero, senzaNumero, numeriOccupati, numeriLiberi,
  obiezioneNumero, doppioniNelModulo
} from '../src/utils/maglie.js';

/* Le stesse regole stanno in choose_my_number() (migrazione 040): li' sono la
 * difesa, qui sono la cortesia. Questi test servono a non lasciare che le due
 * si scollino — se l'app propone un numero che il database poi rifiuta, il
 * genitore vede un errore dove gli avevamo promesso una scelta. */

const ROSA = [
  { id: 'a', name: 'Dario Moré', number: '11' },
  { id: 'b', name: 'Lorenzo Santuccio', number: '16' },
  { id: 'c', name: 'Sergio La Malfa', number: '-' },
  { id: 'd', name: 'Daniele Conti', number: '' },
  { id: 'e', name: 'Lorenzo Giglio', number: '0' }
];

describe('che cosa e un numero di maglia', () => {
  test('le cifre si', () => {
    is(normalizzaNumero('7'), '7');
    is(normalizzaNumero('16'), '16');
    is(normalizzaNumero(' 23 '), '23');
  });

  test('lo zero davanti si toglie: 07 e 7 sono lo stesso numero', () => {
    is(normalizzaNumero('07'), '7');
    is(normalizzaNumero('007'), '7');
  });

  test('ma lo 0 e lo 00 restano due numeri diversi', () => {
    is(normalizzaNumero('0'), '0');
    is(normalizzaNumero('00'), '00');
    is(normalizzaNumero('000'), '00');
  });

  test('tutto il resto no', () => {
    is(normalizzaNumero(''), '');
    is(normalizzaNumero('-'), '');
    is(normalizzaNumero('7b'), '');
    is(normalizzaNumero('1234'), '');
    is(normalizzaNumero(null), '');
  });
});

describe('chi non ha il numero', () => {
  test('il segnaposto conta come niente', () => {
    is(senzaNumero({ number: '-' }), true);
    is(senzaNumero({ number: '' }), true);
    is(senzaNumero({ number: null }), true);
    is(senzaNumero({}), true);
  });

  test('e lo zero invece e un numero vero', () => {
    is(senzaNumero({ number: '0' }), false);
    is(senzaNumero({ number: '16' }), false);
  });
});

describe('quali numeri sono liberi', () => {
  test('quelli di chi non ne ha non occupano niente', () => {
    const presi = numeriOccupati(ROSA);
    is(Object.keys(presi).length, 3);
    is(presi['11'], 'Dario Moré');
    is(presi['0'], 'Lorenzo Giglio');
  });

  test('il proprio numero non blocca se stessi', () => {
    is(numeriOccupati(ROSA, 'a')['11'], undefined);
  });

  test('i suggerimenti saltano i presi e partono da zero', () => {
    const liberi = numeriLiberi(ROSA, null, 5);
    is(liberi.join(','), '1,2,3,4,5');
  });

  test('e chi sta gia scegliendo non blocca gli altri del modulo', () => {
    const liberi = numeriLiberi(ROSA, ['a', 'e'], 3);
    is(liberi.join(','), '0,1,2');
  });
});

describe('il motivo del no, scritto in italiano', () => {
  test('un numero libero non ha obiezioni', () => {
    is(obiezioneNumero('9', ROSA), null);
  });

  test('un numero preso dice di chi e', () => {
    const o = obiezioneNumero('16', ROSA);
    ok(o && o.indexOf('Lorenzo Santuccio') >= 0);
  });

  test('07 e preso se 7... no, e libero: 7 non ce l ha nessuno', () => {
    is(obiezioneNumero('07', ROSA), null);
  });

  test('011 invece e l undici di Dario', () => {
    const o = obiezioneNumero('011', ROSA);
    ok(o && o.indexOf('Dario Moré') >= 0);
  });

  test('una parola non e un numero', () => {
    ok(obiezioneNumero('sette', ROSA));
  });
});

describe('due caselle con lo stesso numero, nello stesso modulo', () => {
  test('nessuno le vedrebbe: non sono ancora in rosa', () => {
    is(Object.keys(numeriOccupati(ROSA, ['c', 'd'])).indexOf('4'), -1);
  });

  test('e invece si vedono', () => {
    const doppi = doppioniNelModulo({ c: '4', d: '04' });
    is(Object.keys(doppi).join(','), '4');
    is(doppi['4'].length, 2);
  });

  test('numeri diversi non sono doppioni', () => {
    is(Object.keys(doppioniNelModulo({ c: '4', d: '5' })).length, 0);
  });

  test('le caselle lasciate vuote non contano', () => {
    is(Object.keys(doppioniNelModulo({ c: '', d: '' })).length, 0);
  });
});

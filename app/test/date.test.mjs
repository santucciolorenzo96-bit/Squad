import { describe, test, is, ok } from './run.mjs';
import { giornoISO, oggiISO, fraGiorniISO } from '../src/utils/format.js';

/* Le date senza ora.
 *
 * In quest'app una data è un giorno del calendario, non un istante: un
 * allenamento non ha un fuso orario, ha un giorno. `toISOString()` invece
 * sceglie un istante e lo converte in UTC, e da mezzanotte locale in Italia
 * sono le 22:00 del giorno prima.
 *
 * Erano due difetti veri e silenziosi: l'allenamento aggiunto dopo cena
 * arrivava con la data di domani, e un programma «ogni martedì» generava
 * tutti lunedì. Questi test esistono perché non tornino.
 */

describe('il giorno resta quello dell’orologio di chi guarda', () => {
  test('la mezzanotte locale non scivola al giorno prima', () => {
    // È il caso che rompeva le ricorrenze: si parte dalla mezzanotte locale
    // del giorno voluto, e convertirla in UTC la riporta indietro.
    const martedi = new Date('2026-09-22T00:00:00');
    is(giornoISO(martedi), '2026-09-22');
  });

  test('la sera tardi è ancora oggi', () => {
    // Il caso dell’allenatore che aggiunge l’allenamento dopo cena.
    is(giornoISO(new Date('2026-09-22T23:30:00')), '2026-09-22');
  });

  test('il primo mattino è già oggi', () => {
    is(giornoISO(new Date('2026-09-22T00:30:00')), '2026-09-22');
  });

  test('mezzogiorno, che non è mai stato in dubbio', () => {
    is(giornoISO(new Date('2026-09-22T12:00:00')), '2026-09-22');
  });
});

describe('gli scostamenti sono in giorni, non in millisecondi', () => {
  test('domani è il giorno dopo', () => {
    const oggi = new Date(oggiISO() + 'T12:00:00');
    const domani = new Date(fraGiorniISO(1) + 'T12:00:00');
    is(Math.round((domani - oggi) / 86400000), 1);
  });

  test('all’indietro funziona uguale', () => {
    const oggi = new Date(oggiISO() + 'T12:00:00');
    const settimanaFa = new Date(fraGiorniISO(-7) + 'T12:00:00');
    is(Math.round((oggi - settimanaFa) / 86400000), 7);
  });

  test('il cambio dell’ora legale non sposta di un giorno', () => {
    // L'ultima domenica di ottobre dura 25 ore: sommando 86400000
    // millisecondi si finisce alle 23:00 del giorno prima. Con setDate no.
    is(fraGiorniISO(1, new Date('2026-10-24T12:00:00')), '2026-10-25');
    is(fraGiorniISO(1, new Date('2026-10-25T12:00:00')), '2026-10-26');
  });
});

describe('le date storte non producono stringhe storte', () => {
  test('una data impossibile dà una stringa vuota, non «Invalid Date»', () => {
    is(giornoISO('non è una data'), '');
    is(giornoISO(new Date('boh')), '');
  });

  test('oggi è sempre una data scrivibile', () => {
    ok(/^\d{4}-\d{2}-\d{2}$/.test(oggiISO()));
  });
});

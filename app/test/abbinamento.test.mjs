import { describe, test, is, ok } from './run.mjs';
import { abbinaCalendario } from '../src/utils/regole.js';

/* Quale riga di calendario è questa partita.
 *
 * A fine partita il risultato deve tornare sulla riga giusta. Ci tornava
 * solo se qualcuno l'aveva scelta all'avvio da un elenco che mostrava due
 * giorni: bastava scoutare una rinviata, o segnare il giorno dopo da un
 * video, e il legame non c'era.
 *
 * Ma scrivere un risultato sulla partita SBAGLIATA è peggio che non
 * scriverlo. Questi test esistono per quello: quasi tutti verificano che in
 * caso di dubbio non si scelga niente.
 */

const OGGI = '2026-09-20';
const p = (opponent, date, extra) =>
  Object.assign({ id: opponent + date, opponent, date, played: false }, extra);

describe('la riga si ritrova', () => {
  const cal = [
    p('Virtus Forlimpopoli', '2026-09-20'),
    p('Basket Riccione', '2026-10-04')
  ];

  test('stessa giornata, nome identico', () => {
    is(abbinaCalendario(cal, 'Virtus Forlimpopoli', OGGI).date, '2026-09-20');
  });

  test('il giorno dopo, segnando da un video', () => {
    is(abbinaCalendario(cal, 'Virtus Forlimpopoli', '2026-09-21').date, '2026-09-20');
  });

  test('accenti, maiuscole e spazi doppi non contano', () => {
    ok(abbinaCalendario([p('Città di Ròma', '2026-09-20')], 'CITTA DI  ROMA', OGGI));
  });
});

describe('in caso di dubbio non si sceglie', () => {
  test('un nome che somiglia non è lo stesso nome', () => {
    // «Virtus» e «Virtus Roma» sono due società diverse, e scrivere il
    // risultato sull'altra è un danno che nessuno va a cercare.
    is(abbinaCalendario([p('Virtus Roma', '2026-09-20')], 'Virtus', OGGI), null);
    is(abbinaCalendario([p('Virtus', '2026-09-20')], 'Virtus Roma', OGGI), null);
  });

  test('due partite alla stessa distanza da oggi', () => {
    // Andata e ritorno contro la stessa squadra, una prima e una dopo: non
    // c'è modo di sapere quale si è appena giocata.
    const cal = [p('Aurora', '2026-09-18'), p('Aurora', '2026-09-22')];
    is(abbinaCalendario(cal, 'Aurora', OGGI), null);
  });

  test('ma se una è più vicina, è quella', () => {
    const cal = [p('Aurora', '2026-09-19'), p('Aurora', '2026-12-14')];
    is(abbinaCalendario(cal, 'Aurora', OGGI).date, '2026-09-19');
  });

  test('il ritorno a marzo non è la partita di oggi', () => {
    is(abbinaCalendario([p('Aurora', '2027-03-14')], 'Aurora', OGGI), null);
  });

  test('una partita già giocata non si riscrive', () => {
    is(abbinaCalendario([p('Aurora', '2026-09-20', { played: true })], 'Aurora', OGGI), null);
  });

  test('una riga senza data non si può abbinare', () => {
    is(abbinaCalendario([p('Aurora', null)], 'Aurora', OGGI), null);
  });
});

describe('i casi vuoti', () => {
  test('nessun calendario, nessun nome, nessuna data', () => {
    is(abbinaCalendario([], 'Aurora', OGGI), null);
    is(abbinaCalendario(null, 'Aurora', OGGI), null);
    is(abbinaCalendario([p('Aurora', '2026-09-20')], '', OGGI), null);
    is(abbinaCalendario([p('Aurora', '2026-09-20')], 'Aurora', null), null);
  });
});

import { describe, test, is, eq } from './run.mjs';
import { entraAlPostoDi } from '../src/utils/azione.js';

/* CHI ENTRA PRENDE IL POSTO DI CHI ESCE.
 *
 * I cinque gettoni sul campo stanno in posti fissi, e il posto lo decide
 * l'ORDINE dei giocatori in campo. Finché l'ordine era quello della rosa, una
 * sostituzione spostava mezzo campo: con la rosa A B C D E F e i primi cinque
 * in campo, facendo uscire C ed entrare F i giocatori in campo diventano
 * A B D E F — e D, E ed F finiscono tutti e tre in un posto diverso.
 *
 * Durante una partita si tocca a memoria: si guarda il campo una volta e poi
 * si tocca dove si è visto. Se le facce si spostano da sole si assegna
 * l'azione alla persona sbagliata, e non lo si scopre — il tocco va a buon
 * fine comunque.
 */

const rosa = (...nomi) => nomi.map(n => ({ id: n, name: n, onCourt: false }));
const inCampo = (players, quanti) => {
  players.slice(0, quanti).forEach(p => { p.onCourt = true; });
  return players;
};
const posti = (players) => players.filter(p => p.onCourt).map(p => p.id).join(',');

describe('la sostituzione non sposta gli altri', () => {
  test('chi entra sta dove stava chi esce', () => {
    const p = inCampo(rosa('A', 'B', 'C', 'D', 'E', 'F'), 5);
    is(posti(p), 'A,B,C,D,E');

    const dopo = entraAlPostoDi(p, 'C', 'F');
    dopo.find(x => x.id === 'C').onCourt = false;
    dopo.find(x => x.id === 'F').onCourt = true;

    // F occupa il terzo posto, che era di C. Gli altri quattro non si muovono.
    is(posti(dopo), 'A,B,F,D,E');
  });

  /* LA PROVA DEL DIFETTO: senza lo scambio, tre facce su cinque cambiano
   * posto per una sostituzione sola. */
  test('senza lo scambio se ne sarebbero spostate tre', () => {
    const p = inCampo(rosa('A', 'B', 'C', 'D', 'E', 'F'), 5);
    p.find(x => x.id === 'C').onCourt = false;
    p.find(x => x.id === 'F').onCourt = true;
    is(posti(p), 'A,B,D,E,F');   // D, E ed F tutti in un posto nuovo
  });

  test('due cambi di fila restano ordinati', () => {
    let p = inCampo(rosa('A', 'B', 'C', 'D', 'E', 'F', 'G'), 5);
    p = entraAlPostoDi(p, 'A', 'F');
    p.find(x => x.id === 'A').onCourt = false;
    p.find(x => x.id === 'F').onCourt = true;
    is(posti(p), 'F,B,C,D,E');

    p = entraAlPostoDi(p, 'E', 'G');
    p.find(x => x.id === 'E').onCourt = false;
    p.find(x => x.id === 'G').onCourt = true;
    is(posti(p), 'F,B,C,D,G');
  });

  test('e rientrando si torna al posto di prima', () => {
    let p = inCampo(rosa('A', 'B', 'C', 'D', 'E', 'F'), 5);
    p = entraAlPostoDi(p, 'C', 'F');
    p.find(x => x.id === 'C').onCourt = false;
    p.find(x => x.id === 'F').onCourt = true;
    p = entraAlPostoDi(p, 'F', 'C');
    p.find(x => x.id === 'F').onCourt = false;
    p.find(x => x.id === 'C').onCourt = true;
    is(posti(p), 'A,B,C,D,E');
  });

  test('la rosa non si riordina: si scambiano due e basta', () => {
    const p = rosa('A', 'B', 'C', 'D', 'E', 'F');
    const dopo = entraAlPostoDi(p, 'B', 'E');
    eq(dopo.map(x => x.id), ['A', 'E', 'C', 'D', 'B', 'F']);
  });

  test('l elenco in ingresso non viene toccato', () => {
    const p = rosa('A', 'B', 'C');
    entraAlPostoDi(p, 'A', 'C');
    eq(p.map(x => x.id), ['A', 'B', 'C']);
  });

  test('argomenti storti non fanno danni', () => {
    const p = rosa('A', 'B');
    eq(entraAlPostoDi(p, 'A', 'Z').map(x => x.id), ['A', 'B']);
    eq(entraAlPostoDi(p, 'Z', 'B').map(x => x.id), ['A', 'B']);
    eq(entraAlPostoDi(p, 'A', 'A').map(x => x.id), ['A', 'B']);
    is(entraAlPostoDi(null, 'A', 'B'), null);
  });
});

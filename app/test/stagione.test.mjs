import { describe, test, is } from './run.mjs';
import { collegaStagione, stagioneAttiva } from '../src/api/stagione.js';

/* Il guasto che questo modulo esiste per non far ricapitare.
 *
 * Un allenamento inserito tre volte e mai comparso. Non era il salvataggio:
 * la riga arrivava nel database senza stagione, e ogni lettura chiede la
 * stagione. Il dato c'era, e nessuno poteva vederlo.
 *
 * La lezione è che una scrittura non deve poter dimenticare la stagione. Qui
 * si prova che il valore predefinito c'è, che segue i cambi di stagione, e
 * che nel caso peggiore risponde «nessuna» invece di far fallire la scrittura.
 */

describe('la stagione attiva', () => {
  test('senza collegamento non inventa niente', () => {
    collegaStagione(null);
    is(stagioneAttiva(), null);
  });

  test('risponde quello che dice il collegamento', () => {
    collegaStagione(() => '2026-27');
    is(stagioneAttiva(), '2026-27');
  });

  test('segue i cambi: è una domanda, non una fotografia', () => {
    let corrente = '2025-26';
    collegaStagione(() => corrente);
    is(stagioneAttiva(), '2025-26');
    corrente = '2026-27';
    is(stagioneAttiva(), '2026-27');
  });

  test('una societa senza stagioni da «nessuna», non undefined', () => {
    collegaStagione(() => undefined);
    is(stagioneAttiva(), null);
  });

  test('se il collegamento esplode, la scrittura va avanti senza stagione', () => {
    collegaStagione(() => { throw new Error('stato non pronto'); });
    is(stagioneAttiva(), null);
  });
});

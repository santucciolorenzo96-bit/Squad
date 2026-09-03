import { describe, test, is } from './run.mjs';
import { esc, clamp, fmtClock, fmtMin } from '../src/utils/format.js';

describe('esc — escape HTML', () => {
  test('codifica i caratteri di markup', () => {
    is(esc('<script>'), '&lt;script&gt;');
    is(esc('Tizio & Caio'), 'Tizio &amp; Caio');
  });

  // Questo è il test che conta: in 62 punti dell'app il risultato di esc()
  // finisce dentro un attributo HTML. Senza la codifica degli apici, un valore
  // anagrafico modificabile da un genitore poteva uscire dall'attributo e
  // iniettare un gestore di eventi nel browser dello staff.
  test('codifica gli apici, altrimenti si esce dagli attributi', () => {
    is(esc('" onfocus="alert(1)'), '&quot; onfocus=&quot;alert(1)');
    is(esc("' onload='x"), '&#39; onload=&#39;x');
  });

  test('un valore ostile non produce attributi eseguibili', () => {
    const ostile = '" onfocus="alert(document.cookie)" autofocus x="';
    const html = `<input value="${esc(ostile)}">`;
    is(html.includes('onfocus="'), false);
    is(html.includes('autofocus'), true); // resta come testo, non come attributo
    is((html.match(/"/g) || []).length, 2); // solo le due virgolette dell'attributo
  });

  test('null e undefined diventano stringa vuota', () => {
    is(esc(null), '');
    is(esc(undefined), '');
    is(esc(0), '0');
  });
});

describe('format — numeri e tempo', () => {
  test('clamp resta nei limiti', () => {
    is(clamp(5, 1, 10), 5);
    is(clamp(-3, 1, 10), 1);
    is(clamp(99, 1, 10), 10);
  });

  test('fmtClock non va sotto zero', () => {
    is(fmtClock(600), '10:00');
    is(fmtClock(65), '01:05');
    is(fmtClock(-5), '00:00');
  });

  test('fmtMin tronca ai minuti', () => {
    is(fmtMin(125), "2'");
    is(fmtMin(59), "0'");
  });
});

import { describe, test, is, eq } from './run.mjs';
import { riquadroVisibile } from '../src/utils/image.js';

/* IL RIQUADRO CHE CONTIENE IL MARCHIO.
 *
 * Due loghi possono avere lo stesso numero di pixel e sembrare di due
 * dimensioni diverse: uno stretto intorno allo stemma, l'altro con due dita di
 * aria tutt'intorno. Nel riquadro della classifica il secondo si vede piccolo,
 * e la colonna sembra fatta male anche quando ogni immagine è a posto.
 *
 * Questa è la parte con una logica da sbagliare — il disegno su tela non si
 * può provare fuori da un browser, questa sì.
 */

// Una tela finta: `pieni` sono le coordinate dei pixel che si vedono.
function tela(W, H, pieni) {
  const d = new Uint8ClampedArray(W * H * 4);
  pieni.forEach(([x, y, alfa = 255]) => { d[(y * W + x) * 4 + 3] = alfa; });
  return d;
}

describe('il riquadro dei pixel che si vedono', () => {
  test('un marchio in mezzo: il riquadro lo stringe', () => {
    const d = tela(10, 10, [[4, 4], [5, 4], [4, 5], [5, 5]]);
    eq(riquadroVisibile(d, 10, 10), { x: 4, y: 4, w: 2, h: 2 });
  });

  test('un marchio che tocca i bordi: il riquadro è tutta la tela', () => {
    const d = tela(4, 3, [[0, 0], [3, 2]]);
    eq(riquadroVisibile(d, 4, 3), { x: 0, y: 0, w: 4, h: 3 });
  });

  test('un pixel solo: largo uno e alto uno, non zero', () => {
    // Un riquadro di larghezza zero manderebbe `drawImage` a disegnare il
    // nulla, e il logo sparirebbe invece di essere piccolo.
    eq(riquadroVisibile(tela(5, 5, [[2, 3]]), 5, 5), { x: 2, y: 3, w: 1, h: 1 });
  });

  test('un logo largo: il riquadro è largo e basso', () => {
    const d = tela(20, 20, [[1, 9], [18, 9], [1, 10], [18, 10]]);
    eq(riquadroVisibile(d, 20, 20), { x: 1, y: 9, w: 18, h: 2 });
  });
});

describe('i casi in cui non c’è niente da ritagliare', () => {
  test('tutto trasparente: null, non un riquadro impossibile', () => {
    is(riquadroVisibile(tela(6, 6, []), 6, 6), null);
  });

  test('i pixel appena accennati non contano come marchio', () => {
    // L'alone residuo di un contorno antialiasato ha alfa bassissima: se
    // contasse, il riquadro sarebbe sempre tutta la tela e il ritaglio non
    // servirebbe a niente.
    is(riquadroVisibile(tela(6, 6, [[0, 0, 5], [5, 5, 3]]), 6, 6), null);
    eq(riquadroVisibile(tela(6, 6, [[0, 0, 5], [3, 3, 200]]), 6, 6), { x: 3, y: 3, w: 1, h: 1 });
  });

  test('senza dati, o con misure a zero, non si lancia', () => {
    is(riquadroVisibile(null, 10, 10), null);
    is(riquadroVisibile(tela(2, 2, [[0, 0]]), 0, 2), null);
    is(riquadroVisibile(tela(2, 2, [[0, 0]]), 2, 0), null);
  });
});

import { describe, test, is, ok } from './run.mjs';
import { doveSiGioca, etichettaDove, tonoDove, siGiocaInCasa, CASA, TRASFERTA, IGNOTO } from '../src/utils/dove.js';

/* CASA O TRASFERTA.
 *
 * C'erano quattro definizioni in quattro schermate — «In casa / In trasferta»,
 * «casa / fuori», «casa / fuori», «in casa / ospite» — e non dicevano la stessa
 * cosa. Il guaio vero non era il vocabolario: era che sulla scheda della Home
 * l'etichetta stava attaccata a una SQUADRA e non alla PARTITA, quindi per una
 * trasferta si leggeva «[Avversario] in casa» e a colpo d'occhio diceva il
 * contrario del vero.
 *
 * Qui il soggetto è uno solo: la partita, dal nostro punto di vista.
 */

describe('dove si gioca', () => {
  test('in casa', () => is(doveSiGioca({ home: true }), CASA));
  test('in trasferta', () => is(doveSiGioca({ home: false }), TRASFERTA));

  /* IL TERZO STATO, che prima non esisteva.
   *
   * `home` è una colonna che può essere nulla: le partite caricate dal PDF del
   * calendario, quando il campo non si riconosce, arrivano senza. Il codice di
   * prima faceva `home === false ? 'fuori' : 'casa'`, quindi un dato MANCANTE
   * usciva come «casa» — una supposizione presentata come un fatto, e chi
   * parte per la trasferta non ha modo di accorgersene. */
  test('quando non si sa, non si tira a indovinare', () => {
    is(doveSiGioca({ home: null }), IGNOTO);
    is(doveSiGioca({}), IGNOTO);
    is(doveSiGioca({ home: undefined }), IGNOTO);
    is(doveSiGioca(null), IGNOTO);
  });

  test('e un dato mancante non diventa mai «casa»', () => {
    // È la riga che descrive il difetto: `home === false ? ... : 'casa'`.
    [null, undefined, {}].forEach(p => {
      const partita = p === null || p === undefined ? p : {};
      is(siGiocaInCasa(partita), false, 'un dato mancante risulta in casa');
    });
  });

  test('solo un true esplicito vuol dire casa', () => {
    is(siGiocaInCasa({ home: true }), true);
    is(siGiocaInCasa({ home: false }), false);
    // Niente valori «quasi veri»: una stringa non è una decisione.
    is(siGiocaInCasa({ home: 'casa' }), false);
    is(siGiocaInCasa({ home: 1 }), false);
  });
});

describe('le parole, che sono le stesse dappertutto', () => {
  test('la forma breve, per le pastiglie', () => {
    is(etichettaDove({ home: true }), 'Casa');
    is(etichettaDove({ home: false }), 'Trasferta');
    is(etichettaDove({}), 'Da definire');
  });

  test('la forma lunga, per i titoli', () => {
    is(etichettaDove({ home: true }, { lungo: true }), 'In casa');
    is(etichettaDove({ home: false }, { lungo: true }), 'In trasferta');
  });

  /* «fuori» e «ospite» erano le due parole che facevano leggere il contrario:
   * «ospite» descriveva una squadra, non la partita. Non devono più uscire da
   * nessuna parte. */
  test('le parole che facevano leggere il contrario non ci sono piu', () => {
    [{ home: true }, { home: false }, {}].forEach(p => {
      [etichettaDove(p), etichettaDove(p, { lungo: true })].forEach(t => {
        is(/ospite|fuori/i.test(t), false, 'esce ancora «' + t + '»');
      });
    });
  });

  test('i tre stati si distinguono anche senza leggere, e sono tre', () => {
    const toni = [{ home: true }, { home: false }, {}].map(tonoDove);
    is(new Set(toni).size, 3);
  });

  test('ogni stato ha una parola, e nessuna e vuota', () => {
    [{ home: true }, { home: false }, {}, null].forEach(p => {
      ok(etichettaDove(p).length > 2);
      ok(etichettaDove(p, { lungo: true }).length > 2);
    });
  });
});

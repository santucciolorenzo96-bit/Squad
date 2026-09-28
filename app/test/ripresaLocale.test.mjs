import { describe, test, is } from './run.mjs';
import { tabellinoInAltraMano } from '../src/utils/regole.js';

/* LA RIPRESA DALLA COPIA LOCALE.
 *
 * `revisione`, `tenutoDa` e `tenutoAlle` non sono dati della partita: sono lo
 * stato della RIGA sul server — da quale versione parti, e chi l'ha toccata
 * per ultimo. La copia salvata sul dispositivo li porta com'erano quando è
 * stata scritta, cioè vecchi per definizione: la copia si scrive PRIMA del
 * salvataggio, e si marca sincronizzata solo dopo.
 *
 * Prendendoli dalla copia, il primo salvataggio dichiarava una revisione
 * superata e il database rispondeva «un altro è arrivato prima» — a un utente
 * solo, su un dispositivo solo, all'infinito.
 *
 * Qui si prova la regola di ricomposizione, che nell'app sta in Partita.jsx.
 * È tre righe di oggetto: sembra troppo poco per un test, ed è esattamente il
 * genere di cosa che si riscrive «semplificando» fra sei mesi.
 */

// La stessa ricomposizione di carica() in Partita.jsx.
function riprendi(dalServer, copiaLocale) {
  return {
    ...copiaLocale.gioco,
    revisione: dalServer.revisione,
    tenutoDa: dalServer.tenutoDa,
    tenutoAlle: dalServer.tenutoAlle,
    daRisincronizzare: true
  };
}

const SERVER = {
  id: 'g1', revisione: 42, tenutoDa: 'io', tenutoAlle: '2026-09-28T10:00:00.000Z',
  teamScore: 1, oppScore: 0, players: [{ id: 'a', stats: { points: 12 } }]
};

const COPIA = {
  gameId: 'g1', sincronizzata: false,
  gioco: {
    id: 'g1', revisione: 37, tenutoDa: 'io', tenutoAlle: '2026-09-28T09:58:00.000Z',
    teamScore: 1, oppScore: 0, players: [{ id: 'a', stats: { points: 14 } }]
  }
};

describe('riprendere dalla copia salvata sul dispositivo', () => {
  const ripreso = riprendi(SERVER, COPIA);

  test('il contenuto e quello della copia: e il piu recente', () => {
    is(ripreso.players[0].stats.points, 14);
  });

  test('ma la revisione e quella del server: e da li che si riparte', () => {
    is(ripreso.revisione, 42);
  });

  test('e chi teneva il tabellino lo dice il server, non la copia', () => {
    is(ripreso.tenutoAlle, '2026-09-28T10:00:00.000Z');
  });

  test('e resta marcata da rispedire', () => {
    is(ripreso.daRisincronizzare, true);
  });
});

describe('perche la mano giusta conta', () => {
  const ADESSO = new Date('2026-09-28T10:00:30.000Z').getTime();

  /* Se `tenutoDa` venisse dalla copia, la partita sembrerebbe sempre in mano a
   * chi l'ha scritta — cioè a noi — e il controllo «la sta segnando qualcun
   * altro» non scatterebbe mai. Prendendolo dal server, scatta quando deve. */
  test('un altro che ha salvato trenta secondi fa tiene il tabellino', () => {
    const dalServer = { ...SERVER, tenutoDa: 'altro' };
    const ripreso = riprendi(dalServer, COPIA);
    is(tabellinoInAltraMano(ripreso, 'io', ADESSO), true);
  });

  test('ma se quell altro ha mollato da un pezzo, no', () => {
    const dalServer = {
      ...SERVER, tenutoDa: 'altro', tenutoAlle: '2026-09-28T09:40:00.000Z'
    };
    const ripreso = riprendi(dalServer, COPIA);
    is(tabellinoInAltraMano(ripreso, 'io', ADESSO), false);
  });

  test('e la propria mano non e mai un altra mano', () => {
    is(tabellinoInAltraMano(riprendi(SERVER, COPIA), 'io', ADESSO), false);
  });
});

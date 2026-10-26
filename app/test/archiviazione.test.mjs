import { describe, test, is, ok } from './run.mjs';
import {
  motivoArchivioMancato, SPIEGAZIONE_ARCHIVIO, MOTIVI_ARCHIVIO
} from '../src/utils/salvataggio.js';

/* QUANDO ARCHIVIARE NON ARCHIVIA.
 *
 * Il 21 e il 26 ottobre 2026 due partite sono finite così: in calendario il
 * risultato c'è, in `games` non c'è nessuna riga, sul tablet nessuna copia.
 * `endGame` faceva un update e si fidava dell'assenza di errori — ma un update
 * che non trova la riga tocca zero righe e non è un errore.
 *
 * Quello che veniva dopo era irreparabile: il risultato in calendario, la
 * copia locale cancellata, la partita via dalla memoria, e il messaggio
 * «Partita archiviata».
 *
 * Questi test provano la regola che adesso ferma quella catena.
 */

describe('perché una partita non si è archiviata', () => {
  test('nessuna riga con quell’id: la partita non esiste sul server', () => {
    is(motivoArchivioMancato(null).motivo, 'assente');
    is(motivoArchivioMancato(undefined).motivo, 'assente');
  });

  test('la riga c’è ma l’update non l’ha toccata: l’ha filtrata una policy', () => {
    is(motivoArchivioMancato({ id: 'g1' }).motivo, 'rifiutata');
  });

  test('se non si riesce nemmeno a rileggere, era la rete', () => {
    // E va per primo: senza rete non si sa niente del permesso, e dare la
    // colpa al permesso manderebbe a cercare un amministratore invece del
    // segnale.
    is(motivoArchivioMancato(null, { rete: true }).motivo, 'rete');
    is(motivoArchivioMancato({ id: 'g1' }, { rete: true }).motivo, 'rete');
  });

  test('i tre motivi sono quelli dichiarati, e hanno tutti una spiegazione', () => {
    MOTIVI_ARCHIVIO.forEach(m => ok(SPIEGAZIONE_ARCHIVIO[m], 'manca la spiegazione di ' + m));
    is(Object.keys(SPIEGAZIONE_ARCHIVIO).length, MOTIVI_ARCHIVIO.length);
  });
});

describe('cosa dicono i messaggi a chi sta segnando', () => {
  /* La cosa più importante non è il motivo: è che il tabellino non è perso.
   * Chi legge «non è stato possibile archiviare» e non legge altro chiude
   * l'app — e chiudere l'app, finché la copia non è sincronizzata, è il solo
   * gesto che perde davvero il lavoro. */
  test('ogni messaggio dice che la partita NON è archiviata', () => {
    MOTIVI_ARCHIVIO.forEach(m => {
      ok(/NON è archiviata/.test(SPIEGAZIONE_ARCHIVIO[m]),
        'il messaggio di ' + m + ' non dice che la partita non è archiviata');
    });
  });

  test('e che il tabellino è ancora sul dispositivo', () => {
    MOTIVI_ARCHIVIO.forEach(m => {
      ok(/ancora tutto qui/.test(SPIEGAZIONE_ARCHIVIO[m]),
        'il messaggio di ' + m + ' non dice dove sono i dati');
    });
  });

  test('e dice di non ricaricare la pagina', () => {
    MOTIVI_ARCHIVIO.forEach(m => {
      ok(/non ricaricare/.test(SPIEGAZIONE_ARCHIVIO[m]),
        'il messaggio di ' + m + ' non dice di non ricaricare');
    });
  });

  test('ognuno dice anche cosa fare, e sono tre cose diverse', () => {
    ok(/riprendere da questa copia/.test(SPIEGAZIONE_ARCHIVIO.assente));
    ok(/amministratore/.test(SPIEGAZIONE_ARCHIVIO.rifiutata));
    ok(/segnale torna/.test(SPIEGAZIONE_ARCHIVIO.rete));
  });
});

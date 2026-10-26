import { describe, test, is, ok } from './run.mjs';
import { esigiRiga } from '../src/api/scrittura.js';

/* UNA SCRITTURA CHE DEVE AVER TOCCATO UNA RIGA.
 *
 * Con la sicurezza a livello di riga, un update o un delete che non trova
 * niente da scrivere non è un errore: è una scrittura di zero righe, che
 * torna indietro con `error: null`. L'app ci costruiva sopra — «eliminato»,
 * riga via dall'elenco, finestra chiusa — e raccontava come fatto qualcosa
 * che non era stato fatto.
 *
 * È già costato due volte: un tabellino «scartato» che restava dov'era, e
 * `endGame` che non si accorgeva di non aver archiviato.
 */

describe('la scrittura ha toccato una riga', () => {
  test('una riga restituita: passa, e restituisce quello che ha ricevuto', () => {
    const righe = [{ id: 'a' }];
    is(esigiRiga(righe, 'eliminare la categoria'), righe);
  });

  test('più righe: passa', () => {
    is(esigiRiga([{ id: 'a' }, { id: 'b' }], 'togliere l’atleta').length, 2);
  });
});

describe('zero righe non è un successo', () => {
  function errore(data) {
    try { esigiRiga(data, 'eliminare la categoria'); return null; }
    catch (e) { return e.message; }
  }

  test('elenco vuoto: lancia', () => {
    ok(errore([]), 'un elenco vuoto deve lanciare');
  });

  test('null e undefined: lanciano', () => {
    // Sono i valori che arrivano quando la richiesta non ha chiesto le righe
    // indietro, o quando il client non le ha ricevute: trattarli come un
    // successo è il difetto da cui nasce questo file.
    ok(errore(null), 'null deve lanciare');
    ok(errore(undefined), 'undefined deve lanciare');
  });

  test('il messaggio dice cosa non è stato fatto, con le parole di chi legge', () => {
    ok(/eliminare la categoria/.test(errore([])),
      'il messaggio non dice quale operazione non è andata');
  });

  test('e dice la causa quasi sempre vera: manca il permesso', () => {
    ok(/permesso/.test(errore([])), 'il messaggio non nomina il permesso');
  });

  test('e dice di ricaricare, perché lo schermo adesso è falso', () => {
    /* È la differenza fra un errore e un errore utile: dopo un rifiuto
     * silenzioso l'elenco a schermo ha già perso la riga, e chi non ricarica
     * se ne accorge la prossima volta che apre quella schermata. */
    ok(/[Rr]icarica/.test(errore([])), 'il messaggio non dice di ricaricare');
  });
});

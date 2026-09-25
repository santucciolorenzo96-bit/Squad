import { describe, test, is } from './run.mjs';
import { canFixGame, ORE_PER_CORREGGERE } from '../src/utils/permissions.js';

/* Correggere un tabellino chiuso.
 *
 * La stessa regola sta in riapri_tabellino() (migrazione 044). Se le due si
 * scollano esce un pulsante che il database rifiuta — o, peggio, non esce il
 * pulsante che invece servirebbe. */

const ORA = new Date('2026-09-26T21:00:00Z').getTime();
const H = 3600 * 1000;
const SETTORI = { u1: ['dr2'] };

const ALLENATORE = { id: 'u1', role: 'allenatore' };
const SEGNAPUNTI = { id: 'u2', role: 'segnapunti', can_score_matches: true };
const AMMINISTRATORE = { id: 'u3', role: 'admin' };
const GENITORE = { id: 'u4', role: 'genitore' };

const finita = (oreFa) => new Date(ORA - oreFa * H).toISOString();

describe('chi puo correggere un tabellino chiuso', () => {
  test('l allenatore della categoria, la sera stessa', () => {
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, finita(3), ORA), true);
  });

  test('e anche il giorno dopo', () => {
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, finita(30), ORA), true);
  });

  test('ma non una settimana dopo: quel numero e gia in classifica', () => {
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, finita(24 * 7), ORA), false);
  });

  test('il limite e 48 ore esatte', () => {
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, finita(ORE_PER_CORREGGERE - 0.1), ORA), true);
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, finita(ORE_PER_CORREGGERE + 0.1), ORA), false);
  });

  test('l amministratore anche dopo: quella non e una correzione, e una decisione', () => {
    is(canFixGame(AMMINISTRATORE, 'dr2', {}, finita(24 * 90), ORA), true);
  });

  test('il segnapunti abilitato si', () => {
    is(canFixGame(SEGNAPUNTI, 'dr2', {}, finita(2), ORA), true);
  });

  test('ma non se sono passate le 48 ore', () => {
    is(canFixGame(SEGNAPUNTI, 'dr2', {}, finita(50), ORA), false);
  });

  test('un allenatore di un altra categoria no', () => {
    is(canFixGame(ALLENATORE, 'u15', SETTORI, finita(2), ORA), false);
  });

  test('una famiglia senza incarichi no', () => {
    is(canFixGame(GENITORE, 'dr2', {}, finita(2), ORA), false);
  });

  /* Un genitore A CUI UN AMMINISTRATORE HA ASSEGNATO LA CATEGORIA invece sì, ed
   * è voluto: in tutta l'app l'assegnazione di una categoria vale come accesso
   * di staff a quella categoria — è la stessa `has_sector_access()` che regge
   * il tabellino, la sua cancellazione e le presenze. Il genitore che è anche
   * il dirigente accompagnatore esiste, e in una società piccola è la norma.
   *
   * Sta scritto qui perché è una conseguenza che non si vede guardando il
   * ruolo: chi legge «genitore» si aspetta di no. Se un giorno si decide che
   * l'assegnazione non basta, va cambiata insieme alla policy del database —
   * non solo qui. */
  test('ma un genitore con la categoria assegnata si: vale come staff, ovunque', () => {
    is(canFixGame(GENITORE, 'dr2', { u4: ['dr2'] }, finita(2), ORA), true);
  });

  test('senza data di fine non si corregge niente', () => {
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, null, ORA), false);
    is(canFixGame(ALLENATORE, 'dr2', SETTORI, 'non una data', ORA), false);
  });

  test('ma l amministratore non ha bisogno nemmeno di quella', () => {
    is(canFixGame(AMMINISTRATORE, 'dr2', {}, null, ORA), true);
  });

  test('senza utente, no', () => {
    is(canFixGame(null, 'dr2', SETTORI, finita(1), ORA), false);
  });
});

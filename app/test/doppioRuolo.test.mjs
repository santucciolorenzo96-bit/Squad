import { describe, test, is } from './run.mjs';
import {
  haUnaScheda, eIlSuoAtleta, isLinkedUser, canManagePlayer, managesSector
} from '../src/utils/permissions.js';
import { sectorIdsFor } from '../src/utils/sectors.js';

/* CHI SEI, E COSA GESTISCI.
 *
 * Giorgio è atleta della DR2 e allenatore dell'Open A. Le due cose stanno in
 * due posti del database e non si pestano i piedi — il ruolo con le categorie
 * assegnate, e il collegamento alla scheda — ma il programma chiedeva «chi
 * sei?» al ruolo, e per un allenatore la risposta era «nessuno».
 */

const DR2 = 's-dr2';
const OPENA = 's-opena';

const giorgio = { id: 'u1', role: 'allenatore' };
const sueSchede = [{ id: 'p-giorgio' }];
const assegnazioni = { u1: [OPENA] };
const settori = [{ id: DR2 }, { id: OPENA }];

describe('un allenatore che è anche atleta', () => {
  test('ha una scheda, anche se il ruolo dice «allenatore»', () => {
    is(haUnaScheda(sueSchede), true);
    is(eIlSuoAtleta(sueSchede, 'p-giorgio'), true);
  });

  test('ma non è la scheda di un altro', () => {
    is(eIlSuoAtleta(sueSchede, 'p-altro'), false);
    is(eIlSuoAtleta(sueSchede, null), false);
  });

  test('e `isLinkedUser` continua a dire di no, ed è giusto', () => {
    /* Quella domanda decide QUALE INTERFACCIA si riceve: un allenatore vede
     * la vista dello staff anche se è anche atleta. */
    is(isLinkedUser(giorgio), false);
  });

  test('gestisce la categoria che gli è assegnata', () => {
    is(managesSector(giorgio, OPENA, assegnazioni), true);
    is(canManagePlayer(giorgio, OPENA, assegnazioni), true);
  });

  test('e NON quella in cui gioca', () => {
    // È il punto: essere atleta della DR2 non dà nessun potere sulla DR2.
    is(managesSector(giorgio, DR2, assegnazioni), false);
    is(canManagePlayer(giorgio, DR2, assegnazioni), false);
  });

  test('le sue categorie sono DUE: si sommano, non si escludono', () => {
    const suoi = sectorIdsFor(giorgio, {
      staffSectors: assegnazioni,
      familySectorIds: [DR2],
      sectors: settori
    });
    is(suoi.length, 2);
    is(suoi.includes(DR2), true);
    is(suoi.includes(OPENA), true);
  });
});

describe('chi non ha nessuna scheda', () => {
  test('un allenatore che non gioca', () => {
    is(haUnaScheda([]), false);
    is(haUnaScheda(null), false);
    is(eIlSuoAtleta([], 'p-giorgio'), false);
  });

  test('e un genitore ha le schede dei figli, non la propria', () => {
    const genitore = { id: 'u2', role: 'genitore' };
    is(isLinkedUser(genitore), true);
    is(haUnaScheda([{ id: 'p-figlio' }]), true);
    is(managesSector(genitore, DR2, {}), false);
  });
});

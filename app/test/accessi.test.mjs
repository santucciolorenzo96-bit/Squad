import { describe, test, is, ok } from './run.mjs';
import { sectorIdsFor } from '../src/utils/sectors.js';
import { managesSector } from '../src/utils/permissions.js';

const SETTORI = [
  { id: 'open-a', name: 'Open A' },
  { id: 'prima', name: 'Prima squadra' },
  { id: 'u15', name: 'Under 15' }
];

// Il caso vero: una persona sola che nella società fa due cose. Allena l'Open A
// — categoria assegnata da un amministratore — e gioca in Prima squadra, dove
// c'è la sua scheda atleta collegata all'account.
const MISTO = { id: 'u1', role: 'allenatore' };
const contesto = {
  sectors: SETTORI,
  staffSectors: { u1: ['open-a'] },
  familySectorIds: ['prima']
};

describe('quali categorie si vedono', () => {
  test('chi allena e gioca le vede tutte e due', () => {
    const ids = sectorIdsFor(MISTO, contesto);
    is(ids.length, 2);
    ok(ids.includes('open-a'));
    ok(ids.includes('prima'));
  });

  test('e non vede quelle che non lo riguardano', () => {
    is(sectorIdsFor(MISTO, contesto).includes('u15'), false);
  });

  test('un allenatore senza collegamenti vede solo le sue', () => {
    const ids = sectorIdsFor({ id: 'u2', role: 'allenatore' },
      { ...contesto, staffSectors: { u2: ['open-a'] }, familySectorIds: [] });
    is(ids.length, 1);
    is(ids[0], 'open-a');
  });

  test('un genitore vede solo quelle dei figli', () => {
    const ids = sectorIdsFor({ id: 'u3', role: 'genitore' },
      { ...contesto, staffSectors: {}, familySectorIds: ['u15'] });
    is(ids.length, 1);
    is(ids[0], 'u15');
  });

  test('un admin le vede tutte', () => {
    is(sectorIdsFor({ id: 'u4', role: 'admin' }, contesto).length, 3);
  });

  test('la stessa categoria da due strade non si conta due volte', () => {
    const ids = sectorIdsFor(MISTO, { ...contesto, familySectorIds: ['open-a', 'prima'] });
    is(ids.length, 2);
  });

  test('chi non ha né assegnazioni né collegamenti non vede niente', () => {
    is(sectorIdsFor({ id: 'u5', role: 'staff' }, { ...contesto, staffSectors: {}, familySectorIds: [] }).length, 0);
  });
});

// Vedere non è gestire: nella categoria in cui gioca, l'allenatore guarda. Il
// database lo impone comunque — can_manage_sector() legge le assegnazioni, non
// il ruolo — ma l'app non deve mostrargli pulsanti che poi falliscono.
describe('quali categorie si gestiscono', () => {
  test('gestisce quella che gli è stata assegnata', () => {
    ok(managesSector(MISTO, 'open-a', contesto.staffSectors));
  });

  test('NON gestisce quella in cui gioca', () => {
    is(managesSector(MISTO, 'prima', contesto.staffSectors), false);
  });

  test('un admin gestisce qualunque categoria', () => {
    ok(managesSector({ id: 'u4', role: 'admin' }, 'prima', {}));
  });

  test('senza categoria aperta non si gestisce niente', () => {
    is(managesSector(MISTO, null, contesto.staffSectors), false);
  });

  test('un genitore non gestisce la categoria del figlio', () => {
    is(managesSector({ id: 'u3', role: 'genitore' }, 'u15', {}), false);
  });
});

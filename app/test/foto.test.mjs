import { describe, test, is } from './run.mjs';
import { canManagePlayer } from '../src/utils/permissions.js';

/* La fotografia dell'atleta.
 *
 * Il guasto non era il caricamento: era il pulsante. Lo mostravamo a tutti, e
 * al genitore che lo premeva il database rispondeva «new row violates
 * row-level security policy» — una frase che non dice niente a chi sta
 * caricando la foto di suo figlio.
 *
 * Questa deve dire la stessa cosa di can_manage_player() nel database:
 * is_team_manager() e accesso alla categoria. Se qualcuno cambia una delle
 * due senza l'altra, l'errore torna. */

const SETTORI = { u1: ['open-a'] };

describe('chi puo cambiare la fotografia di un atleta', () => {
  test('l allenatore della categoria si', () => {
    is(canManagePlayer({ id: 'u1', role: 'allenatore' }, 'open-a', SETTORI), true);
  });

  test('ma non di una categoria che non segue', () => {
    is(canManagePlayer({ id: 'u1', role: 'allenatore' }, 'u15', SETTORI), false);
  });

  test('lo staff dirigenziale della categoria si', () => {
    is(canManagePlayer({ id: 'u1', role: 'staff' }, 'open-a', SETTORI), true);
  });

  test('l amministratore ovunque', () => {
    is(canManagePlayer({ id: 'u9', role: 'admin' }, 'u15', {}), true);
    is(canManagePlayer({ id: 'u9', role: 'presidente' }, 'u15', {}), true);
  });

  test('il genitore no: era lui a prendersi l errore in faccia', () => {
    is(canManagePlayer({ id: 'u2', role: 'genitore' }, 'open-a', { u2: ['open-a'] }), false);
  });

  test('e nemmeno l atleta', () => {
    is(canManagePlayer({ id: 'u3', role: 'atleta' }, 'open-a', { u3: ['open-a'] }), false);
  });

  test('il segnapunti no: il suo compito e il solo tabellino', () => {
    is(canManagePlayer({ id: 'u4', role: 'segnapunti' }, 'open-a', { u4: ['open-a'] }), false);
  });

  test('senza categoria attiva non si mostra niente', () => {
    is(canManagePlayer({ id: 'u1', role: 'allenatore' }, null, SETTORI), false);
  });
});

import { describe, test, is } from './run.mjs';
import { canDeleteGame } from '../src/utils/permissions.js';

/* Chi può cancellare una partita.
 *
 * Questa regola vive in due posti: qui e nella policy `games_delete` della
 * migrazione 035. Devono dire la stessa cosa, altrimenti l'app mostra un
 * pulsante che il database rifiuta — o nasconde quello che invece servirebbe.
 *
 * Quindi i casi qui sotto sono scritti guardando la policy, riga per riga.
 */

const SETTORE = 's1';
const ASSEGNAZIONI = { 'all-1': ['s1'], 'all-2': ['s2'], 'staff-1': ['s1'] };

const admin = { id: 'a', role: 'admin' };
const presidente = { id: 'p', role: 'presidente' };
const allenatoreSuo = { id: 'all-1', role: 'allenatore' };
const allenatoreAltrui = { id: 'all-2', role: 'allenatore' };
const staffSuo = { id: 'staff-1', role: 'staff' };
const segnapunti = { id: 'sp', role: 'segnapunti', can_score_matches: true };
const genitore = { id: 'g', role: 'genitore' };
const genitoreSegna = { id: 'g2', role: 'genitore', can_score_matches: true };

const chiusa = {};
const aperta = { aperta: true };

describe('cancellare una partita chiusa: solo gli amministratori', () => {
  test('admin e presidente sì', () => {
    is(canDeleteGame(admin, SETTORE, ASSEGNAZIONI, chiusa), true);
    is(canDeleteGame(presidente, SETTORE, ASSEGNAZIONI, chiusa), true);
  });

  test('l’allenatore della categoria no: la storia non si rifà a memoria', () => {
    is(canDeleteGame(allenatoreSuo, SETTORE, ASSEGNAZIONI, chiusa), false);
  });

  test('lo staff no', () => {
    is(canDeleteGame(staffSuo, SETTORE, ASSEGNAZIONI, chiusa), false);
  });

  test('chi tiene lo scout no: segnare non è cancellare', () => {
    is(canDeleteGame(segnapunti, SETTORE, ASSEGNAZIONI, chiusa), false);
    is(canDeleteGame(genitoreSegna, SETTORE, ASSEGNAZIONI, chiusa), false);
  });
});

describe('scartare un tabellino aperto: chi lo sta tenendo', () => {
  test('l’allenatore della categoria sì', () => {
    is(canDeleteGame(allenatoreSuo, SETTORE, ASSEGNAZIONI, aperta), true);
  });

  test('un allenatore di un’altra categoria no', () => {
    is(canDeleteGame(allenatoreAltrui, SETTORE, ASSEGNAZIONI, aperta), false);
  });

  test('un genitore abilitato a segnare sì, uno qualunque no', () => {
    is(canDeleteGame(genitoreSegna, SETTORE, ASSEGNAZIONI, aperta), true);
    is(canDeleteGame(genitore, SETTORE, ASSEGNAZIONI, aperta), false);
  });

  test('l’amministratore sì, anche senza avere quella categoria', () => {
    is(canDeleteGame(admin, 's9', ASSEGNAZIONI, aperta), true);
  });
});

describe('cancellare una partita: i casi limite', () => {
  test('senza utente non si cancella niente', () => {
    is(canDeleteGame(null, SETTORE, ASSEGNAZIONI, chiusa), false);
    is(canDeleteGame(undefined, SETTORE, ASSEGNAZIONI, aperta), false);
  });

  test('senza dire se è aperta vale la regola severa', () => {
    // Il valore predefinito deve essere quello che protegge: chi dimentica di
    // passarlo ottiene la regola della partita chiusa, non il contrario.
    is(canDeleteGame(allenatoreSuo, SETTORE, ASSEGNAZIONI), false);
    is(canDeleteGame(admin, SETTORE, ASSEGNAZIONI), true);
  });
});

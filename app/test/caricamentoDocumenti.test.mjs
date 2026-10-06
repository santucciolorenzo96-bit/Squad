import { describe, test, is } from './run.mjs';
import { canUploadDocuments } from '../src/utils/permissions.js';

/* CHI PUÒ CARICARE UN DOCUMENTO.
 *
 * Questa regola deve dire la stessa cosa delle due policy che la decidono
 * davvero — quella sulla tabella `player_documents` e quella sul bucket:
 *
 *     has_sector_access_to_player(...)
 *     or (has_family_access_to_player(...) and family_can_upload_documents())
 *
 * Quando le due si scollano non esce un pulsante disabilitato: esce un rifiuto
 * del database in faccia a chi ha premuto, con il messaggio del database.
 *
 * Qui era successo nel modo peggiore. `can_upload_documents` nasce SPENTO —
 * `not null default false` — e l'interruttore per accenderlo era rimasto nella
 * vecchia interfaccia, che non si disegna più. Quindi: il permesso non si
 * poteva concedere da nessuna parte, il pulsante «Carica» compariva lo stesso
 * a tutte le famiglie, e la funzione era spenta per tutte le società senza che
 * nessuno l'avesse deciso.
 */

const staff = (ruolo, extra) => Object.assign({ role: ruolo, team_id: 't' }, extra || {});
const SETTORI = { u2: ['s1'] };

describe('caricare un documento: lo staff', () => {
  test('un amministratore puo, in qualunque categoria', () => {
    is(canUploadDocuments(staff('admin'), 's1', SETTORI), true);
    is(canUploadDocuments(staff('admin'), 's9', SETTORI), true);
  });

  test('un allenatore puo nelle sue categorie', () => {
    const a = staff('allenatore', { id: 'u2' });
    is(canUploadDocuments(a, 's1', SETTORI), true);
  });

  test('e non in quelle che non sono sue', () => {
    const a = staff('allenatore', { id: 'u2' });
    is(canUploadDocuments(a, 's7', SETTORI), false);
  });

  /* Allo staff il permesso `can_upload_documents` non serve: la policy gli
   * passa dall'altro ramo, quello dell'accesso al settore. Metterlo come
   * condizione anche per loro spegnerebbe il caricamento a tutta la societa'. */
  test('allo staff non serve il permesso delle famiglie', () => {
    is(canUploadDocuments(staff('admin', { can_upload_documents: false }), 's1', SETTORI), true);
  });
});

describe('caricare un documento: le famiglie', () => {
  test('senza permesso non puo', () => {
    ['genitore', 'atleta'].forEach(r => {
      is(canUploadDocuments(staff(r), 's1', SETTORI), false, r);
    });
  });

  test('con il permesso puo', () => {
    ['genitore', 'atleta'].forEach(r => {
      is(canUploadDocuments(staff(r, { can_upload_documents: true }), 's1', SETTORI), true, r);
    });
  });

  /* IL CASO CHE HA ROTTO TUTTO.
   *
   * Un profilo appena creato non ha quel campo, oppure ce l'ha a `false` per
   * via del `default false`. In tutti e due i casi la risposta è no — e il
   * pulsante non deve comparire. */
  test('un profilo appena creato non puo, e non e un forse', () => {
    is(canUploadDocuments({ role: 'genitore' }, 's1', SETTORI), false);
    is(canUploadDocuments({ role: 'genitore', can_upload_documents: null }, 's1', SETTORI), false);
    is(canUploadDocuments({ role: 'genitore', can_upload_documents: undefined }, 's1', SETTORI), false);
  });

  test('e il permesso da solo non basta a chi non e collegato a niente', () => {
    // Il permesso vale sul PROPRIO atleta: a dirlo è `has_family_access_to_player`,
    // che qui non si può valutare — ma la policy la applica comunque il
    // database. Questa regola non deve mai essere più permissiva di quella.
    is(canUploadDocuments(null, 's1', SETTORI), false);
  });
});

describe('la regola non e mai piu permissiva della policy', () => {
  test('senza utente, no', () => is(canUploadDocuments(undefined, 's1', SETTORI), false));

  test('un ruolo sconosciuto non passa di straforo', () => {
    is(canUploadDocuments(staff('qualcosa'), 's1', SETTORI), false);
    is(canUploadDocuments(staff('qualcosa', { can_upload_documents: true }), 's1', SETTORI), false);
  });
});

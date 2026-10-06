import { describe, test, is } from './run.mjs';
import { canUploadDocuments, canReviewDocuments } from '../src/utils/permissions.js';

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
  /* IL PERMESSO IN PIÙ, CHE È STATO TOLTO.
   *
   * Una famiglia poteva caricare solo se la società le aveva acceso
   * `can_upload_documents`, che nasceva spento — e l'interruttore per
   * accenderlo era rimasto nella vecchia interfaccia, quindi non si poteva
   * accendere da nessuna parte. La funzione era spenta per tutte le società
   * senza che nessuno l'avesse deciso.
   *
   * Non è stato rimesso, è stato tolto: un documento che arriva da una
   * famiglia resta «in verifica» e non copre finché qualcuno non lo approva.
   * Metteva un cancello davanti a un flusso che ha già il cancello dietro, e
   * in cambio chiedeva un interruttore per ogni famiglia della società.
   */
  test('genitori e atleti caricano, e non serve nessun permesso', () => {
    ['genitore', 'atleta'].forEach(r => {
      is(canUploadDocuments(staff(r), 's1', SETTORI), true, r);
    });
  });

  test('nemmeno su un profilo appena creato, che quel campo non ce l ha', () => {
    is(canUploadDocuments({ role: 'genitore' }, 's1', SETTORI), true);
    is(canUploadDocuments({ role: 'atleta', can_upload_documents: false }, 's1', SETTORI), true);
  });

  /* Quello che il permesso NON decideva, e che resta dov'era: si carica solo
   * per il PROPRIO atleta. A dirlo è `has_family_access_to_player`, dentro le
   * policy — qui non si può valutare, e questa regola non deve far finta di
   * saperlo. */
  test('ma non per un atleta qualunque: quello lo decide il database', () => {
    is(canUploadDocuments(null, 's1', SETTORI), false);
  });

  /* E APPROVARE RESTA A CHI GESTISCE. È l'altra metà della decisione: si
   * apre il caricamento proprio perché la verifica non si apre. */
  test('caricare non e approvare', () => {
    ['genitore', 'atleta'].forEach(r => {
      is(canReviewDocuments(staff(r)), false, r + ' non deve poter approvare');
    });
    ['admin', 'presidente', 'allenatore', 'staff'].forEach(r => {
      is(canReviewDocuments(staff(r)), true, r + ' deve poter approvare');
    });
  });
});

describe('la regola non e mai piu permissiva della policy', () => {
  test('senza utente, no', () => is(canUploadDocuments(undefined, 's1', SETTORI), false));

  test('un ruolo sconosciuto non passa di straforo', () => {
    is(canUploadDocuments(staff('qualcosa'), 's1', SETTORI), false);
    is(canUploadDocuments(staff('qualcosa', { can_upload_documents: true }), 's1', SETTORI), false);
  });
});

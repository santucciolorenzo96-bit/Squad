import { describe, test, is } from './run.mjs';
import { docStatus, worstStatus, ageFrom } from '../src/utils/docStatus.js';
import { orderedSectors, sectorFullName } from '../src/utils/sectors.js';

const OGGI = '2026-03-15';
const doc = (o) => Object.assign({ status: 'approved', expires_at: '2027-01-01', uploaded_at: '2026-01-01T10:00:00Z' }, o);

describe('stato di un adempimento', () => {
  test('senza documenti è mancante', () => {
    is(docStatus([], OGGI), 'mancante');
    is(docStatus(null, OGGI), 'mancante');
  });

  test('approvato e lontano dalla scadenza è valido', () => {
    is(docStatus([doc()], OGGI), 'ok');
  });

  test('approvato senza scadenza è valido', () => {
    is(docStatus([doc({ expires_at: null })], OGGI), 'ok');
  });

  test('entro trenta giorni è in scadenza, oltre no', () => {
    is(docStatus([doc({ expires_at: '2026-04-01' })], OGGI), 'scadenza');
    is(docStatus([doc({ expires_at: '2026-09-01' })], OGGI), 'ok');
  });

  test('scaduto ieri è scaduto', () => {
    is(docStatus([doc({ expires_at: '2026-03-14' })], OGGI), 'scaduto');
  });

  // Il caso che una regola ingenua sbaglia: guardare l'ultimo caricato invece
  // di quello che copre più a lungo.
  test('il vecchio scaduto non conta se accanto ce n\'è uno nuovo', () => {
    is(docStatus([
      doc({ expires_at: '2025-06-01', uploaded_at: '2026-02-01T10:00:00Z' }),
      doc({ expires_at: '2027-06-01', uploaded_at: '2025-01-01T10:00:00Z' })
    ], OGGI), 'ok');
  });

  test('in verifica non copre ancora, ma non è respinto', () => {
    is(docStatus([doc({ status: 'in_review' })], OGGI), 'verifica');
  });

  test('respinto vale come da rifare', () => {
    is(docStatus([doc({ status: 'rejected' })], OGGI), 'respinto');
  });

  // Un approvato valido accanto a un respinto: l'atleta è coperto.
  test('un approvato valido batte un respinto', () => {
    is(docStatus([doc({ status: 'rejected' }), doc()], OGGI), 'ok');
  });
});

describe('stato peggiore', () => {
  test('decide il peggiore, non il primo', () => {
    is(worstStatus(['ok', 'scaduto', 'scadenza']), 'scaduto');
    is(worstStatus(['ok', 'ok']), 'ok');
    is(worstStatus(['verifica', 'scadenza']), 'verifica');
  });
  test('un elenco vuoto non inventa problemi', () => {
    is(worstStatus([]), 'ok');
  });
});

describe('età', () => {
  test('conta il compleanno, non la differenza fra gli anni', () => {
    is(ageFrom('2010-03-14', OGGI), 16);   // compiuto ieri
    is(ageFrom('2010-03-16', OGGI), 15);   // lo compie domani
    is(ageFrom('2010-03-15', OGGI), 16);   // oggi
  });
  test('senza data di nascita non si inventa un'.replace("'", '') + ' età', () => {
    is(ageFrom(null, OGGI), null);
    is(ageFrom('non una data', OGGI), null);
  });
});

/* LE CATEGORIE SONO PIATTE.
 *
 * C'è stata una gerarchia — un settore poteva avere un genitore — ed è stata
 * tolta: non la usava nessuna società, e aveva un buco che non si poteva
 * chiudere. Nessuna lettura aggregava i figli, quindi aprire una categoria che
 * ne aveva mostrava una rosa vuota, nessun allenamento e nessuna partita.
 * Da fuori non sembrava una scelta: sembrava un guasto.
 *
 * Questi test tengono l'elenco piatto. Non è un dettaglio di presentazione:
 * l'ordine delle categorie è quello con cui si naviga tutta l'app, ed è la
 * prima cosa che si vede aprendola.
 */
const sec = (id, name, order) => ({ id, name, sort_order: order });

describe('le categorie, in ordine', () => {
  test('comandano l ordine scelto dalla societa', () => {
    const out = orderedSectors([sec('c', 'Prima squadra', 2), sec('a', 'Under 13', 0), sec('b', 'Under 15', 1)]);
    is(out.map(s => s.id).join(','), 'a,b,c');
  });

  test('a parita di posizione decide il nome', () => {
    const out = orderedSectors([sec('z', 'Under 17', 0), sec('a', 'Under 13', 0)]);
    is(out.map(s => s.name).join(','), 'Under 13,Under 17');
  });

  test('nessuna categoria sparisce per strada', () => {
    /* L'ordinamento di prima costruiva l'elenco dai genitori e ci attaccava i
     * figli: una categoria che non rientrava in nessuno dei due casi non
     * usciva. Qui non si filtra niente — ogni categoria ha una rosa, e
     * nasconderne una vuol dire far sparire dei giocatori. */
    const dentro = [sec('a', 'Under 13', 0), sec('b', 'Under 15', 1), sec('c', 'Prima squadra', 2)];
    is(orderedSectors(dentro).length, 3);
  });

  test('un elenco vuoto resta vuoto, e non lancia', () => {
    is(orderedSectors([]).length, 0);
    is(orderedSectors(null).length, 0);
  });

  test('l elenco in ingresso non viene toccato', () => {
    // Si ordina una COPIA: `state.sectors` è condiviso, e riordinarlo sul
    // posto cambierebbe l'ordine anche a chi non l'ha chiesto.
    const dentro = [sec('b', 'Under 15', 1), sec('a', 'Under 13', 0)];
    orderedSectors(dentro);
    is(dentro[0].id, 'b');
  });

  test('il nome e il nome, senza genitori da anteporre', () => {
    is(sectorFullName(sec('a', 'Under 15', 0)), 'Under 15');
    is(sectorFullName(null), '');
  });
});

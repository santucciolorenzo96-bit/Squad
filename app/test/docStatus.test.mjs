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

const sec = (id, name, order, parent) => ({ id, name, sort_order: order, parent_id: parent || null });

describe('gerarchia delle categorie', () => {
  test('ogni genitore è seguito dai propri figli', () => {
    const out = orderedSectors([
      sec('b', 'Bianca', 1, 'u15'), sec('u13', 'Under 13', 2), sec('u15', 'Under 15', 1), sec('a', 'Blu', 0, 'u15')
    ]);
    is(out.map(s => s.id).join(','), 'u15,a,b,u13');
  });

  // Se il genitore non c'è, la sottocategoria ha comunque una rosa: nasconderla
  // vorrebbe dire far sparire dei giocatori.
  test('un figlio senza genitore non sparisce', () => {
    const out = orderedSectors([sec('u13', 'Under 13', 0), sec('orfano', 'Blu', 0, 'sparito')]);
    is(out.length, 2);
    is(out[1].id, 'orfano');
  });

  test('il nome per esteso include il genitore', () => {
    const list = [sec('u15', 'Under 15', 0), sec('a', 'Blu', 0, 'u15')];
    is(sectorFullName(list[1], list), 'Under 15 · Blu');
    is(sectorFullName(list[0], list), 'Under 15');
  });
});

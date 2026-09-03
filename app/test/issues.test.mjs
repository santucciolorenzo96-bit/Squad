import { describe, test, is, ok } from './run.mjs';
import { detectIssues } from '../src/utils/issues.js';

const OGGI = '2026-03-15';
const sectors = [{ id: 's1', name: 'Under 15' }];
const inRosa = (id, name) => ({ id, name, number: '7', player_sectors: [{ sector_id: 's1' }] });

function run(extra) {
  return detectIssues(Object.assign({
    today: OGGI, players: [], documents: [], deadlines: [],
    communications: [], trainings: [], attendance: [], sponsors: [],
    sectors, hasFinance: true
  }, extra));
}
const find = (issues, id) => issues.find(i => i.id === id);

describe('certificati medici', () => {
  test('un certificato scaduto è critico', () => {
    const i = find(run({
      players: [inRosa('p1', 'Rossi')],
      documents: [{ player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2026-01-10' }]
    }), 'certificati_scaduti');
    ok(i); is(i.severity, 'critical'); is(i.items.length, 1);
  });

  // Il caso che una regola ingenua sbaglia: il vecchio scaduto non conta se
  // ce n'è uno nuovo valido.
  test('un certificato vecchio scaduto non conta se ce n\'è uno nuovo', () => {
    const issues = run({
      players: [inRosa('p1', 'Rossi')],
      documents: [
        { player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2025-06-01' },
        { player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2027-06-01' }
      ]
    });
    is(find(issues, 'certificati_scaduti'), undefined);
    is(find(issues, 'certificati_in_scadenza'), undefined);
  });

  test('un certificato respinto vale come mancante', () => {
    const i = find(run({
      players: [inRosa('p1', 'Rossi')],
      documents: [{ player_id: 'p1', doc_type: 'certificato_medico', status: 'rejected', expires_at: '2027-01-01' }]
    }), 'certificati_mancanti');
    ok(i);
  });

  test('chi non è in nessuna categoria non risulta scoperto', () => {
    const issues = run({ players: [{ id: 'p9', name: 'Fuori rosa', number: '0', player_sectors: [] }] });
    is(find(issues, 'certificati_mancanti'), undefined);
  });

  test('in scadenza entro trenta giorni, non oltre', () => {
    const dentro = run({
      players: [inRosa('p1', 'A')],
      documents: [{ player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2026-04-01' }]
    });
    const fuori = run({
      players: [inRosa('p1', 'A')],
      documents: [{ player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2026-09-01' }]
    });
    ok(find(dentro, 'certificati_in_scadenza'));
    is(find(fuori, 'certificati_in_scadenza'), undefined);
  });
});

describe('scadenze economiche', () => {
  test('senza accesso alla finanza non se ne parla', () => {
    const issues = detectIssues({
      today: OGGI, players: [], documents: [], sectors, hasFinance: false,
      deadlines: [{ kind: 'income', due_date: '2026-01-01', description: 'Quota', planned_amount: 100, _status: { residual_amount: 100 } }]
    });
    is(find(issues, 'quote_scadute'), undefined);
  });

  test('distingue le quote scadute da quelle in arrivo', () => {
    const issues = run({
      deadlines: [
        { kind: 'income', due_date: '2026-02-01', description: 'Prima rata', planned_amount: 100, _status: { residual_amount: 100 } },
        { kind: 'income', due_date: '2026-03-20', description: 'Seconda rata', planned_amount: 100, _status: { residual_amount: 100 } }
      ]
    });
    is(find(issues, 'quote_scadute').items.length, 1);
    is(find(issues, 'quote_in_scadenza').items.length, 1);
  });
});

describe('convocazioni', () => {
  test('un evento imminente senza conferme è critico', () => {
    const i = find(run({
      players: [inRosa('p1', 'Rossi')],
      communications: [{
        id: 'c1', sector_id: 's1', title: 'Convocazione', requires_response: true,
        event_date: '2026-03-16',
        communication_recipients: [{ player_id: 'p1', status: 'pending' }]
      }]
    }), 'convocazioni_senza_risposta');
    ok(i); is(i.severity, 'critical');
  });

  test('un evento già passato non chiede più niente', () => {
    const issues = run({
      players: [inRosa('p1', 'Rossi')],
      communications: [{
        id: 'c1', sector_id: 's1', title: 'Vecchia', requires_response: true,
        event_date: '2026-01-01',
        communication_recipients: [{ player_id: 'p1', status: 'pending' }]
      }]
    });
    is(find(issues, 'convocazioni_senza_risposta'), undefined);
  });

  test('se hanno risposto tutti non risulta niente', () => {
    const issues = run({
      players: [inRosa('p1', 'Rossi')],
      communications: [{
        id: 'c1', sector_id: 's1', title: 'Convocazione', requires_response: true,
        event_date: '2026-03-20',
        communication_recipients: [{ player_id: 'p1', status: 'confirmed' }]
      }]
    });
    is(find(issues, 'convocazioni_senza_risposta'), undefined);
  });
});

describe('presenze e ordinamento', () => {
  test('segnala solo gli allenamenti già svolti senza rilevazione', () => {
    const i = find(run({
      trainings: [
        { id: 't1', sector_id: 's1', title: 'Tecnica', date: '2026-03-10' },
        { id: 't2', sector_id: 's1', title: 'Futuro', date: '2026-03-20' }
      ],
      attendance: []
    }), 'presenze_non_rilevate');
    is(i.items.length, 1);
  });

  test('i problemi critici vengono prima di tutti gli altri', () => {
    const issues = run({
      players: [inRosa('p1', 'Rossi')],
      documents: [
        { player_id: 'p1', doc_type: 'certificato_medico', status: 'approved', expires_at: '2026-01-01' },
        { player_id: 'p1', doc_type: 'tesseramento_fip', status: 'in_review', uploaded_at: '2026-03-01T10:00:00Z' }
      ]
    });
    is(issues[0].severity, 'critical');
    ok(issues.length >= 2);
  });

  test('senza anomalie non inventa problemi', () => {
    is(run({}).length, 0);
  });
});

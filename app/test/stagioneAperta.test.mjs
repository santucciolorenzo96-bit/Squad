import { describe, test, is, ok } from './run.mjs';
import { detectIssues } from '../src/utils/issues.js';

/* La stagione che è finita e nessuno ha chiuso.
 *
 * Non è un errore di nessuno: è una cosa che semplicemente non succede. Il
 * 30 giugno passa, la stagione resta aperta, e da luglio tutto quello che si
 * inserisce continua a finire dentro l'anno vecchio — senza un errore, senza
 * un sintomo. A dicembre le statistiche di due stagioni sono sommate sotto
 * un'etichetta sola, che è la cosa che le stagioni esistono per impedire.
 */

const OGGI = '2026-09-17';
const base = { today: OGGI, players: [], documents: [], sectors: [] };
const avviso = (seasons) =>
  detectIssues({ ...base, seasons }).find(x => x.id === 'stagione_da_chiudere');

const stagione = (nome, inizio, fine, chiusa = false) =>
  ({ name: nome, start_date: inizio, end_date: fine, closed: chiusa });

describe('la stagione da chiudere', () => {
  test('finita da un pezzo e nessuna nuova: è il caso grave', () => {
    const a = avviso([stagione('2025/2026', '2025-07-01', '2026-06-30')]);
    ok(a);
    is(a.severity, 'critical');
    ok(a.title.includes('2025/2026'));
  });

  test('finita da poco: avvisa, ma non allarma', () => {
    is(avviso([stagione('x', '2025-09-01', '2026-08-28')]).severity, 'warning');
  });

  test('se la stagione nuova esiste, non c’è niente da dire', () => {
    // È lei a ricevere i dati: la vecchia rimasta aperta è disordine, non un
    // guasto, e un avviso per il disordine insegna a ignorare gli avvisi.
    is(avviso([
      stagione('2025/2026', '2025-07-01', '2026-06-30'),
      stagione('2026/2027', '2026-07-01', '2027-06-30')
    ]), undefined);
  });

  test('una stagione in corso non è un problema', () => {
    is(avviso([stagione('2026/2027', '2026-07-01', '2027-06-30')]), undefined);
  });

  test('chiuse tutte, e si sta scrivendo dentro una chiusa e scaduta', () => {
    // Nessuna aperta: l'app ricade sulla più recente, che è finita. I dati
    // nuovi entrano in una stagione archiviata.
    ok(avviso([stagione('2025/2026', '2025-07-01', '2026-06-30', true)]));
  });

  test('una società senza stagioni non riceve avvisi sulle stagioni', () => {
    is(avviso([]), undefined);
    is(avviso(undefined), undefined);
  });

  test('una stagione senza data di fine non si può giudicare', () => {
    is(avviso([{ name: 'senza fine', start_date: '2025-07-01', closed: false }]), undefined);
  });

  test('porta dove si risolve', () => {
    is(avviso([stagione('2025/2026', '2025-07-01', '2026-06-30')]).action.tab, 'squadra');
  });
});

import { computeSeasonStats } from './stats.js';

/* Il referto di una partita.
 *
 * È quello che il dirigente porta via, ed è anche l'unico posto dove le cose
 * che lo scout ha raccolto durante la partita si rileggono insieme. Finora
 * quei dati esistevano solo dentro il tabellino aperto: chiusa la partita,
 * sparivano dalla vista.
 *
 * Qui non si calcola niente di nuovo: si mette in ordine. I conti delle fasi e
 * delle rotazioni li ha già fatti il motore degli scambi, set per set; il
 * tabellino lo fa la stessa funzione che fa le statistiche di stagione, così
 * una partita e una stagione non possono dare due numeri diversi per la stessa
 * cosa.
 */

// Quanti set sono finiti davvero. L'ultimo set di una partita già decisa si
// chiude senza aprirne un altro, quindi il numero del set in corso non basta.
function quantiChiusi(g) {
  return Math.max(g.chiusi || 0, Math.max(0, (g.quarter || 1) - 1));
}

export function refertoPartita(g, sport) {
  if (!g) return null;
  const chiusi = (g.periodScores || []).slice(0, quantiChiusi(g)).filter(Boolean);

  // I set, uno per riga, con dentro anche le due fasi di quel set: è lì che si
  // vede il set in cui la ricezione è crollata.
  const set = chiusi.map((r, i) => ({
    n: i + 1,
    us: r.us || 0,
    them: r.them || 0,
    so: { v: r.soV || 0, t: r.soT || 0 },
    bp: { v: r.bpV || 0, t: r.bpT || 0 }
  }));

  // Le fasi dell'intera partita: la somma di quelle dei set.
  const fasi = chiusi.reduce((a, r) => ({
    so: { v: a.so.v + (r.soV || 0), t: a.so.t + (r.soT || 0) },
    bp: { v: a.bp.v + (r.bpV || 0), t: a.bp.t + (r.bpT || 0) }
  }), { so: { v: 0, t: 0 }, bp: { v: 0, t: 0 } });

  // Le sei rotazioni, sommate su tutti i set. È la tabella da cui si decide da
  // quale rotazione far partire il sestetto la volta dopo.
  const per = {};
  chiusi.forEach(r => {
    Object.entries(r.perRot || {}).forEach(([n, c]) => {
      const k = Number(n);
      per[k] = { f: (per[k] ? per[k].f : 0) + (c.f || 0), s: (per[k] ? per[k].s : 0) + (c.s || 0) };
    });
  });
  const rotazioni = Object.keys(per)
    .map(Number)
    .sort((a, b) => a - b)
    .map(n => ({ n, f: per[n].f, s: per[n].s, saldo: per[n].f - per[n].s }));

  // Il tabellino: la stessa aggregazione delle statistiche di stagione, su una
  // partita sola. `friendly: false` perché un'amichevole non entra nei conti
  // della stagione ma il suo referto si legge come tutti gli altri.
  const tabellino = computeSeasonStats([{ ...g, friendly: false }], sport)
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  return { set, fasi, rotazioni, tabellino, chiusi: chiusi.length };
}

// Percentuale, o null dove non c'è ancora niente da dire. Uno zero inventato
// su zero scambi è un dato falso che sembra vero.
export function quota(x) {
  return x && x.t ? Math.round((x.v / x.t) * 100) : null;
}

/* Le righe del referto in forma di tabella, pronte sia per il PDF sia per il
   CSV sia per la schermata. Una sola definizione per tre destinazioni: se si
   aggiunge una colonna, compare in tutte e tre. */
export function tabellaTabellino(referto, sport) {
  const colonne = [
    { k: 'number', label: 'N' },
    { k: 'name', label: 'Giocatore' },
    ...sport.seasonColumns.map(c => ({
      k: c.key,
      label: c.short || c.label,
      calc: c.calc,
      suffisso: c.suffisso
    }))
  ];

  const righe = referto.tabellino.map(r => colonne.map(c => {
    if (c.k === 'number' || c.k === 'name') return r[c.k] == null ? '' : String(r[c.k]);
    const v = c.calc ? c.calc(r) : (r[c.k] || 0);
    if (v == null) return '—';
    return String(v) + (c.suffisso || '');
  }));

  return { intestazioni: colonne.map(c => c.label), righe };
}

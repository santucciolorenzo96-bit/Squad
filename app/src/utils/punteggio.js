import { quantiChiusi } from './referto.js';

/* IL PUNTEGGIO DELLA PARTITA IN CORSO.
 *
 * Stava dentro lo scout, ed è la funzione che gira più spesso di tutte: a ogni
 * disegno, a ogni azione, a ogni chiusura di periodo. Sta qui per due ragioni.
 *
 * La prima è che si può provare. Dentro un file con dentro React non si prova
 * niente su Node, e questa è la funzione che NON deve poter lanciare: se
 * lancia lei, lancia il disegno, e senza rete di sicurezza lo scout
 * scompariva dallo schermo in mezzo a una partita.
 *
 * La seconda è che il conto è diverso per sport e non lo decide lo scout:
 * nella pallavolo il punteggio sono i SET vinti, nel basket è la somma dei
 * punti dei giocatori, nel calcio è la somma dei periodi. Tre regole, un posto.
 *
 * NON LANCIA MAI. Una partita può arrivare da una copia locale scritta a metà,
 * da una riga di database più vecchia del codice, da un conflitto risolto male.
 * In tutti quei casi il punteggio giusto è quello che si riesce a calcolare, e
 * uno scout in piedi che mostra 0-0 vale infinitamente più di uno schermo
 * bianco.
 */
export function calcolaPunteggi(g, sport) {
  if (!g || !sport || !sport.scout) return;
  const conf = sport.scout;
  const periodi = Array.isArray(g.periodScores) ? g.periodScores : [];
  const rosa = Array.isArray(g.players) ? g.players : [];
  const punti = (p) => {
    const v = sport.score((p && p.stats) || {});
    return typeof v === 'number' && isFinite(v) ? v : 0;
  };

  // La pallavolo: il punteggio della partita sono i set vinti, e si contano
  // solo quelli CHIUSI. Il set in corso non si conta: sul 20-18 nessuno è
  // avanti 1-0.
  if (conf.scoreDisplay === 'setsWon') {
    const chiusi = periodi.slice(0, quantiChiusi(g));
    g.teamScore = chiusi.filter(x => x && x.us > x.them).length;
    g.oppScore = chiusi.filter(x => x && x.them > x.us).length;
    return;
  }

  g.teamScore = conf.ourScore === 'fromActions'
    ? rosa.reduce((n, p) => n + punti(p), 0)
    : periodi.reduce((n, x) => n + ((x && x.us) || 0), 0);
  g.oppScore = periodi.reduce((n, x) => n + ((x && x.them) || 0), 0);
}

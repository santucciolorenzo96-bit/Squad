import { computeSeasonStats } from './stats.js';
import { quintettiOrdinati } from './regole.js';

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

  /* I quintetti.
   *
   * Nel basket è la riga che si cerca per prima a mente fredda: con quali
   * cinque in campo la squadra ha guadagnato, e con quali ha perso terreno.
   * Il registro lo tiene lo scout a ogni cambio, qui si mettono i nomi al
   * posto degli identificativi e si ordina dal migliore.
   *
   * Solo i quintetti che hanno visto almeno un punto: gli altri nascono dai
   * cambi in serie a un time out e non raccontano niente di nessuno. */
  const nomi = {};
  (g.players || []).forEach(p => { nomi[p.id] = p.number ? '#' + p.number : (p.name || ''); });
  const quintetti = quintettiOrdinati(g.quintetti).map(q => ({
    ...q,
    nomi: q.ids.map(id => nomi[id] || '?')
  }));

  // Come ha attaccato la squadra: si calcola sui totali di tutti, quindi
  // sulla stessa riga che il tabellino mette in fondo.
  const attacco = tabellino.length ? attaccoSquadra(totaleTabellino(tabellino)) : null;

  const tiri = tiriPartita(g, sport);
  const traiettorie = traiettoriePartita(g);

  return { set, fasi, rotazioni, quintetti, attacco, tiri, traiettorie, tabellino, chiusi: chiusi.length };
}

/* La riga della squadra.
 *
 * In fondo a ogni tabellino di carta c'è, e non è un ornamento: è la riga da
 * cui si capisce com'è andata la partita. Quaranta su novanta al tiro si
 * legge lì, non sommando a mente dodici righe.
 *
 * Si sommano solo i CONTEGGI. Le percentuali della riga squadra si
 * ricalcolano dai totali con la stessa funzione delle altre righe: sommare
 * dodici percentuali darebbe un numero che non vuol dire niente.
 */
export function totaleTabellino(righe) {
  const t = { id: null, name: 'Squadra', number: '', games: righe.length ? 1 : 0 };
  righe.forEach(r => {
    Object.keys(r).forEach(k => {
      if (k === 'games' || typeof r[k] !== 'number') return;
      t[k] = (t[k] || 0) + r[k];
    });
  });
  return t;
}

/* COME ABBIAMO ATTACCATO.
 *
 * Nel basket due partite non si confrontano sui totali, perché non si gioca
 * lo stesso numero di palloni: una squadra che corre ne gioca settanta, una
 * che controlla cinquantacinque. Sessantotto punti sono una prestazione
 * mediocre nella prima e ottima nella seconda, e guardando solo il punteggio
 * le due sembrano la stessa cosa.
 *
 * Il POSSESSO è l'unità che le rende confrontabili: quante volte abbiamo
 * avuto la palla. Non si conta, si ricava — un possesso finisce con un tiro,
 * con una palla persa o in lunetta, e un rimbalzo offensivo non ne apre uno
 * nuovo perché è lo stesso che continua.
 *
 *     possessi = tiri dal campo − rimbalzi offensivi + palle perse + 0,44 × tiri liberi
 *
 * Il 44% è la stima con cui si convertono i tiri liberi in possessi, ed è la
 * stessa che usano la FIBA e la NBA: non tutti i viaggi in lunetta chiudono un
 * possesso (un fallio in tiro da tre ne vale tre, un 1+1 dipende).
 *
 * Da qui tre dei quattro fattori con cui si vincono le partite. Il quarto —
 * il rimbalzo offensivo — richiede i rimbalzi difensivi AVVERSARI, che non
 * raccogliamo: meglio non averlo che inventarlo.
 */
export function attaccoSquadra(t) {
  if (!t) return null;
  const tiri = (t.fga2 || 0) + (t.fga3 || 0);
  const possessi = tiri - (t.orb || 0) + (t.tov || 0) + 0.44 * (t.fta || 0);
  if (possessi <= 0) return null;
  const q = (v, d) => (d ? Math.round((v / d) * 100) : null);
  return {
    possessi: Math.round(possessi),
    // Punti per possesso, con due decimali: fra 0,85 e 1,10 c'è tutta la
    // differenza fra un attacco che fatica e uno che funziona, e arrotondare
    // a numero intero la cancellerebbe.
    ppp: Math.round(((t.pts || 0) / possessi) * 100) / 100,
    // Quante volte su cento la palla si è persa senza nemmeno tirare.
    perse: q(t.tov || 0, possessi),
    // Quanti tiri liberi ci siamo guadagnati ogni cento tiri dal campo:
    // dice se si attacca il ferro o ci si accontenta.
    liberi: q(t.fta || 0, tiri),
    rimbalziOff: t.orb || 0
  };
}

/* LA MAPPA DEI TIRI.
 *
 * I tiri stanno dentro le statistiche di chi li ha presi — ognuno con il
 * punto da cui è partito — e qui si rimettono insieme in un elenco solo,
 * che è come si guardano: la mappa di una squadra, non di una persona.
 *
 * La zona non è registrata: si deduce dal punto, ogni volta, chiedendola
 * allo sport. Così se un domani si corregge dove passa l'arco, si correggono
 * anche tutte le partite già archiviate invece di restare sbagliate per
 * sempre.
 */
export function tiriPartita(g, sport) {
  if (!sport.zonaTiro) return null;
  const punti = [];
  (g.players || []).forEach(p => {
    ((p.stats || {}).tiri || []).forEach(t => {
      punti.push({ ...t, giocatore: p.id, zona: sport.zonaTiro(t.x, t.y) });
    });
  });
  if (punti.length === 0) return null;

  const zone = (sport.zoneTiro || []).map(z => {
    const suoi = punti.filter(t => t.zona === z.key);
    const fatti = suoi.filter(t => t.dentro).length;
    return { ...z, fatti, tentati: suoi.length, quota: suoi.length ? Math.round((fatti / suoi.length) * 100) : null };
  }).filter(z => z.tentati > 0);

  return { punti, zone };
}

/* LE TRAIETTORIE DEI PUNTI.
 *
 * Il tabellino dice che Rossi ha fatto quattordici punti. La mappa dice che
 * dodici sono partiti dalla stessa zona e caduti nello stesso metro
 * quadrato — e che gli avversari non l'hanno mai coperto. Sono due
 * informazioni diverse, e la seconda si vede solo disegnandola.
 *
 * Stanno dentro chi le ha giocate, come i tiri del basket, e qui si
 * rimettono in un elenco solo: la mappa di una squadra, non di una persona.
 */
export function traiettoriePartita(g) {
  const linee = [];
  (g.players || []).forEach(p => {
    ((p.stats || {}).traiettorie || []).forEach(t => {
      linee.push({ ...t, giocatore: p.id, numero: p.number, nome: p.name });
    });
  });
  return linee.length ? linee : null;
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
      suffisso: c.suffisso,
      frazione: c.frazione,
      segno: c.segno,
      nonSommare: c.nonSommare
    }))
  ];

  // Su carta e in un foglio di calcolo il "5/12" è quello che si legge: la
  // percentuale si ricava, la frazione no. Sullo schermo è il contrario —
  // lì si ordina per percentuale — e infatti le due viste scelgono da sé.
  const cella = (c, r) => {
    if (c.k === 'number' || c.k === 'name') return r[c.k] == null ? '' : String(r[c.k]);
    if (c.frazione) {
      const f = c.frazione(r);
      if (!f) return '—';
      const q = c.calc ? c.calc(r) : null;
      return q == null ? f : f + ' (' + q + '%)';
    }
    const v = c.calc ? c.calc(r) : (r[c.k] || 0);
    if (v == null) return '—';
    return (c.segno && v > 0 ? '+' : '') + String(v) + (c.suffisso || '');
  };

  const righe = referto.tabellino.map(r => colonne.map(c => cella(c, r)));
  // Fuori da `righe` di proposito: chi disegna la tabella la mette in fondo
  // con un tratto sopra, non come una tredicesima giocatrice.
  const somma = referto.tabellino.length ? totaleTabellino(referto.tabellino) : null;
  const totale = somma
    // Alcune colonne nella riga squadra non hanno senso e restano vuote: il
    // piu'/meno sommato fra dodici giocatori darebbe cinque volte lo scarto.
    ? colonne.map(c => (c.nonSommare ? '' : cella(c, somma)))
    : null;

  return { intestazioni: colonne.map(c => c.label), righe, totale };
}

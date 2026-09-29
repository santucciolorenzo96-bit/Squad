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

  const traiettorieAtleti = traiettoriePerAtleta(g);

  /* Il referto completo. Le prime due si ricavano dai totali, le altre due
     vogliono il registro delle azioni e valgono null senza. */
  const somma = tabellino.length ? totaleTabellino(tabellino) : null;

  /* Le percentuali e i conteggi li decide LO SPORT, non il referto. Un referto
     di pallavolo con i rimbalzi a zero non e' incompleto: e' il referto di un
     altro gioco. */
  const ciambelle = somma && sport.ciambelle ? sport.ciambelle(somma) : null;
  const riepilogo = somma && sport.riepilogo ? sport.riepilogo(somma) : null;
  const periodi = statistichePerPeriodo(g, sport);
  const ciambellePeriodi = periodi && sport.ciambelle
    ? periodi.map(p => sport.ciambelle(p))
    : null;
  const andamento = andamentoPartita(g, sport);

  return {
    set, fasi, rotazioni, quintetti, attacco, tiri,
    traiettorie, traiettorieAtleti, tabellino,
    ciambelle, riepilogo, ciambellePeriodi, andamento,
    chiusi: chiusi.length
  };
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

/* Le stesse traiettorie, divise per chi le ha giocate.
 *
 * La mappa di squadra risponde a «dove cadono i nostri punti». È una domanda
 * buona, ma non è quella che ci si fa guardando un referto: quella è «dove
 * attacca la 4». Un allenatore avversario la prepara per nome, e una mappa in
 * cui dodici righe hanno tutte lo stesso colore non gliela dice.
 *
 * Ordinate per quante ne hanno: chi ha attaccato di più sta in cima, ed è
 * quella di cui si parla per prima.
 */
export function traiettoriePerAtleta(g) {
  const per = new Map();
  (g.players || []).forEach(p => {
    const sue = (p.stats || {}).traiettorie || [];
    if (sue.length === 0) return;
    per.set(p.id, {
      id: p.id,
      numero: p.number,
      nome: p.name,
      linee: sue.map(t => ({ ...t })),
      // I punti veri, cioè le traiettorie di un attacco vincente: le altre
      // azioni con traiettoria, se un domani ce ne saranno, non sono punti.
      punti: sue.filter(t => t.act === 'kill').length
    });
  });
  return Array.from(per.values()).sort((a, b) => b.linee.length - a.linee.length);
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

/* ======================================================================== */
/* IL REFERTO COMPLETO: TIRO, CONTATORI, ANDAMENTO                          */
/* ======================================================================== */
/*
 * Un referto di Eurolega o NBA non è il tabellino con più colonne: è un altro
 * documento. Risponde a domande che il tabellino non fa — come abbiamo tirato
 * da tre rispetto a da due, in quale quarto ci siamo fermati, quanto siamo
 * stati avanti, quanti punti di fila abbiamo preso nel momento in cui la
 * partita è girata.
 *
 * Le prime due si ricavano dai totali che già ci sono. Le altre no: vogliono
 * l'ORDINE in cui le cose sono successe, e i totali l'ordine l'hanno perso.
 * Per quelle c'è `storia`, il registro delle azioni che lo scout scrive
 * mentre si segna (migrazione 054). Le partite archiviate prima non ce l'hanno
 * e le sezioni che dipendono da lui semplicemente non compaiono: meglio una
 * sezione in meno che un numero inventato.
 */

/* L'azione con quel nome, dentro la configurazione dello sport.
 *
 * Sta qui e non in tre posti diversi: la usano il referto per rileggere il
 * registro e i test per simulare una partita, e due copie della stessa ricerca
 * divergono al primo gruppo nuovo.
 */
export function azioneDi(sport, act) {
  const conf = (sport && sport.scout) || {};
  const gruppi = conf.groups || [];
  for (let i = 0; i < gruppi.length; i++) {
    const a = (gruppi[i].actions || []).find(x => x.act === act);
    if (a) return a;
  }
  const catene = conf.chains || {};
  const nomi = Object.keys(catene);
  for (let i = 0; i < nomi.length; i++) {
    const c = catene[nomi[i]];
    if (c && c.azione && c.azione.act === act) return c.azione;
  }
  return null;
}

// Quanti punti vale un'azione. Si misura invece di leggerla da una proprietà:
// i punti li decide `score()` sulle statistiche, ed è l'unica versione vera.
function puntiAzione(sport, azione) {
  const s = sport.newStats();
  Object.entries((azione && azione.apply) || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
  return sport.score(s);
}

/* COME ABBIAMO TIRATO.
 *
 * Quattro numeri, e il quarto non è una somma qualunque: «dal campo» sono i
 * tiri da due più quelli da tre, senza i liberi. È la percentuale che si
 * guarda per prima, e tenerla separata dai liberi è il motivo per cui esiste.
 */
export function tiroSquadra(s) {
  if (!s) return null;
  const q = (v, t) => (t ? Math.round((v / t) * 100) : null);
  const due = { v: s.fgm2 || 0, t: s.fga2 || 0 };
  const tre = { v: s.fgm3 || 0, t: s.fga3 || 0 };
  const liberi = { v: s.ftm || 0, t: s.fta || 0 };
  const campo = { v: due.v + tre.v, t: due.t + tre.t };
  [due, tre, liberi, campo].forEach(x => { x.pct = q(x.v, x.t); });
  if (!due.t && !tre.t && !liberi.t) return null;
  return { liberi, due, tre, campo };
}

/* I CONTATORI.
 *
 * Rimbalzi con la divisione fra offensivi e difensivi, e poi le cinque voci
 * che in ogni referto stanno su una riga sola. Non sono percentuali: sono
 * quante volte è successo, e si leggono come tali.
 */
export function contatoriSquadra(s) {
  if (!s) return null;
  const orb = s.orb || 0;
  const drb = s.drb || 0;
  return {
    rimbalzi: orb + drb,
    offensivi: orb,
    difensivi: drb,
    assist: s.ast || 0,
    perse: s.tov || 0,
    rubate: s.stl || 0,
    stoppate: s.blk || 0,
    falli: s.pf || 0
  };
}

/* LE STATISTICHE QUARTO PER QUARTO.
 *
 * Si ricostruiscono rileggendo il registro: ogni azione sa in quale periodo è
 * successa, e riapplicarla a un contatore per periodo dà le stesse colonne del
 * tabellino, divise in quattro. È lo stesso gesto che fa lo scout mentre si
 * segna, rifatto a posteriori.
 *
 * Null senza registro: una partita archiviata prima della 054 non ha l'ordine
 * delle cose, e non c'è modo di inventarlo.
 */
export function statistichePerPeriodo(g, sport) {
  if (!g || !Array.isArray(g.storia) || g.storia.length === 0) return null;
  const quanti = g.storia.reduce((n, e) => Math.max(n, (e && e.q) || 1), 1);
  const per = [];
  for (let i = 0; i < quanti; i++) per.push(sport.newStats());

  g.storia.forEach(e => {
    if (!e || !e.a || e.a === 'loro' || e.a === 'noi') return;
    const azione = azioneDi(sport, e.a);
    const s = per[((e.q || 1) - 1)];
    if (!azione || !s) return;
    Object.entries(azione.apply || {}).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
  });

  return per;
}

/* L'ANDAMENTO: quanto siamo stati avanti, e i parziali.
 *
 * Il punteggio si ricostruisce azione per azione, e da quella riga di numeri
 * escono le due cose che in un referto si leggono per prime: il massimo
 * vantaggio, e il parziale più lungo — quanti punti di fila ha fatto una
 * squadra senza che l'altra rispondesse. È il momento in cui la partita è
 * girata, e nei totali non si vede.
 *
 * Un parziale si chiude quando segna l'altra: per questo si contano i punti e
 * non le azioni. Sette punti di fila fatti con due triple e un libero sono un
 * 7-0, non un 3-0.
 */
export function andamentoPartita(g, sport) {
  if (!g || !Array.isArray(g.storia) || g.storia.length === 0) return null;

  let us = 0;
  let them = 0;
  let maxV = 0;
  let maxS = 0;
  let correnteNoi = 0;
  let correnteLoro = 0;
  let runNoi = 0;
  let runLoro = 0;
  const serie = [{ us: 0, them: 0 }];

  const segna = (lato, punti) => {
    if (!punti) return;
    if (lato === 'us') {
      us += punti;
      correnteNoi += punti;
      correnteLoro = 0;
      if (correnteNoi > runNoi) runNoi = correnteNoi;
    } else {
      them += punti;
      correnteLoro += punti;
      correnteNoi = 0;
      if (correnteLoro > runLoro) runLoro = correnteLoro;
    }
    if (us - them > maxV) maxV = us - them;
    if (them - us > maxS) maxS = them - us;
    serie.push({ us, them });
  };

  g.storia.forEach(e => {
    if (!e || !e.a) return;
    if (e.a === 'loro') { segna('them', e.n || 0); return; }
    if (e.a === 'noi') { segna('us', e.n || 0); return; }
    const azione = azioneDi(sport, e.a);
    if (azione) segna('us', puntiAzione(sport, azione));
  });

  return {
    serie,
    maxVantaggio: maxV,
    maxSvantaggio: maxS,
    parzialeNostro: runNoi,
    parzialeLoro: runLoro,
    // Il punteggio ricostruito dal registro. Se non coincide con quello della
    // partita vuol dire che qualcosa è stato corretto senza passare dal
    // registro: chi legge deve poterlo sapere invece di fidarsi.
    ricostruito: { us, them }
  };
}

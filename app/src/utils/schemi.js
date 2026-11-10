/* GLI SCHEMI DI GIOCO: UN MOTORE PURO.
 *
 * Uno schema è una piccola animazione: cinque giocatori in attacco, in
 * posizioni numerate da 1 a 5, e una sequenza di PASSI. In ogni passo alcuni
 * giocatori si spostano, qualcuno ha la palla, e una didascalia dice cosa
 * succede. Dopo lo schema base ci sono le VARIANTI: stessa posizione di
 * partenza, un'altra sequenza, e una condizione scritta — «se il difensore va
 * sopra il blocco».
 *
 * TUTTO QUI È CALCOLO SU DATI. Niente React, niente orologio, niente rete: la
 * stessa funzione che dice dov'è il giocatore 3 a 1,4 secondi serve al lettore
 * che anima e all'editor che mostra il passo, e si può provare.
 *
 * COME SI MUOVE UN GIOCATORE
 * Ogni passo registra solo dove ARRIVA chi si muove: chi non compare resta
 * fermo. La posizione da cui parte è dove l'aveva lasciato il passo prima, quindi
 * lo schema non contiene mai un percorso scritto due volte — e spostare un
 * giocatore al passo 2 sposta anche il punto di partenza del passo 3, che è la
 * cosa che ci si aspetta.
 *
 * I TEMPI
 * Un passo dura poco, normale o tanto (1,2 / 2 / 3,2 secondi). Dentro il passo
 * un giocatore può partire subito, dopo un po', o più tardi: arriva comunque
 * alla fine del passo, quindi chi parte tardi si muove più in fretta. Sono
 * tre scelte e non un campo in millisecondi, perché un allenatore dice «il 3
 * parte dopo il passaggio», non «a 700 ms».
 *
 * LE COORDINATE
 * Mezzo campo FIBA, 15 x 14 metri, in unità da 10 cm: larghezza 150, profondità
 * 140. Il canestro è in alto, al centro, a 1,575 m dalla linea di fondo. Le
 * misure sono vere, così le linee disegnate stanno dove stanno in palestra.
 */

export const CAMPO = Object.freeze({
  w: 150,
  h: 140,
  canestro: Object.freeze({ x: 75, y: 15.75 }),
  margine: 6
});

export const ID_ATTACCO = Object.freeze(['o1', 'o2', 'o3', 'o4', 'o5']);
export const ID_DIFESA = Object.freeze(['d1', 'd2', 'd3', 'd4', 'd5']);
export const TUTTI = Object.freeze([...ID_ATTACCO, ...ID_DIFESA]);

export const TIPI_MOSSA = Object.freeze({
  taglio: 'Taglio',
  palleggio: 'Palleggio',
  blocco: 'Blocco'
});

// Quanto tardi parte un movimento, come frazione della durata del passo.
export const RITARDI = Object.freeze({ subito: 0, dopo: 0.35, tardi: 0.6 });
export const NOMI_RITARDO = Object.freeze({ subito: 'Subito', dopo: 'Dopo', tardi: 'Più tardi' });

export const DURATE = Object.freeze({ veloce: 1200, normale: 2000, lenta: 3200 });
export const NOMI_DURATA = Object.freeze({ veloce: 'Veloce', normale: 'Normale', lenta: 'Lenta' });

// Dopo ogni passo l'animazione si ferma un istante: il tempo di leggere cosa è
// successo prima che parta il passo dopo.
export const PAUSA_FRA_PASSI = 600;

export const LIMITI = Object.freeze({
  passi: 30,
  varianti: 8,
  etichette: 8,
  lunghezzaEtichetta: 24,
  titolo: 80,
  nota: 280,
  condizione: 140
});

// La palla si disegna accanto al giocatore che la tiene, non sotto.
const SCOSTAMENTO_PALLA = 6.5;
const SOGLIA_MOVIMENTO = 2;

/* ------------------------------------------------------------- utilita' */

const numero = (n) => typeof n === 'number' && isFinite(n);
const fra = (n, a, b) => Math.min(b, Math.max(a, n));
const testo = (s) => (typeof s === 'string' ? s : '');

export function distanza(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function nelCampo(p) {
  const m = CAMPO.margine;
  return { x: fra(p.x, m, CAMPO.w - m), y: fra(p.y, m, CAMPO.h - m) };
}

const arrotonda = (n) => Math.round(n * 10) / 10;

export function easeInOut(p) {
  const x = fra(p, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

let contatore = 0;
export function nuovoId(prefisso = 's') {
  contatore += 1;
  return prefisso + Date.now().toString(36).slice(-4) + contatore.toString(36)
    + Math.random().toString(36).slice(2, 5);
}

/* --------------------------------------------------------- posizioni base */

/* Cinque in attacco, come si dispongono quasi sempre: il play in cima, due ali,
 * due lunghi vicino a canestro. Chi crea uno schema parte da qui e sposta. */
const BASE_ATTACCO = Object.freeze({
  o1: { x: 75, y: 100 },
  o2: { x: 122, y: 70 },
  o3: { x: 28, y: 70 },
  o4: { x: 105, y: 40 },
  o5: { x: 45, y: 40 }
});

/* Il difensore di ciascuno: un passo verso canestro, sulla linea fra i due.
 * Così appena si accende la difesa i cerchi stanno dove ci si aspetta, e non
 * sovrapposti all'attacco. */
export function difensoreDi(p) {
  const dx = CAMPO.canestro.x - p.x;
  const dy = CAMPO.canestro.y - p.y;
  const d = Math.hypot(dx, dy) || 1;
  const passo = 11;
  return nelCampo({ x: arrotonda(p.x + (dx / d) * passo), y: arrotonda(p.y + (dy / d) * passo) });
}

export function posizioniIniziali({ difesa = false } = {}) {
  const pos = {};
  ID_ATTACCO.forEach(id => { pos[id] = { ...BASE_ATTACCO[id] }; });
  if (difesa) {
    ID_ATTACCO.forEach((id, i) => { pos[ID_DIFESA[i]] = difensoreDi(pos[id]); });
  }
  return pos;
}

export function schemaVuoto({ difesa = false } = {}) {
  return {
    v: 1,
    start: { pos: posizioniIniziali({ difesa }), palla: 'o1' },
    steps: [],
    varianti: []
  };
}

export function haLaDifesa(schema) {
  return !!(schema && schema.start && schema.start.pos && schema.start.pos.d1);
}

/* ----------------------------------------------------------- normalizzare */

function normalizzaPunto(p) {
  if (!p || !numero(p.x) || !numero(p.y)) return null;
  return nelCampo({ x: arrotonda(p.x), y: arrotonda(p.y) });
}

function idValido(id, conDifesa) {
  if (ID_ATTACCO.includes(id)) return true;
  return conDifesa && ID_DIFESA.includes(id);
}

function pallaValida(v) {
  return v === null || v === 'canestro' || ID_ATTACCO.includes(v);
}

export function normalizzaPasso(raw, conDifesa = false) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const moves = {};
  const grezze = r.moves && typeof r.moves === 'object' ? r.moves : {};
  Object.keys(grezze).forEach(id => {
    if (!idValido(id, conDifesa)) return;
    const m = grezze[id];
    const p = normalizzaPunto(m);
    if (!p) return;
    moves[id] = {
      x: p.x,
      y: p.y,
      tipo: TIPI_MOSSA[m.tipo] ? m.tipo : 'taglio',
      parte: RITARDI[m.parte] != null ? m.parte : 'subito'
    };
  });
  const passo = {
    id: testo(r.id) || nuovoId('p'),
    dur: DURATE[r.dur] ? r.dur : 'normale',
    nota: testo(r.nota).trim().slice(0, LIMITI.nota),
    moves,
    ritardoPalla: RITARDI[r.ritardoPalla] != null ? r.ritardoPalla : 'subito'
  };
  // `palla` assente vuol dire «non cambia»: non si scrive nemmeno la chiave.
  if (Object.prototype.hasOwnProperty.call(r, 'palla') && r.palla !== undefined && pallaValida(r.palla)) {
    passo.palla = r.palla;
  }
  return passo;
}

function normalizzaPassi(raw, conDifesa) {
  return (Array.isArray(raw) ? raw : []).slice(0, LIMITI.passi).map(p => normalizzaPasso(p, conDifesa));
}

/* Qualunque cosa arrivi dal database diventa uno schema valido. I dati li
 * scrive solo l'editor, ma un dato scritto da una versione vecchia, o a mano,
 * non deve far cadere la schermata di un atleta. */
export function normalizzaSchema(raw) {
  let r = raw;
  if (typeof r === 'string') { try { r = JSON.parse(r); } catch (e) { r = null; } }
  if (!r || typeof r !== 'object') return schemaVuoto();

  const base = posizioniIniziali();
  const grezze = r.start && r.start.pos && typeof r.start.pos === 'object' ? r.start.pos : {};
  const pos = {};
  ID_ATTACCO.forEach(id => { pos[id] = normalizzaPunto(grezze[id]) || base[id]; });

  // La difesa c'è tutta o non c'è: quattro difensori su cinque sarebbero un
  // errore di chi ha disegnato, non una scelta.
  const conDifesa = ID_DIFESA.every(id => normalizzaPunto(grezze[id]));
  if (conDifesa) ID_DIFESA.forEach(id => { pos[id] = normalizzaPunto(grezze[id]); });

  const pallaGrezza = r.start ? r.start.palla : undefined;
  const palla = pallaGrezza === undefined ? 'o1' : (pallaValida(pallaGrezza) ? pallaGrezza : 'o1');

  const varianti = (Array.isArray(r.varianti) ? r.varianti : []).slice(0, LIMITI.varianti).map((v, i) => ({
    id: testo(v && v.id) || nuovoId('v'),
    nome: testo(v && v.nome).trim().slice(0, 40) || 'Variante ' + (i + 1),
    condizione: testo(v && v.condizione).trim().slice(0, LIMITI.condizione),
    steps: normalizzaPassi(v && v.steps, conDifesa)
  }));

  return { v: 1, start: { pos, palla }, steps: normalizzaPassi(r.steps, conDifesa), varianti };
}

/* ------------------------------------------------------------------ stato */

function haCambioPalla(passo) {
  return Object.prototype.hasOwnProperty.call(passo, 'palla') && passo.palla !== undefined;
}

/* Dove sono tutti, e chi ha la palla, DOPO i primi `k` passi. Con 0 è la
 * posizione di partenza. */
export function statoDopo(start, steps, k) {
  const pos = {};
  Object.keys(start.pos).forEach(id => { pos[id] = { x: start.pos[id].x, y: start.pos[id].y }; });
  let palla = start.palla === undefined ? null : start.palla;
  const fino = Math.min(k, steps.length);
  for (let i = 0; i < fino; i++) {
    const passo = steps[i];
    Object.keys(passo.moves || {}).forEach(id => {
      if (pos[id]) pos[id] = { x: passo.moves[id].x, y: passo.moves[id].y };
    });
    if (haCambioPalla(passo)) palla = passo.palla;
  }
  return { pos, palla };
}

/* Chi ha la palla alla fine di un passo, e chi la aveva all'inizio. */
export function pallaDelPasso(start, steps, k) {
  const prima = statoDopo(start, steps, k).palla;
  const passo = steps[k];
  const dopo = passo && haCambioPalla(passo) ? passo.palla : prima;
  return { prima, dopo };
}

export function puntoPalla(pos, chi) {
  if (!chi) return null;
  if (chi === 'canestro') return { x: CAMPO.canestro.x, y: CAMPO.canestro.y };
  const p = pos[chi];
  return p ? { x: p.x + SCOSTAMENTO_PALLA, y: p.y + SCOSTAMENTO_PALLA } : null;
}

/* ----------------------------------------------------------------- tempo */

export function durataPasso(passo) {
  return DURATE[passo && passo.dur] || DURATE.normale;
}

export function inizioPasso(steps, k) {
  let t = 0;
  for (let i = 0; i < k && i < steps.length; i++) t += durataPasso(steps[i]) + PAUSA_FRA_PASSI;
  return t;
}

export function durataTotale(steps) {
  return steps.length ? inizioPasso(steps, steps.length) : 0;
}

/* A che punto del passo, da 0 a 1, per chi parte dopo `ritardo`. */
function avanzamento(dentro, dur, ritardo) {
  const inizio = ritardo * dur;
  if (dentro <= inizio) return 0;
  return fra((dentro - inizio) / (dur - inizio), 0, 1);
}

/* IL FOTOGRAMMA a un certo istante: posizioni, palla, e a che passo siamo. */
export function istante(start, steps, t) {
  if (!steps.length) {
    return { pos: statoDopo(start, steps, 0).pos, palla: puntoPalla(start.pos, start.palla), passo: -1, dentro: 0, inMoto: false };
  }
  const totale = durataTotale(steps);
  const tt = fra(t, 0, totale);

  let k = steps.length - 1;
  for (let i = 0; i < steps.length; i++) {
    if (tt < inizioPasso(steps, i + 1)) { k = i; break; }
  }

  const passo = steps[k];
  const dur = durataPasso(passo);
  const dentro = Math.min(tt - inizioPasso(steps, k), dur);
  const prima = statoDopo(start, steps, k);

  const pos = {};
  Object.keys(prima.pos).forEach(id => {
    const da = prima.pos[id];
    const m = passo.moves && passo.moves[id];
    if (!m) { pos[id] = da; return; }
    const e = easeInOut(avanzamento(dentro, dur, RITARDI[m.parte] || 0));
    pos[id] = { x: da.x + (m.x - da.x) * e, y: da.y + (m.y - da.y) * e };
  });

  const { prima: chi0, dopo: chi1 } = pallaDelPasso(start, steps, k);
  let palla;
  if (chi0 === chi1) {
    palla = puntoPalla(pos, chi1);
  } else {
    const e = easeInOut(avanzamento(dentro, dur, RITARDI[passo.ritardoPalla] || 0));
    const a = puntoPalla(pos, chi0);
    const b = puntoPalla(pos, chi1);
    if (!a) palla = b;
    else if (!b) palla = a;
    else palla = { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
  }

  return { pos, palla, passo: k, dentro, inMoto: dentro < dur && tt - inizioPasso(steps, k) < dur };
}

/* -------------------------------------------------------------- frecce */

/* Cosa disegnare per un passo: una freccia per chi si muove, e il passaggio o
 * il tiro se la palla cambia mano. Parte dal punto dove il giocatore era
 * all'inizio del passo e arriva dove sta alla fine. */
export function frecce(start, steps, k) {
  const passo = steps[k];
  if (!passo) return { movimenti: [], passaggio: null };
  const prima = statoDopo(start, steps, k);
  const dopo = statoDopo(start, steps, k + 1);

  const movimenti = [];
  Object.keys(passo.moves || {}).forEach(id => {
    const da = prima.pos[id];
    const a = dopo.pos[id];
    if (!da || !a || distanza(da, a) < SOGLIA_MOVIMENTO) return;
    movimenti.push({ id, tipo: passo.moves[id].tipo || 'taglio', da, a });
  });

  let passaggio = null;
  const chi0 = prima.palla;
  const chi1 = dopo.palla;
  if (chi0 && chi1 && chi0 !== chi1) {
    if (chi1 === 'canestro') {
      const da = chi0 === 'canestro' ? null : dopo.pos[chi0];
      if (da) passaggio = { da, a: { ...CAMPO.canestro }, tiro: true };
    } else if (chi0 !== 'canestro' && prima.pos[chi0] && dopo.pos[chi1]) {
      passaggio = { da: prima.pos[chi0], a: dopo.pos[chi1], tiro: false };
    }
  }
  return { movimenti, passaggio };
}

/* ------------------------------------------------------------- geometria */

/* Il punto d'arrivo accorciato: la freccia deve fermarsi al bordo del
 * giocatore, non finirgli sotto. */
export function accorcia(da, a, quanto) {
  const d = distanza(da, a);
  if (d <= quanto) return { ...a };
  const f = (d - quanto) / d;
  return { x: da.x + (a.x - da.x) * f, y: da.y + (a.y - da.y) * f };
}

export function testaFreccia(da, a, lunga = 7, larga = 3.6) {
  const d = distanza(da, a) || 1;
  const ux = (a.x - da.x) / d;
  const uy = (a.y - da.y) / d;
  const bx = a.x - ux * lunga;
  const by = a.y - uy * lunga;
  const nx = -uy;
  const ny = ux;
  return [
    a.x.toFixed(1) + ',' + a.y.toFixed(1),
    (bx + nx * larga).toFixed(1) + ',' + (by + ny * larga).toFixed(1),
    (bx - nx * larga).toFixed(1) + ',' + (by - ny * larga).toFixed(1)
  ].join(' ');
}

/* Il palleggio si disegna ondulato, come sulla lavagna: una linea dritta non
 * dice che il giocatore ha la palla in mano. */
export function percorsoOndulato(da, a, ampiezza = 2.4, passo = 7) {
  const d = distanza(da, a);
  const n = Math.max(2, Math.round(d / passo));
  const ux = (a.x - da.x) / (d || 1);
  const uy = (a.y - da.y) / (d || 1);
  const nx = -uy;
  const ny = ux;
  let s = 'M' + da.x.toFixed(1) + ' ' + da.y.toFixed(1);
  for (let i = 1; i <= n; i++) {
    const f = i / n;
    const fm = (i - 0.5) / n;
    const lato = i % 2 === 0 ? -1 : 1;
    const cx = da.x + (a.x - da.x) * fm + nx * ampiezza * lato * 2;
    const cy = da.y + (a.y - da.y) * fm + ny * ampiezza * lato * 2;
    s += ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' '
      + (da.x + (a.x - da.x) * f).toFixed(1) + ' ' + (da.y + (a.y - da.y) * f).toFixed(1);
  }
  return s;
}

/* Il blocco finisce con una sbarra, non con una freccia: chi blocca si ferma. */
export function sbarraBlocco(da, a, meta = 5.5) {
  const d = distanza(da, a) || 1;
  const nx = -(a.y - da.y) / d;
  const ny = (a.x - da.x) / d;
  return {
    x1: a.x + nx * meta, y1: a.y + ny * meta,
    x2: a.x - nx * meta, y2: a.y - ny * meta
  };
}

/* ------------------------------------------------------------ etichette */

export function pulisciEtichetta(s) {
  return testo(s).trim().replace(/^#+\s*/, '').replace(/\s+/g, ' ').trim().slice(0, LIMITI.lunghezzaEtichetta);
}

/* Senza doppioni (maiuscole a parte), senza vuote, nel numero consentito. La
 * prima scrittura vince: «Rimessa» e «rimessa» sono la stessa etichetta. */
export function etichetteUniche(lista) {
  const viste = new Set();
  const fuori = [];
  (Array.isArray(lista) ? lista : []).forEach(e => {
    const pulita = pulisciEtichetta(e);
    const chiave = pulita.toLowerCase();
    if (!pulita || viste.has(chiave) || fuori.length >= LIMITI.etichette) return;
    viste.add(chiave);
    fuori.push(pulita);
  });
  return fuori;
}

/* Tutte le etichette in uso, le piu' usate per prime: sono quelle che servono
 * come filtro e come suggerimento. */
export function tutteLeEtichette(schemi) {
  const conti = new Map();
  (Array.isArray(schemi) ? schemi : []).forEach(s => {
    etichetteUniche(s && s.labels).forEach(e => {
      const k = e.toLowerCase();
      const c = conti.get(k) || { nome: e, n: 0 };
      c.n += 1;
      conti.set(k, c);
    });
  });
  return [...conti.values()]
    .sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome, 'it'))
    .map(c => ({ nome: c.nome, n: c.n }));
}

/* Il filtro restringe: scegliendone due si vedono gli schemi che le hanno
 * TUTTE E DUE. Con «attacco» e «rimessa» si cerca la rimessa d'attacco, non
 * tutto l'attacco e tutte le rimesse. */
export function filtraSchemi(schemi, selezionate = [], ricerca = '') {
  const cerca = testo(ricerca).trim().toLowerCase();
  const richieste = selezionate.map(e => pulisciEtichetta(e).toLowerCase()).filter(Boolean);
  return (Array.isArray(schemi) ? schemi : []).filter(s => {
    if (!s) return false;
    const sue = etichetteUniche(s.labels).map(e => e.toLowerCase());
    if (!richieste.every(r => sue.includes(r))) return false;
    if (cerca && testo(s.title).toLowerCase().indexOf(cerca) < 0) return false;
    return true;
  });
}

export function ordinaSchemi(schemi) {
  return (Array.isArray(schemi) ? schemi.slice() : []).sort((a, b) =>
    testo(b.updated_at).localeCompare(testo(a.updated_at)));
}

export function riepilogo(schema) {
  const s = normalizzaSchema(schema);
  return { passi: s.steps.length, varianti: s.varianti.length };
}

/* Cosa manca perche' si possa pubblicare. Una lista vuota vuol dire «si può». */
export function problemiDiPubblicazione({ titolo, schema }) {
  const p = [];
  if (!testo(titolo).trim()) p.push('Dai un nome allo schema.');
  const s = normalizzaSchema(schema);
  if (s.steps.length === 0) p.push('Aggiungi almeno un passo: senza, gli atleti vedrebbero solo la posizione di partenza.');
  s.varianti.forEach(v => {
    if (v.steps.length === 0) p.push('La variante «' + v.nome + '» non ha nessun passo.');
  });
  return p;
}

/* -------------------------------------------------------------- modifiche */

/* Le modifiche dell'editor sono funzioni pure: prendono lo schema e ne
 * restituiscono uno nuovo. Così si possono provare, e l'editor non muta mai
 * il suo stato a metà. */

export function conPasso(steps, passo) {
  if (steps.length >= LIMITI.passi) return steps;
  return [...steps, normalizzaPasso(passo || {}, true)];
}

export function senzaPasso(steps, k) {
  return steps.filter((_, i) => i !== k);
}

export function spostaPasso(steps, da, a) {
  if (da === a || da < 0 || a < 0 || da >= steps.length || a >= steps.length) return steps;
  const copia = steps.slice();
  const [p] = copia.splice(da, 1);
  copia.splice(a, 0, p);
  return copia;
}

export function duplicaPasso(steps, k) {
  if (!steps[k] || steps.length >= LIMITI.passi) return steps;
  const copia = steps.slice();
  copia.splice(k + 1, 0, { ...steps[k], id: nuovoId('p'), moves: JSON.parse(JSON.stringify(steps[k].moves || {})) });
  return copia;
}

/* Trascinare un giocatore. Al passo -1 si sposta la posizione di partenza; da
 * un passo in poi si registra dove arriva. Se lo si riporta dov'era, il
 * movimento sparisce: non esistono spostamenti di zero centimetri. */
export function spostaGiocatore(start, steps, k, id, x, y) {
  const p = nelCampo({ x: arrotonda(x), y: arrotonda(y) });
  if (k < 0 || k >= steps.length) {
    if (!start.pos[id]) return { start, steps };
    return { start: { ...start, pos: { ...start.pos, [id]: p } }, steps };
  }
  const base = statoDopo(start, steps, k).pos[id];
  if (!base) return { start, steps };
  const passo = steps[k];
  const moves = { ...passo.moves };
  if (distanza(base, p) < SOGLIA_MOVIMENTO) {
    delete moves[id];
  } else {
    const prec = moves[id] || {};
    moves[id] = { x: p.x, y: p.y, tipo: prec.tipo || 'taglio', parte: prec.parte || 'subito' };
  }
  return { start, steps: steps.map((s, i) => (i === k ? { ...passo, moves } : s)) };
}

export function impostaMossa(steps, k, id, patch) {
  const passo = steps[k];
  if (!passo || !passo.moves || !passo.moves[id]) return steps;
  const m = { ...passo.moves[id] };
  if (patch.tipo && TIPI_MOSSA[patch.tipo]) m.tipo = patch.tipo;
  if (patch.parte && RITARDI[patch.parte] != null) m.parte = patch.parte;
  return steps.map((s, i) => (i === k ? { ...passo, moves: { ...passo.moves, [id]: m } } : s));
}

export function togliMossa(steps, k, id) {
  const passo = steps[k];
  if (!passo || !passo.moves || !passo.moves[id]) return steps;
  const moves = { ...passo.moves };
  delete moves[id];
  return steps.map((s, i) => (i === k ? { ...passo, moves } : s));
}

/* Chi ha la palla alla fine del passo `k`. Se e' la stessa mano di prima la
 * chiave sparisce: «non cambia» e «cambia in se' stesso» sono la stessa cosa. */
export function impostaPalla(start, steps, k, chi) {
  if (k < 0 || k >= steps.length) {
    return { start: { ...start, palla: chi }, steps };
  }
  const prima = statoDopo(start, steps, k).palla;
  const passo = { ...steps[k] };
  if (chi === prima) delete passo.palla;
  else passo.palla = chi;
  return { start, steps: steps.map((s, i) => (i === k ? passo : s)) };
}

export function impostaPasso(steps, k, patch) {
  const passo = steps[k];
  if (!passo) return steps;
  const nuovo = { ...passo };
  if (patch.dur && DURATE[patch.dur]) nuovo.dur = patch.dur;
  if (patch.ritardoPalla && RITARDI[patch.ritardoPalla] != null) nuovo.ritardoPalla = patch.ritardoPalla;
  if (typeof patch.nota === 'string') nuovo.nota = patch.nota.slice(0, LIMITI.nota);
  return steps.map((s, i) => (i === k ? nuovo : s));
}

/* Accendere la difesa la mette accanto a ciascuno; spegnerla toglie anche i
 * suoi movimenti da tutti i passi, base e varianti. */
export function conDifesa(schema) {
  if (haLaDifesa(schema)) return schema;
  const pos = { ...schema.start.pos };
  ID_ATTACCO.forEach((id, i) => { pos[ID_DIFESA[i]] = difensoreDi(pos[id]); });
  return { ...schema, start: { ...schema.start, pos } };
}

function senzaMosseDifesa(steps) {
  return steps.map(s => {
    const moves = {};
    Object.keys(s.moves || {}).forEach(id => { if (!ID_DIFESA.includes(id)) moves[id] = s.moves[id]; });
    return { ...s, moves };
  });
}

export function senzaDifesa(schema) {
  const pos = {};
  ID_ATTACCO.forEach(id => { pos[id] = schema.start.pos[id]; });
  return {
    ...schema,
    start: { ...schema.start, pos },
    steps: senzaMosseDifesa(schema.steps),
    varianti: schema.varianti.map(v => ({ ...v, steps: senzaMosseDifesa(v.steps) }))
  };
}

export function ciSonoMosseDifesa(schema) {
  const conta = (steps) => steps.some(s => Object.keys(s.moves || {}).some(id => ID_DIFESA.includes(id)));
  return conta(schema.steps) || schema.varianti.some(v => conta(v.steps));
}

export function conVariante(schema, nome = '') {
  if (schema.varianti.length >= LIMITI.varianti) return { schema, id: null };
  const id = nuovoId('v');
  const v = {
    id,
    nome: nome.trim().slice(0, 40) || 'Variante ' + (schema.varianti.length + 1),
    condizione: '',
    steps: []
  };
  return { schema: { ...schema, varianti: [...schema.varianti, v] }, id };
}

export function senzaVariante(schema, id) {
  return { ...schema, varianti: schema.varianti.filter(v => v.id !== id) };
}

export function aggiornaVariante(schema, id, patch) {
  return {
    ...schema,
    varianti: schema.varianti.map(v => {
      if (v.id !== id) return v;
      const n = { ...v };
      if (typeof patch.nome === 'string') n.nome = patch.nome.slice(0, 40);
      if (typeof patch.condizione === 'string') n.condizione = patch.condizione.slice(0, LIMITI.condizione);
      if (Array.isArray(patch.steps)) n.steps = patch.steps;
      return n;
    })
  };
}

/* La sequenza che si sta guardando: quella base, o quella di una variante. */
export function sequenza(schema, varianteId) {
  if (!varianteId) return schema.steps;
  const v = schema.varianti.find(x => x.id === varianteId);
  return v ? v.steps : schema.steps;
}

export function conSequenza(schema, varianteId, steps) {
  if (!varianteId) return { ...schema, steps };
  return aggiornaVariante(schema, varianteId, { steps });
}

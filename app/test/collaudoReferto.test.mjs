import { describe, test, is, ok, saltato } from './run.mjs';
import { tmpdir } from 'node:os';
import { mkdtempSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { applicaAzione } from '../src/utils/azione.js';
import { calcolaPunteggi } from '../src/utils/punteggio.js';
import { refertoPartita } from '../src/utils/referto.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

/* LA CATENA INTERA, FINO AL FOGLIO STAMPATO.
 *
 * Tutti gli altri collaudi provano un anello alla volta. Questo li mette in
 * fila: si gioca una partita azione per azione, si costruisce il referto, si
 * genera il PDF vero con jsPDF, e poi LO SI RILEGGE con pdf.js per guardare
 * cosa c'è scritto e dove.
 *
 * Serve perché i difetti del foglio stampato non si vedono da nessun'altra
 * parte. Lo spazio fra due celle allineate a destra in colonne vicine è
 * «larghezza della colonna meno larghezza del testo»: sotto i tre punti
 * tipografici si leggono attaccate, e nel tabellino di pallavolo si leggeva
 * «3 100% 100%» come se fosse una cella sola. Il compilatore non lo vede, i
 * test sui numeri non lo vedono, e a schermo non esiste. Si vede su carta,
 * cioè quando non c'è più niente da fare.
 *
 * I due sport si controllano separatamente: hanno colonne, sezioni e larghezze
 * diverse, e un difetto del foglio si presenta quasi sempre in uno solo dei due.
 */

// jsPDF in Node chiede `atob`/`btoa`, che su Node 14 non ci sono.
if (typeof globalThis.atob !== 'function') {
  globalThis.atob = (x) => Buffer.from(x, 'base64').toString('binary');
}
if (typeof globalThis.btoa !== 'function') {
  globalThis.btoa = (x) => Buffer.from(x, 'binary').toString('base64');
}

const RESPIRO_MINIMO = 3;   // punti tipografici di bianco fra due celle

function dado(seme) {
  let x = seme;
  return (n) => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x % n; };
}

function partitaGiocata(sport, quanti, periodi, azioniPerPeriodo) {
  const nomi = ['Alessandra Castrogiovanni', 'Bea Lo Giudice', 'Carla Fanti',
    'Dora Abbagnale', 'Elsa Musumeci', 'Fara Privitera', 'Gaia Scalia',
    'Ilde Consoli', 'Lia Pappalardo', 'Mia Di Bella', 'Noa Cavallaro',
    'Ora Fichera', 'Pia Grasso', 'Rita Russo'];
  const g = {
    id: 'g1', sectorId: 's1', oppName: 'Giardini Naxos', status: 'finished',
    date: '2026-10-01', quarter: 1, chiusi: 0,
    numQuarters: periodi, periodScores: [], storia: [], quarterFouls: {},
    quintetti: {}, turno: null,
    players: nomi.slice(0, quanti).map((name, i) => ({
      id: 'p' + i, number: String(i + 4), name,
      onCourt: i < (sport === PALLAVOLO ? 6 : 5),
      stats: sport.newStats()
    }))
  };

  const tira = dado(4242);
  const azioni = [];
  (sport.scout.groups || []).forEach(gr => (gr.actions || []).forEach(a => azioni.push(a)));

  for (let q = 1; q <= periodi; q++) {
    for (let i = 0; i < azioniPerPeriodo; i++) {
      const campo = g.players.filter(p => p.onCourt);
      const a = azioni[tira(azioni.length)];
      // Un tiro su due porta la sua posizione: è il caso che disegna la mappa.
      const punto = (a.zona && i % 2 === 0) ? { x: 5 + tira(90), y: 5 + tira(90) } : null;
      applicaAzione({ g, sport, giocatore: campo[tira(campo.length)], azione: a, punto });
    }
    // Gli avversari hanno segnato anche loro, e a fine periodo si allinea il
    // punteggio a quello del tabellone della palestra.
    const riga = g.periodScores[q - 1] || { us: 0, them: 0 };
    const loro = (riga.them || 0) + 11 + q;
    g.storia.push({ q, a: 'loro', n: loro - (riga.them || 0) });
    g.periodScores[q - 1] = { ...riga, them: loro };
    // Chi era in campo ha giocato questo periodo.
    g.players.forEach(p => { if (p.onCourt) p.stats.setsPlayed = (p.stats.setsPlayed || 0) + 1; });
    g.chiusi = q;
    if (q < periodi) g.quarter = q + 1;
  }
  calcolaPunteggi(g, sport);
  return g;
}

/* Legge un PDF e restituisce, pagina per pagina, i pezzi di testo con la loro
 * posizione. È l'unico modo di guardare un foglio stampato senza aprirlo. */
async function leggi(pdfjs, percorso) {
  const doc = await pdfjs.getDocument({ url: percorso, disableFontFace: true }).promise;
  const pagine = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const vp = pagina.getViewport({ scale: 1 });
    const tc = await pagina.getTextContent();
    pagine.push(tc.items
      .map(i => ({ t: i.str, x: i.transform[4], y: vp.height - i.transform[5], w: i.width }))
      .filter(v => v.t.trim() !== ''));
  }
  // Si chiude: su Windows un documento aperto tiene il file, e la cartella
  // temporanea non si riesce piu` a buttare via.
  try { await doc.destroy(); } catch (e) { /* niente */ }
  return pagine;
}

// I pezzi di testo raggruppati per riga, ordinati da sinistra a destra.
function righeDi(voci) {
  const per = new Map();
  voci.forEach(v => {
    const k = Math.round(v.y / 2);
    if (!per.has(k)) per.set(k, []);
    per.get(k).push(v);
  });
  return Array.from(per.values()).map(r => r.sort((a, b) => a.x - b.x));
}

const CASI = [
  ['basket', BASKET, 13, 4, 55],
  ['pallavolo', PALLAVOLO, 14, 5, 60]
];

/* IL CASO PEGGIORE, COSTRUITO A MANO.
 *
 * Una partita simulata a caso non produce le celle piu` larghe, e sono quelle
 * che rompono il foglio. Le larghe sono due: le percentuali a tre cifre — «100%»
 * — e le frazioni del basket con i tentativi a due cifre, «10/10 (100%)».
 *
 * Nel tabellino di pallavolo la colonna e` larga nove millimetri e «100%» a
 * otto punti e mezzo ne occupa sette e sei: restava un millimetro e mezzo, meno
 * di uno spazio, e si leggeva «3 100% 100%» come una cella sola. Perche` il
 * collaudo lo prenda, quel caso va messo dentro di proposito: qui una
 * giocatrice ha il cento per cento in OGNI colonna in percentuale, e il nome
 * piu` lungo che una rosa vera possa avere.
 */
function peggiorCaso(g, sport) {
  const p = g.players[0];
  p.name = 'Maria Vittoria Castrogiovanni';   // lungo quanto capita davvero
  p.number = '100';                           // tre cifre: esiste, ed e` larga
  if (sport === PALLAVOLO) {
    Object.assign(p.stats, {
      points: 100, kills: 100, attacks: 100, attackErrors: 0,     // EFF 100%
      digs: 100, digNeg: 0, digErrors: 0,                          // DIF% 100%
      recPerf: 100, recPos: 0, recNeg: 0, receptionErrors: 0,      // RIC 100%
      blocks: 100, aces: 100, assists: 100, attackBlocked: 100,
      serveErrors: 100, setsPlayed: 100
    });
  } else {
    Object.assign(p.stats, {
      fgm2: 100, fga2: 100, fgm3: 100, fga3: 100, ftm: 100, fta: 100,  // 100/100 (100%)
      orb: 100, drb: 100, ast: 100, stl: 100, blk: 100, tov: 100, pf: 100,
      plusMinus: -100                                               // col segno, e largo
    });
  }
  calcolaPunteggi(g, sport);
  return g;
}

// I caratteri che il carattere del PDF non sa disegnare escono come segni a
// caso: il meno tipografico usciva come una virgoletta, e il numero accanto
// diventava illeggibile.
const SEGNI_A_CASO = /[\u0000-\u0008\u000b-\u001f�]/g;

describe('il referto in PDF, generato e riletto', () => {
  /* TUTTI GLI SPORT IN UN TEST SOLO, E IN FILA.
   *
   * `doc.save()` scrive nella cartella corrente del processo, che è una cosa
   * sola per tutti: due test che la cambiano insieme se la portano via a
   * vicenda. Quindi si generano e si rileggono uno dopo l'altro, dentro un
   * `chdir` solo, e si riporta in fondo tutto quello che non va — perché
   * sapere che tre cose sono rotte vale più che scoprirne una alla volta.
   */
  test('il PDF si genera e si rilegge, per ogni sport', async () => {
    let pdfjs;
    try {
      await import('jspdf');
      const m = await import('pdfjs-dist/legacy/build/pdf.js');
      // Il pacchetto è in CommonJS: da un `import()` arriva sotto `default`.
      pdfjs = (m && typeof m.getDocument === 'function') ? m : m.default;
      if (!pdfjs || typeof pdfjs.getDocument !== 'function') throw new Error('pdf.js senza getDocument');
    } catch (e) {
      saltato('il PDF si genera e si rilegge', 'jsPDF o pdf.js non disponibili: ' + e.message);
      return;
    }

    const { generaRefertoPdf } = await import('../src/utils/refertoPdf.js');
    const guai = [];
    const prima = process.cwd();
    const cartella = mkdtempSync(join(tmpdir(), 'squad-collaudo-'));

    try {
      process.chdir(cartella);

      // In coda ai due sport, la partita senza nemmeno un tocco: una gara
      // rinviata al primo quarto esiste, e il suo referto va prodotto comunque.
      const prove = CASI.concat([
        ['senza un tocco', BASKET, 8, 1, 0],
        // Il caso peggiore per l'impaginazione, per tutti e due gli sport.
        ['caso peggiore basket', BASKET, 13, 4, 55, true],
        ['caso peggiore pallavolo', PALLAVOLO, 14, 5, 60, true]
      ]);

      for (const [nome, sport, quanti, periodi, azioni, peggio] of prove) {
        const g = partitaGiocata(sport, quanti, periodi, azioni);
        if (peggio) peggiorCaso(g, sport);
        const segna = (t) => guai.push(nome + ' -> ' + t);

        /* Ogni prova ha il suo avversario, e quindi il suo nome di file: il
         * nome lo decide il referto da squadra e avversario, e tre prove con
         * la stessa squadra si sovrascriverebbero a vicenda. Cancellarli fra
         * una prova e l'altra non si puo`: su Windows pdf.js tiene il file
         * aperto. */
        g.oppName = 'Giardini Naxos ' + nome.replace(/[^a-zA-Z]/g, '');
        try {
          await generaRefertoPdf({
            team: { name: 'Cestistica Etnea', city: 'Catania', logo_url: null },
            game: g, sport, sectorName: 'Under 19'
          });
        } catch (e) {
          segna('il referto non si genera: ' + e.message);
          continue;
        }
        const atteso = 'referto_Cestistica_Etnea_' + g.oppName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
        const nuovi = readdirSync(cartella).filter(f => f === atteso);
        if (nuovi.length !== 1) { segna('file prodotti: ' + nuovi.length); continue; }

        const pagine = await leggi(pdfjs, join(cartella, nuovi[0]));
        if (!pagine.length || pagine.length > 4) segna('venuto di ' + pagine.length + ' pagine');

        // IL CONTROLLO CHE CONTA: niente si accavalla.
        pagine.forEach((voci, i) => {
          righeDi(voci).forEach(r => {
            for (let k = 1; k < r.length; k++) {
              const gap = r[k].x - (r[k - 1].x + r[k - 1].w);
              if (gap < RESPIRO_MINIMO) {
                segna('accavallate a p' + (i + 1) + ': "' + r[k - 1].t + '" | "'
                  + r[k].t + '" a ' + gap.toFixed(1) + 'pt');
              }
            }
          });
        });

        const tutto = pagine.map(v => v.map(x => x.t).join(' ')).join(' ');

        const sospetti = tutto.match(SEGNI_A_CASO);
        if (sospetti) segna('caratteri che il carattere non conosce: ' + JSON.stringify(sospetti));

        if (!/Cestistica Etnea/.test(tutto)) segna('manca il nome della squadra');
        if (!/Giardini Naxos/.test(tutto)) segna('manca l’avversario');
        if (!/Il tabellino/.test(tutto)) segna('manca il tabellino');

        const mancanti = g.players.map(p => p.name.split(' ')[0]).filter(n => !tutto.includes(n));
        if (mancanti.length) segna('sul foglio non compaiono: ' + mancanti.join(', '));
        // Nel caso peggiore: il cento per cento c'e` scritto, e non tagliato.
        if (peggio && !/100%/.test(tutto)) segna('il 100% non compare sul foglio');
      }
    } finally {
      process.chdir(prima);
      try { rmSync(cartella, { recursive: true, force: true }); } catch (e) { /* niente */ }
    }

    ok(guai.length === 0, guai.slice(0, 8).join(' // ')
      + (guai.length > 8 ? ' // (e altri ' + (guai.length - 8) + ')' : ''));
  });

  CASI.forEach(([nome, sport, quanti, periodi, azioni]) => {
    test(nome + ': i numeri sul foglio sono quelli della partita', () => {
      const g = partitaGiocata(sport, quanti, periodi, azioni);
      const r = refertoPartita(g, sport);
      ok(r, 'nessun referto');

      // Il punteggio del referto e quello della partita sono lo stesso.
      const nostri = g.periodScores.reduce((n, x) => n + ((x && x.us) || 0), 0);
      const loro = g.periodScores.reduce((n, x) => n + ((x && x.them) || 0), 0);
      is(r.andamento.ricostruito.us, nostri);
      is(r.andamento.ricostruito.them, loro);

      /* Le ciambelle: la percentuale dentro l'anello deve essere il numeratore
       * diviso il totale. Se non lo è, il foglio dice due cose diverse nello
       * stesso posto — ed è quello che faceva, sotto l'anello del servizio. */
      (r.ciambelle || []).forEach(v => {
        if (!v.tot || v.pct == null) return;
        const num = v.v != null ? v.v : v.righe[0][0];
        is(Math.round((num / v.tot) * 100), v.pct,
          v.etichetta + ': anello al ' + v.pct + '% e sotto ' + num + '/' + v.tot);
      });

      /* Ogni periodo giocato ha le sue statistiche. È il difetto dei primi set
       * vuoti: il referto usciva, e le grafiche a cerchio dei primi due set
       * erano vuote perché il registro non le ritrovava più. */
      const vuoti = (r.ciambellePeriodi || [])
        .map((p, i) => [i + 1, p])
        .filter(([, p]) => !p || !p.some(v => v && v.tot > 0))
        .map(([i]) => i);
      is(vuoti.length, 0, 'periodi senza statistiche nel referto: ' + vuoti.join(', '));
    });
  });
});

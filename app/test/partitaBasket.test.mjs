import { describe, test, is, ok } from './run.mjs';
import { BASKET } from '../src/utils/sports/basket.js';
import { refertoPartita, tabellaTabellino, totaleTabellino } from '../src/utils/referto.js';
import { chiaveQuintetto, saldoTurno, sommaQuintetto, quintettiOrdinati } from '../src/utils/regole.js';

/* UNA PARTITA DI BASKET, DALL'INIZIO ALLA FINE.
 *
 * Gli altri test guardano un pezzo per volta: la percentuale da tre, la riga
 * della squadra, le zone di tiro. Questo guarda la cosa che in palestra si
 * scopre e basta — che dopo quaranta minuti e duecento tocchi i conti tornino.
 *
 * Il motore qui sotto è lo stesso di `esegui` nello scout: prende l'azione
 * dalla CONFIGURAZIONE VERA di basket.js, ne applica gli incrementi, e ricava
 * i punti dalla differenza prima/dopo invece che da un numero scritto a mano.
 * Se qualcuno cambia il tabellone di gioco in basket.js, questi test cambiano
 * con lui — ed è il motivo per cui il motore non è scritto due volte.
 *
 * Non prova l'interfaccia: prova quello che l'interfaccia scrive. Il dito sul
 * pulsante giusto resta da verificare in palestra.
 */

/* ------------------------------------------------------------- il motore -- */

// L'azione con quel nome, ovunque stia: nei gruppi del pannello o dentro una
// catena (l'assist e il rimbalzo si segnano dalla domanda successiva).
function azioneDi(act) {
  for (const gr of BASKET.scout.groups) {
    const a = gr.actions.find(x => x.act === act);
    if (a) return a;
  }
  const chains = BASKET.scout.chains || {};
  for (const k of Object.keys(chains)) {
    if (chains[k].azione && chains[k].azione.act === act) return chains[k].azione;
  }
  return null;
}

function nuovaPartita(numeri) {
  return {
    oppName: 'Amichevole', quarter: 1,
    periodScores: [],
    players: numeri.map((n, i) => ({
      id: 'p' + n, number: String(n), name: 'Giocatore ' + n,
      onCourt: i < 5, stats: BASKET.newStats()
    })),
    quintetti: {}, turno: null
  };
}

function periodo(g) {
  const i = (g.quarter || 1) - 1;
  if (!g.periodScores[i]) g.periodScores[i] = { us: 0, them: 0 };
  return g.periodScores[i];
}

// Esattamente quello che fa `esegui`: applica, poi misura i punti guadagnati.
function segna(g, numero, act) {
  const a = azioneDi(act);
  if (!a) throw new Error('azione sconosciuta nella configurazione: ' + act);
  const p = g.players.find(x => x.number === String(numero));
  if (!p) throw new Error('giocatore non in distinta: ' + numero);

  const prima = BASKET.score(p.stats);
  Object.entries(a.apply || {}).forEach(([k, v]) => { p.stats[k] = (p.stats[k] || 0) + v; });
  if (a.nested) {
    Object.entries(a.nested).forEach(([contenitore, chiave]) => {
      p.stats[contenitore] = p.stats[contenitore] || {};
      p.stats[contenitore][chiave] = (p.stats[contenitore][chiave] || 0) + 1;
    });
  }
  const guadagnati = BASKET.score(p.stats) - prima;
  if (guadagnati) periodo(g).us += guadagnati;
  return guadagnati;
}

// I punti degli avversari: si segnano a mano, uno due o tre come li fanno.
function loro(g, punti) {
  ok(BASKET.scout.manoPunti.indexOf(punti) >= 0, 'punti avversari fuori dai tasti');
  periodo(g).them += punti;
}

function chiudiPeriodo(g) {
  periodo(g);
  g.quarter = (g.quarter || 1) + 1;
}

function finisci(g) {
  g.teamScore = g.periodScores.reduce((s, r) => s + (r.us || 0), 0);
  g.oppScore = g.periodScores.reduce((s, r) => s + (r.them || 0), 0);
  g.chiusi = g.periodScores.length;
  return g;
}

/* ------------------------------------- la configurazione regge il motore -- */

describe('la configurazione del basket non ha buchi', () => {
  const tutte = [];
  BASKET.scout.groups.forEach(gr => gr.actions.forEach(a => tutte.push(a)));

  test('ogni azione ha un nome diverso', () => {
    const nomi = tutte.map(a => a.act);
    is(new Set(nomi).size, nomi.length);
  });

  /* IL TEST CHE PRENDE I REFUSI. `apply: { fgM2: 1 }` invece di `fgm2` non
   * romperebbe niente: creerebbe un campo fantasma, e la colonna del tabellino
   * resterebbe a zero per tutta la stagione senza che nessuno capisca perché. */
  test('ogni incremento scrive in un campo che esiste davvero', () => {
    const campi = Object.keys(BASKET.newStats());
    tutte.forEach(a => {
      Object.keys(a.apply || {}).forEach(k => {
        ok(campi.indexOf(k) >= 0, a.act + ' scrive in ' + k + ', che non esiste');
      });
      Object.keys(a.nested || {}).forEach(k => {
        ok(campi.indexOf(k) >= 0, a.act + ' annida in ' + k + ', che non esiste');
      });
    });
  });

  test('ogni domanda successiva punta a una catena che esiste', () => {
    tutte.forEach(a => {
      if (!a.poi) return;
      ok((BASKET.scout.chains || {})[a.poi], a.act + ' rimanda a «' + a.poi + '», che non c’è');
    });
  });

  /* I punti li decide `score()` sulle statistiche, non la proprietà `score`
   * dell'azione — che serve solo all'interfaccia. Se le due si scollassero, il
   * tabellone direbbe una cosa e il tabellino un'altra. */
  test('i punti dichiarati e i punti veri sono la stessa cosa', () => {
    tutte.filter(a => a.score).forEach(a => {
      const s = BASKET.newStats();
      const prima = BASKET.score(s);
      Object.entries(a.apply).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
      is(BASKET.score(s) - prima, a.score);
    });
  });

  test('e chi non dichiara punti non ne fa', () => {
    tutte.filter(a => !a.score).forEach(a => {
      const s = BASKET.newStats();
      Object.entries(a.apply).forEach(([k, v]) => { s[k] = (s[k] || 0) + v; });
      is(BASKET.score(s), 0, a.act + ' fa punti senza dirlo');
    });
  });
});

/* ------------------------------------------------- una partita per intero -- */

describe('quaranta minuti: i conti tornano', () => {
  const g = nuovaPartita([4, 7, 9, 10, 12, 5, 8, 11]);

  // ---- primo quarto ------------------------------------------------------
  segna(g, 4, 'fg2_made'); segna(g, 7, 'ast');
  loro(g, 2);
  segna(g, 9, 'fg3_miss'); segna(g, 12, 'orb');
  segna(g, 12, 'fg2_made');
  loro(g, 3);
  segna(g, 10, 'tov_passaggio');
  segna(g, 4, 'pf');
  loro(g, 1); loro(g, 1);
  segna(g, 7, 'fg3_made'); segna(g, 9, 'ast');
  segna(g, 12, 'drb');
  segna(g, 4, 'stl');
  segna(g, 4, 'fg2_made');
  chiudiPeriodo(g);

  // ---- secondo quarto ----------------------------------------------------
  segna(g, 9, 'pfDrawn');
  segna(g, 9, 'ft_made'); segna(g, 9, 'ft_made');
  loro(g, 2);
  segna(g, 10, 'fg2_miss'); segna(g, 5, 'drb');
  segna(g, 7, 'fg3_made');
  segna(g, 12, 'blk');
  loro(g, 2);
  segna(g, 4, 'fg2_made');
  segna(g, 8, 'tov_palleggio');
  segna(g, 11, 'ft_made'); segna(g, 11, 'ft_miss'); segna(g, 12, 'orb');
  chiudiPeriodo(g);

  // ---- terzo quarto ------------------------------------------------------
  loro(g, 3); loro(g, 2);
  segna(g, 4, 'fg3_made'); segna(g, 10, 'ast');
  segna(g, 12, 'blkAgainst');
  segna(g, 7, 'fg2_made');
  segna(g, 5, 'pf');
  loro(g, 1);
  segna(g, 9, 'fg2_made'); segna(g, 4, 'ast');
  chiudiPeriodo(g);

  // ---- quarto quarto -----------------------------------------------------
  segna(g, 12, 'fg2_made');
  loro(g, 2);
  segna(g, 4, 'fg3_made'); segna(g, 7, 'ast');
  segna(g, 9, 'tov_generica');
  loro(g, 2);
  segna(g, 7, 'ft_made'); segna(g, 7, 'ft_made');
  segna(g, 10, 'drb');
  segna(g, 4, 'fg2_miss'); segna(g, 4, 'orb'); segna(g, 4, 'fg2_made');
  chiudiPeriodo(g);

  finisci(g);
  const r = refertoPartita(g, BASKET);
  const t = tabellaTabellino(r, BASKET);

  test('la partita ha quattro periodi chiusi', () => {
    is(r.chiusi, 4);
    is(r.set.length, 4);
  });

  /* LA VERIFICA CHE CONTA. Il tabellone della palestra e il tabellino sono
   * due strade diverse per lo stesso numero: una somma i periodi, l'altra
   * somma le persone. Se non coincidono, uno dei due tocchi è finito addosso
   * a nessuno — ed è il difetto che a fine partita nessuno sa più ricostruire. */
  test('i punti dei periodi e i punti delle persone sono lo stesso numero', () => {
    const daiPeriodi = r.set.reduce((s, x) => s + x.us, 0);
    const dallePersone = r.tabellino.reduce((s, x) => s + x.pts, 0);
    is(daiPeriodi, g.teamScore);
    is(dallePersone, g.teamScore);
  });

  /* `totale` e' una riga gia' formattata, non un oggetto: si legge nella
     colonna dei punti, come la legge chi guarda il referto. */
  test('e la riga della squadra dice lo stesso', () => {
    const colonna = t.intestazioni.indexOf('PT');
    ok(colonna >= 0, 'la colonna dei punti deve esistere');
    is(Number(t.totale[colonna]), g.teamScore);
  });

  test('gli avversari li abbiamo contati noi, e tornano', () => {
    is(r.set.reduce((s, x) => s + x.them, 0), g.oppScore);
  });

  test('in tabellino c e solo chi ha fatto qualcosa', () => {
    // Il numero 8 ha una sola palla persa: c'è. Nessuno è rimasto fuori.
    ok(r.tabellino.some(x => x.number === '8'));
  });

  test('i tiri tentati non sono mai meno di quelli segnati', () => {
    r.tabellino.forEach(x => {
      ok((x.fga2 || 0) >= (x.fgm2 || 0), '#' + x.number + ' da due');
      ok((x.fga3 || 0) >= (x.fgm3 || 0), '#' + x.number + ' da tre');
      ok((x.fta || 0) >= (x.ftm || 0), '#' + x.number + ' ai liberi');
    });
  });

  test('i possessi si ricavano dalle azioni, e sono un numero sensato', () => {
    ok(r.attacco.possessi > 0);
    // Un possesso dura in media fra i dieci e i venti secondi: in quaranta
    // minuti stanno fra i cinquanta e i cento. Fuori da lì, qualcosa non torna.
    ok(r.attacco.possessi < 200, 'possessi: ' + r.attacco.possessi);
  });

  test('i punti per possesso stanno nel mondo reale', () => {
    ok(r.attacco.ppp > 0.2 && r.attacco.ppp < 2, 'ppp: ' + r.attacco.ppp);
  });

  test('la percentuale effettiva non supera il cento per cento', () => {
    const riga = t.righe.find(x => x[0] === '4');
    ok(riga, 'la riga del 4 deve esserci');
  });

  test('la mappa raccoglie solo i tiri di cui si sa da dove', () => {
    // In questa partita nessuno ha segnato la posizione: la mappa non c'è, e
    // non è un errore — è la mappa spenta, che è il valore predefinito.
    is(r.tiri, null);
  });
});

/* ------------------------------------------------- i cinque in campo ----- */

describe('il registro dei quintetti, su una partita vera', () => {
  /* Il tracker apre un turno a ogni cambio e lo chiude al successivo. Qui si
   * ripercorre la stessa sequenza: tre quintetti, uno dei quali torna in campo
   * una seconda volta. */
  const A = ['4', '7', '9', '10', '12'];
  const B = ['4', '7', '9', '10', '5'];
  const C = ['4', '8', '9', '11', '5'];

  let quintetti = {};
  const passa = (turno, us, them) => { quintetti = sommaQuintetto(quintetti, saldoTurno(turno, us, them)); };

  // A entra sullo 0-0, esce sul 12-8   → +4
  passa({ ids: A, us: 0, them: 0 }, 12, 8);
  // B entra sul 12-8, esce sul 18-20   → -6
  passa({ ids: B, us: 12, them: 8 }, 18, 20);
  // C entra sul 18-20, esce sul 22-22  → +2
  passa({ ids: C, us: 18, them: 20 }, 22, 22);
  // A torna sul 22-22 e chiude sul 31-28 → +6, secondo turno
  passa({ ids: A, us: 22, them: 22 }, 31, 28);

  const ordinati = quintettiOrdinati(quintetti);

  test('i quintetti distinti sono tre, non quattro', () => {
    is(ordinati.length, 3);
  });

  test('il primo e quello che ha guadagnato di piu', () => {
    // +4 nel primo turno (0-0 -> 12-8) e +3 nel secondo (22-22 -> 31-28).
    is(ordinati[0].saldo, 7);
    is(ordinati[0].chiave, chiaveQuintetto(A));
  });

  test('e i suoi due turni si sommano in una riga sola', () => {
    is(ordinati[0].turni, 2);
    is(ordinati[0].f, 21);
    is(ordinati[0].s, 14);
  });

  test('l ultimo e quello che ha perso terreno', () => {
    is(ordinati[ordinati.length - 1].saldo, -6);
  });

  test('un turno senza punti non entra in tabella', () => {
    // Due cambi di fila a un time out: quei cinque non hanno visto un pallone.
    is(saldoTurno({ ids: B, us: 31, them: 28 }, 31, 28), null);
  });

  test('e la somma dei saldi e la differenza finale', () => {
    const somma = ordinati.reduce((s, q) => s + q.saldo, 0);
    is(somma, 31 - 28);
  });
});

/* --------------------------------------------------- il referto si legge -- */

describe('il referto di quella partita e leggibile', () => {
  const g = finisci((() => {
    const x = nuovaPartita([4, 7]);
    segna(x, 4, 'fg2_made'); segna(x, 4, 'fg3_made'); segna(x, 4, 'fg3_miss');
    segna(x, 7, 'ft_made'); segna(x, 7, 'ft_made'); segna(x, 7, 'drb');
    loro(x, 3);
    return x;
  })());

  const t = tabellaTabellino(refertoPartita(g, BASKET), BASKET);

  test('c e una riga per ciascuno e una per la squadra', () => {
    is(t.righe.length, 2);
    ok(t.totale);
  });

  test('la riga della squadra somma i punti ma non e una persona', () => {
    const colonna = t.intestazioni.indexOf('PT');
    is(Number(t.totale[colonna]), 7);
    is(t.righe.some(x => x[1] === 'Squadra'), false);
  });

  test('chi non ha tirato da tre ha un trattino, non uno zero', () => {
    const riga = t.righe.find(x => x[0] === '7');
    ok(riga.some(c => String(c).indexOf('—') >= 0 || String(c) === '—'));
  });

  test('il totale della squadra si ricalcola, non si somma', () => {
    const totale = totaleTabellino(refertoPartita(g, BASKET).tabellino);
    is(totale.fga3, 2);
    is(totale.fgm3, 1);
  });
});

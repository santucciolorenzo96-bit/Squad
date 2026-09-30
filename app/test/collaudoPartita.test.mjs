import { describe, test, is, ok } from './run.mjs';
import { applicaAzione, annota, segnaPeriodo } from '../src/utils/azione.js';
import { calcolaPunteggi } from '../src/utils/punteggio.js';
import {
  refertoPartita, statistichePerPeriodo, andamentoPartita, azioneDi, tabellaTabellino
} from '../src/utils/referto.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { CALCIO } from '../src/utils/sports/calcio.js';

/* IL COLLAUDO DELLA PARTITA.
 *
 * Qui si giocano partite intere, azione per azione, chiamando la STESSA
 * funzione che chiama lo scout quando qualcuno tocca un pulsante. È il motivo
 * per cui quel pezzo è uscito dal componente: un collaudo che imitasse quelle
 * venticinque righe proverebbe la propria imitazione.
 *
 * Quello che si controlla non sono i numeri di una partita in particolare: sono
 * le COSE CHE DEVONO VALERE SEMPRE. Il punteggio sul tabellone deve essere la
 * somma dei punti del tabellino. Le statistiche periodo per periodo, sommate,
 * devono fare i totali di squadra — e quello lega il registro delle azioni alle
 * statistiche dei giocatori, che sono due strade diverse per lo stesso dato. Il
 * punteggio ricostruito dal registro deve essere quello vero.
 *
 * Se una di queste si rompe, il referto di fine partita racconta una partita
 * che non è stata giocata. Ed è il genere di cosa che non si nota durante: si
 * nota sul foglio, quando non c'è più niente da fare.
 *
 * I numeri casuali hanno un seme fisso: una partita che fa cadere un test si
 * può rigiocare identica.
 */

// Un generatore ripetibile. Una partita che rompe qualcosa si deve poter
// rigiocare uguale, altrimenti il guasto non si studia.
function dado(seme) {
  let x = seme;
  return (n) => {
    x = (x * 1103515245 + 12345) & 0x7fffffff;
    return x % n;
  };
}

function rosa(sport, quanti) {
  const nomi = ['Anna Ricci', 'Bea Lo Giudice', 'Carla Fanti', 'Dora Abbagnale',
    'Elsa Musumeci', 'Fara Privitera', 'Gaia Scalia', 'Ilde Consoli',
    'Lia Pappalardo', 'Mia Di Bella', 'Noa Cavallaro', 'Ora Fichera',
    'Pia Grasso', 'Rita Russo'];
  return nomi.slice(0, quanti).map((name, i) => ({
    id: 'p' + i, number: String(i + 4), name,
    onCourt: i < (sport === PALLAVOLO ? 6 : 5),
    stats: sport.newStats()
  }));
}

function nuovaPartita(sport, quanti = 12) {
  const g = {
    id: 'g1', sectorId: 's1', oppName: 'Avversari', status: 'live',
    quarter: 1, chiusi: 0, numQuarters: sport.scout.period.count || 4,
    periodScores: [], players: rosa(sport, quanti), storia: [],
    quarterFouls: {}, quintetti: {}, turno: null, revisione: 0
  };
  calcolaPunteggi(g, sport);
  return g;
}

// Tutte le azioni toccabili dai pulsanti, in un elenco piatto.
function azioniDaPulsante(sport) {
  const fuori = [];
  (sport.scout.groups || []).forEach(gr => (gr.actions || []).forEach(a => fuori.push(a)));
  return fuori;
}

// Chiude il periodo come lo chiude lo scout: si annota la differenza fra il
// punteggio vero degli avversari e quello segnato, si conta il periodo, si
// passa al successivo.
function chiudiPeriodo(g, sport, puntiLoro) {
  const idx = (g.quarter || 1) - 1;
  const riga = g.periodScores[idx] || { us: 0, them: 0 };
  if (puntiLoro != null && puntiLoro !== (riga.them || 0)) {
    annota(g, { a: 'loro', n: puntiLoro - (riga.them || 0) });
    g.periodScores[idx] = { ...riga, them: puntiLoro };
  }
  g.chiusi = Math.max(g.chiusi || 0, idx + 1);
  g.quarter = (g.quarter || 1) + 1;
  if (g.quarter > g.numQuarters) g.numQuarters = g.quarter;
  calcolaPunteggi(g, sport);
}

/* Gioca `quante` azioni scegliendole fra quelle dei pulsanti, su giocatori in
 * campo, e restituisce il conto di quello che ha fatto. */
function gioca(g, sport, quante, seme) {
  const tira = dado(seme);
  const azioni = azioniDaPulsante(sport);
  const conto = { applicate: 0, puntiLoroDaErrori: 0 };
  for (let i = 0; i < quante; i++) {
    const inCampo = g.players.filter(p => p.onCourt);
    const chi = inCampo[tira(inCampo.length)];
    const a = azioni[tira(azioni.length)];
    // Con la mappa dei tiri accesa, un tiro su tre porta la sua posizione:
    // è il caso che nel referto disegna la mappa.
    const punto = (a.zona && i % 3 === 0) ? { x: 10 + tira(80), y: 5 + tira(90) } : null;
    applicaAzione({ g, sport, giocatore: chi, azione: a, punto });
    conto.applicate += 1;
    if (a.puntoLoro) conto.puntiLoroDaErrori += 1;
  }
  return conto;
}

const SPORT = [['basket', BASKET], ['pallavolo', PALLAVOLO], ['calcio', CALCIO]];

/* ======================================================================== */
/* OGNI SINGOLA AZIONE, UNA PER UNA                                         */
/* ======================================================================== */

describe('ogni pulsante dello scout fa quello che dice', () => {
  SPORT.forEach(([nome, sport]) => {
    test(nome + ': ogni azione si applica senza far cadere niente', () => {
      /* Esaustivo di proposito. Un pulsante che non viene mai premuto in un
       * test è un pulsante che viene premuto per la prima volta in partita. */
      const guai = [];
      azioniDaPulsante(sport).forEach(a => {
        try {
          const g = nuovaPartita(sport);
          const chi = g.players[0];
          applicaAzione({ g, sport, giocatore: chi, azione: a });
          // Quello che l'azione dichiara di scrivere, l'ha scritto.
          Object.entries(a.apply || {}).forEach(([k, v]) => {
            if ((chi.stats[k] || 0) !== v) guai.push(a.act + ': «' + k + '» vale ' + chi.stats[k] + ' invece di ' + v);
          });
          // E c'è una riga nel registro, con il nome giusto e il periodo giusto.
          const ultima = g.storia.find(x => x.a === a.act);
          if (!ultima) guai.push(a.act + ' non è finita nel registro');
          else if (ultima.q !== 1) guai.push(a.act + ' annotata nel periodo ' + ultima.q);
        } catch (e) {
          guai.push(a.act + ' ha fatto cadere tutto: ' + e.message);
        }
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': la stessa azione due volte conta due volte', () => {
      /* SOMMARE, NON SCRIVERE.
       *
       * Un contatore che al posto di `+= 1` facesse `= 1` si fermerebbe a uno
       * e nessuno lo noterebbe: il primo tocco funziona, e il tabellino dice
       * «1 palla persa di palleggio» in una partita che ne ha viste sei. Vale
       * per le statistiche e vale per i contenitori dentro le statistiche —
       * i tipi di palla persa del basket sono l'unico posto dove si annida. */
      const guai = [];
      azioniDaPulsante(sport).forEach(a => {
        const g = nuovaPartita(sport);
        const chi = g.players[0];
        applicaAzione({ g, sport, giocatore: chi, azione: a });
        applicaAzione({ g, sport, giocatore: chi, azione: a });
        applicaAzione({ g, sport, giocatore: chi, azione: a });
        Object.entries(a.apply || {}).forEach(([k, v]) => {
          if ((chi.stats[k] || 0) !== v * 3) {
            guai.push(a.act + ': «' + k + '» vale ' + chi.stats[k] + ' invece di ' + (v * 3));
          }
        });
        Object.entries(a.nested || {}).forEach(([cont, chiave]) => {
          const letto = ((chi.stats[cont] || {})[chiave]) || 0;
          if (letto !== 3) {
            guai.push(a.act + ': «' + cont + '.' + chiave + '» vale ' + letto + ' invece di 3');
          }
        });
        // E il registro ne ha tre righe, non una.
        const righe = g.storia.filter(x => x.a === a.act).length;
        if (righe !== 3) guai.push(a.act + ': ' + righe + ' righe nel registro invece di 3');
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': i punti di ogni azione arrivano al tabellone', () => {
      const guai = [];
      azioniDaPulsante(sport).forEach(a => {
        const g = nuovaPartita(sport);
        applicaAzione({ g, sport, giocatore: g.players[0], azione: a });
        const attesi = sport.score(g.players[0].stats);
        const sulTabellone = (g.periodScores[0] || {}).us || 0;
        if (sport.scout.scoreDisplay !== 'setsWon' && g.teamScore !== attesi) {
          guai.push(a.act + ': tabellone ' + g.teamScore + ', tabellino ' + attesi);
        }
        if (sulTabellone !== attesi) {
          guai.push(a.act + ': nel periodo ' + sulTabellone + ', nel tabellino ' + attesi);
        }
        // E l'errore che regala il punto lo regala, una volta sola.
        const loro = (g.periodScores[0] || {}).them || 0;
        if (a.puntoLoro && loro !== 1) guai.push(a.act + ' ha dato ' + loro + ' punti agli avversari');
        if (!a.puntoLoro && loro !== 0) guai.push(a.act + ' ha dato un punto agli avversari senza doverlo');
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': le catene si applicano come i pulsanti', () => {
      const catene = sport.scout.chains || {};
      const guai = [];
      Object.keys(catene).forEach(k => {
        const c = catene[k];
        [].concat(c.azione || [], c.opzioni || []).forEach(a => {
          try {
            const g = nuovaPartita(sport);
            applicaAzione({ g, sport, giocatore: g.players[1], azione: a });
            if (!g.storia.length) guai.push(k + '/' + a.act + ' non ha annotato niente');
            // E il referto la sa rileggere: se non la ritrova, quell'azione
            // sparisce dalle statistiche periodo per periodo.
            if (!azioneDi(sport, a.act)) guai.push(k + '/' + a.act + ' il referto non la ritrova');
          } catch (e) {
            guai.push(k + '/' + a.act + ': ' + e.message);
          }
        });
      });
      ok(guai.length === 0, guai.join(' / '));
    });
  });
});

/* ======================================================================== */
/* UNA PARTITA INTERA, E LE COSE CHE DEVONO VALERE SEMPRE                   */
/* ======================================================================== */

describe('una partita intera: il tabellone e il tabellino dicono la stessa cosa', () => {
  SPORT.forEach(([nome, sport]) => {
    const periodi = sport.scout.period.count || 4;
    const g = nuovaPartita(sport);
    let loroTotali = 0;
    for (let q = 1; q <= periodi; q++) {
      gioca(g, sport, 45, 1000 + q * 7);
      const suo = (g.periodScores[q - 1] || {}).them || 0;
      const loro = suo + 4 + q;      // gli avversari hanno segnato anche loro
      loroTotali += loro;
      chiudiPeriodo(g, sport, loro);
    }

    test(nome + ': il punteggio nostro e la somma dei punti dei giocatori', () => {
      const somma = g.players.reduce((n, p) => n + sport.score(p.stats), 0);
      if (sport.scout.scoreDisplay === 'setsWon') {
        // Nella pallavolo il tabellone sono i set: la somma dei punti sta nei
        // periodi, non nel punteggio della partita.
        const neiPeriodi = g.periodScores.reduce((n, x) => n + ((x && x.us) || 0), 0);
        is(neiPeriodi, somma);
      } else {
        is(g.teamScore, somma);
      }
    });

    test(nome + ': il punteggio avversario e quello dei periodi', () => {
      const neiPeriodi = g.periodScores.reduce((n, x) => n + ((x && x.them) || 0), 0);
      is(neiPeriodi, loroTotali);
    });

    test(nome + ': nessun numero negativo, da nessuna parte', () => {
      const guai = [];
      g.players.forEach(p => Object.entries(p.stats).forEach(([k, v]) => {
        if (typeof v === 'number' && v < 0) guai.push(p.name + '.' + k + ' = ' + v);
      }));
      g.periodScores.forEach((x, i) => {
        if (x && (x.us < 0 || x.them < 0)) guai.push('periodo ' + (i + 1) + ': ' + x.us + '-' + x.them);
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': il registro ha una riga per ogni cosa successa', () => {
      ok(g.storia.length >= periodi * 45, 'solo ' + g.storia.length + ' righe');
      // Ogni riga sa in quale periodo è, e il periodo esiste.
      const fuori = g.storia.filter(x => !(x.q >= 1 && x.q <= g.numQuarters));
      is(fuori.length, 0);
    });

    /* IL TEST PIÙ IMPORTANTE DI TUTTI.
     *
     * Le statistiche periodo per periodo nascono dal REGISTRO; i totali di
     * squadra nascono dalle statistiche dei GIOCATORI. Sono due strade diverse
     * per lo stesso dato, e se non arrivano allo stesso numero una delle due
     * sta mentendo — ed è quella del registro che finisce nelle grafiche a
     * cerchio del PDF. È esattamente il difetto dei primi set vuoti, e questo
     * lo prenderebbe. */
    test(nome + ': le statistiche periodo per periodo, sommate, fanno i totali', () => {
      const per = statistichePerPeriodo(g, sport);
      ok(per && per.length, 'nessuna statistica per periodo');
      const dalRegistro = {};
      per.forEach(p => Object.entries(p || {}).forEach(([k, v]) => {
        if (typeof v === 'number') dalRegistro[k] = (dalRegistro[k] || 0) + v;
      }));
      const daiGiocatori = {};
      g.players.forEach(p => Object.entries(p.stats).forEach(([k, v]) => {
        if (typeof v === 'number') daiGiocatori[k] = (daiGiocatori[k] || 0) + v;
      }));
      const guai = [];
      Object.keys(daiGiocatori).forEach(k => {
        if (k === 'plusMinus' || k === 'seconds' || k === 'setsPlayed') return;  // non vengono dalle azioni
        if ((dalRegistro[k] || 0) !== daiGiocatori[k]) {
          guai.push(k + ': dal registro ' + (dalRegistro[k] || 0) + ', dai giocatori ' + daiGiocatori[k]);
        }
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': il punteggio ricostruito dal registro e quello vero', () => {
      const a = andamentoPartita(g, sport);
      ok(a, 'nessun andamento');
      const nostri = g.periodScores.reduce((n, x) => n + ((x && x.us) || 0), 0);
      is(a.ricostruito.us, nostri);
      is(a.ricostruito.them, loroTotali);
    });

    test(nome + ': il referto si costruisce e il tabellino torna', () => {
      const r = refertoPartita(g, sport);
      ok(r);
      is(r.tabellino.length, g.players.length);
      const t = tabellaTabellino(r, sport);
      ok(t.intestazioni.length > 3);
      is(t.righe.length, g.players.length);
      // La riga della squadra non somma i numeri di maglia.
      is(t.totale[0], '');
    });

    test(nome + ': il massimo vantaggio non e mai minore dello scarto finale', () => {
      const a = andamentoPartita(g, sport);
      const nostri = g.periodScores.reduce((n, x) => n + ((x && x.us) || 0), 0);
      const scarto = nostri - loroTotali;
      if (scarto > 0) ok(a.maxVantaggio >= scarto, a.maxVantaggio + ' < ' + scarto);
      if (scarto < 0) ok(a.maxSvantaggio >= -scarto, a.maxSvantaggio + ' < ' + (-scarto));
    });
  });
});

/* ======================================================================== */
/* QUELLO CHE PUO' ANDARE STORTO DOMANI                                     */
/* ======================================================================== */

describe('le cose che possono succedere in palestra', () => {
  test('una partita senza nemmeno un tocco non rompe niente', () => {
    SPORT.forEach(([nome, sport]) => {
      const g = nuovaPartita(sport);
      calcolaPunteggi(g, sport);
      is(g.teamScore, 0, nome);
      const r = refertoPartita(g, sport);
      ok(r, nome + ': nessun referto');
      is(r.tabellino.length, g.players.length, nome);
    });
  });

  test('un tocco solo, e poi la partita finisce li', () => {
    const g = nuovaPartita(BASKET);
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, 'fg3_made') });
    chiudiPeriodo(g, BASKET, 0);
    const r = refertoPartita(g, BASKET);
    is(g.teamScore, 3);
    ok(r.andamento);
    is(r.andamento.maxVantaggio, 3);
  });

  test('millecinquecento azioni: i conti tengono e non ci mette mezz ora', () => {
    /* Ieri una partita di pallavolo ha fatto 585 salvataggi e 163 azioni. Un
     * torneo, o una partita segnata con tutti i dettagli accesi, ne fa molte
     * di più — e il referto le rilegge tutte a ogni apertura. */
    const g = nuovaPartita(PALLAVOLO, 14);
    const prima = Date.now();
    for (let set = 1; set <= 5; set++) {
      gioca(g, PALLAVOLO, 300, 55 + set);
      chiudiPeriodo(g, PALLAVOLO, 25);
    }
    const r = refertoPartita(g, PALLAVOLO);
    const durata = Date.now() - prima;
    ok(r, 'nessun referto');
    is(g.storia.length >= 1500, true);
    ok(durata < 6000, 'ci ha messo ' + durata + ' ms');
  });

  test('i punti degli avversari corretti a mano, anche in meno', () => {
    const g = nuovaPartita(BASKET);
    segnaPeriodo(g, 'them', 7);
    annota(g, { a: 'loro', n: 7 });
    segnaPeriodo(g, 'them', -3);
    annota(g, { a: 'loro', n: -3 });
    calcolaPunteggi(g, BASKET);
    is(g.oppScore, 4);
    is(andamentoPartita(g, BASKET).ricostruito.them, 4);
  });

  test('e non si scende sotto zero nemmeno insistendo', () => {
    const g = nuovaPartita(BASKET);
    segnaPeriodo(g, 'them', 2);
    for (let i = 0; i < 10; i++) segnaPeriodo(g, 'them', -1);
    calcolaPunteggi(g, BASKET);
    is(g.oppScore, 0);
  });

  test('un supplementare oltre i periodi previsti', () => {
    const g = nuovaPartita(BASKET);
    for (let q = 1; q <= 4; q++) { gioca(g, BASKET, 10, q); chiudiPeriodo(g, BASKET, 15); }
    // Pari: si gioca il quinto.
    is(g.quarter, 5);
    gioca(g, BASKET, 8, 99);
    chiudiPeriodo(g, BASKET, 5);
    is(g.numQuarters >= 5, true);
    const per = statistichePerPeriodo(g, BASKET);
    is(per.length >= 5, true, 'il supplementare non compare fra i periodi');
    ok(refertoPartita(g, BASKET));
  });

  test('un giocatore che entra in partita senza statistiche', () => {
    /* Succede: una rosa aggiornata da un'altra parte, una copia vecchia
     * ripresa. Prima si lanciava al primo tocco sul suo gettone. */
    const g = nuovaPartita(BASKET);
    const nuovo = { id: 'px', number: '99', name: 'Entrata Dopo', onCourt: true };
    g.players.push(nuovo);
    applicaAzione({ g, sport: BASKET, giocatore: nuovo, azione: azioneDi(BASKET, 'fg2_made') });
    is(nuovo.stats.fgm2, 1);
    is(g.teamScore, 2);
  });

  test('un azione che non esiste piu nel registro non falsa i conti', () => {
    const g = nuovaPartita(BASKET);
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, 'fg2_made') });
    g.storia.push({ q: 1, a: 'canestro_da_quattro', p: 'p0' });
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, 'fg2_made') });
    is(andamentoPartita(g, BASKET).ricostruito.us, 4);
    is(statistichePerPeriodo(g, BASKET)[0].fga2, 2);
  });

  test('applicaAzione con argomenti sbagliati non lancia, non fa niente', () => {
    const g = nuovaPartita(BASKET);
    is(applicaAzione({ g, sport: BASKET, giocatore: null, azione: {} }), null);
    is(applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: null }), null);
    is(applicaAzione({ g: null, sport: BASKET, giocatore: g.players[0], azione: {} }), null);
    is(applicaAzione({}), null);
    // E la partita è rimasta come era.
    is(g.storia.length, 0);
    is(g.teamScore, 0);
  });

  test('un azione vuota non annota un fantasma nel registro', () => {
    const g = nuovaPartita(BASKET);
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: { act: 'niente' } });
    // Annotata sì — è un tocco che è avvenuto — ma senza spostare niente.
    is(g.storia.length, 1);
    is(g.teamScore, 0);
  });

  test('i falli di squadra si contano nel periodo giusto', () => {
    const g = nuovaPartita(BASKET);
    const fallo = azioneDi(BASKET, 'pf');
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: fallo });
    applicaAzione({ g, sport: BASKET, giocatore: g.players[1], azione: fallo });
    chiudiPeriodo(g, BASKET, 0);
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: fallo });
    is(g.quarterFouls[1], 2);
    is(g.quarterFouls[2], 1);
  });

  test('la mappa dei tiri tiene il periodo di ogni tiro', () => {
    const g = nuovaPartita(BASKET);
    applicaAzione({
      g, sport: BASKET, giocatore: g.players[0],
      azione: azioneDi(BASKET, 'fg3_made'), punto: { x: 20, y: 80 }
    });
    chiudiPeriodo(g, BASKET, 0);
    applicaAzione({
      g, sport: BASKET, giocatore: g.players[0],
      azione: azioneDi(BASKET, 'fg3_miss'), punto: { x: 70, y: 60 }
    });
    const tiri = g.players[0].stats.tiri;
    is(tiri.length, 2);
    is(tiri[0].q, 1);
    is(tiri[1].q, 2);
    is(tiri[0].dentro, true);
    is(tiri[1].dentro, false);
  });

  test('la pallavolo: ogni nostro errore e un punto loro, e uno solo', () => {
    const g = nuovaPartita(PALLAVOLO);
    const errori = azioniDaPulsante(PALLAVOLO).filter(a => a.puntoLoro);
    ok(errori.length >= 3, 'solo ' + errori.length + ' errori che regalano il punto');
    errori.forEach(a => applicaAzione({ g, sport: PALLAVOLO, giocatore: g.players[0], azione: a }));
    is((g.periodScores[0] || {}).them, errori.length);
    // E nel registro c'è una riga «loro» per ciascuno.
    is(g.storia.filter(x => x.a === 'loro').length, errori.length);
  });

  test('il periodo in corso non conta come vinto, nella pallavolo', () => {
    const g = nuovaPartita(PALLAVOLO);
    segnaPeriodo(g, 'us', 20);
    segnaPeriodo(g, 'them', 14);
    calcolaPunteggi(g, PALLAVOLO);
    // Sul 20-14 nessuno ha ancora vinto niente.
    is(g.teamScore, 0);
    is(g.oppScore, 0);
    chiudiPeriodo(g, PALLAVOLO, 14);
    calcolaPunteggi(g, PALLAVOLO);
    is(g.teamScore, 1);
  });
});

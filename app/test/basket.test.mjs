import { describe, test, is, ok } from './run.mjs';
import { BASKET } from '../src/utils/sports/basket.js';
import { computeSeasonStats } from '../src/utils/stats.js';
import { refertoPartita, tabellaTabellino, totaleTabellino } from '../src/utils/referto.js';

/* Le percentuali al tiro della pallacanestro.
 *
 * I tiri tentati e segnati erano nel tabellino fin dal primo giorno — ogni
 * tocco su «Canestro» e ogni tocco su «Errore» li scrive — e non uscivano da
 * nessuna parte: finivano solo dentro la valutazione, mescolati a tutto il
 * resto. L'app raccoglieva la prima cosa che si guarda nel basket e non la
 * diceva.
 *
 * Qui si prova la sola cosa che conta per fidarsene: che una percentuale non
 * si sommi mai, e che si ricalcoli sempre dai totali.
 */

function atleta(nome, stats) {
  return { id: nome, number: '5', name: nome, stats: Object.assign(BASKET.newStats(), stats) };
}

const colonna = (key) => BASKET.seasonColumns.find(c => c.key === key);

describe('basket: le percentuali al tiro esistono', () => {
  test('le colonne ci sono, e sono rapporti e non totali', () => {
    ['t2', 't3', 'tl', 'efg'].forEach(k => {
      const c = colonna(k);
      ok(c, `manca la colonna ${k}`);
      ok(typeof c.calc === 'function', `${k} deve ricalcolarsi, non sommarsi`);
    });
  });

  test('i tentati vengono sommati dalla stagione', () => {
    ['fga2', 'fgm2', 'fga3', 'fgm3', 'fta', 'ftm'].forEach(k => {
      ok(typeof BASKET.aggregate[k] === 'function', `${k} non viene sommato`);
    });
  });

  test('la percentuale da due', () => {
    is(colonna('t2').calc({ fgm2: 5, fga2: 12 }), 42);
    is(colonna('t2').frazione({ fgm2: 5, fga2: 12 }), '5/12');
  });

  test('senza tiri non c’è una percentuale: è un trattino, non uno zero', () => {
    is(colonna('t2').calc({ fgm2: 0, fga2: 0 }), null);
    is(colonna('t2').frazione({ fgm2: 0, fga2: 0 }), null);
    is(colonna('tl').calc({ ftm: 0, fta: 0 }), null);
  });
});

describe('basket: la percentuale effettiva', () => {
  const efg = colonna('efg');

  test('conta il canestro da tre una volta e mezza', () => {
    // 4 triple su 10: 4 + 2 = 6 su 10 tiri = 60%. Con la percentuale secca
    // sarebbe 40%, cioè peggio di chi segna 5 su 10 da sotto — e invece con
    // gli stessi palloni ha prodotto due punti in più.
    is(efg.calc({ fgm2: 0, fga2: 0, fgm3: 4, fga3: 10 }), 60);
    is(efg.calc({ fgm2: 5, fga2: 10, fgm3: 0, fga3: 0 }), 50);
  });

  test('i tiri liberi non ci entrano: non sono tiri dal campo', () => {
    is(efg.calc({ fgm2: 5, fga2: 10, ftm: 8, fta: 8 }), 50);
  });

  test('chi non ha mai tirato non ha una percentuale', () => {
    is(efg.calc({ fgm2: 0, fga2: 0, fgm3: 0, fga3: 0 }), null);
  });
});

describe('basket: una percentuale non si somma mai', () => {
  const storico = [
    { players: [atleta('Rossi', { fgm2: 2, fga2: 10 })] },   // 20%
    { players: [atleta('Rossi', { fgm2: 8, fga2: 10 })] }    // 80%
  ];

  test('due partite al 20% e all’80% fanno il 50%, non il 100%', () => {
    const r = computeSeasonStats(storico, BASKET)[0];
    is(r.fgm2, 10);
    is(r.fga2, 20);
    is(colonna('t2').calc(r), 50);
  });
});

describe('basket: la riga della squadra', () => {
  const righe = [
    { name: 'Rossi', number: '4', games: 1, fgm2: 5, fga2: 12, fgm3: 1, fga3: 4, pts: 13, reb: 6 },
    { name: 'Bianchi', number: '7', games: 1, fgm2: 3, fga2: 6, fgm3: 2, fga3: 3, pts: 12, reb: 2 }
  ];

  test('somma i conteggi', () => {
    const t = totaleTabellino(righe);
    is(t.pts, 25);
    is(t.reb, 8);
    is(t.fga2, 18);
  });

  test('ma ricalcola le percentuali dai totali', () => {
    const t = totaleTabellino(righe);
    // 8 su 18, non la media fra 42% e 50%.
    is(colonna('t2').calc(t), 44);
  });

  test('le partite giocate restano una: è una partita, non due', () => {
    is(totaleTabellino(righe).games, 1);
  });

  test('senza giocatori non c’è nessuna riga squadra', () => {
    is(totaleTabellino([]).games, 0);
  });
});

describe('basket: il tabellino del referto', () => {
  const partita = {
    oppName: 'Aurora', teamScore: 68, oppScore: 54, quarter: 4, chiusi: 4,
    periodScores: [{ us: 20, them: 12 }, { us: 14, them: 16 }, { us: 18, them: 13 }, { us: 16, them: 13 }],
    players: [
      atleta('Rossi', { fgm2: 5, fga2: 12, fgm3: 1, fga3: 4, ftm: 3, fta: 4, orb: 2, drb: 4, ast: 3, pf: 2 }),
      atleta('Bianchi', { fgm2: 3, fga2: 6, fgm3: 2, fga3: 3, ftm: 0, fta: 0, orb: 1, drb: 2, ast: 5, pf: 4 })
    ]
  };

  test('su carta si legge la frazione, con la percentuale fra parentesi', () => {
    const t = tabellaTabellino(refertoPartita(partita, BASKET), BASKET);
    const i = t.intestazioni.indexOf('2P');
    ok(i > 1);
    is(t.righe[0][i], '5/12 (42%)');
  });

  test('c’è la riga della squadra, e non è una delle giocatrici', () => {
    const t = tabellaTabellino(refertoPartita(partita, BASKET), BASKET);
    is(t.righe.length, 2);
    ok(t.totale);
    const i = t.intestazioni.indexOf('2P');
    is(t.totale[i], '8/18 (44%)');
  });

  test('chi non ha tirato da tre ha un trattino, non 0/0', () => {
    const solo2 = { ...partita, players: [atleta('Verdi', { fgm2: 1, fga2: 2 })] };
    const t = tabellaTabellino(refertoPartita(solo2, BASKET), BASKET);
    is(t.righe[0][t.intestazioni.indexOf('3P')], '—');
  });

  test('una partita senza tabellino non produce una riga squadra vuota', () => {
    const vuota = { oppName: 'X', teamScore: 60, oppScore: 50, quarter: 1, players: [] };
    is(tabellaTabellino(refertoPartita(vuota, BASKET), BASKET).totale, null);
  });
});

describe('basket: la pallavolo non è stata toccata', () => {
  test('il basket non ha preso colonne che non gli appartengono', () => {
    ok(!BASKET.seasonColumns.some(c => c.key === 'ricPos'));
  });
});

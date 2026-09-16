import { describe, test, is, ok } from './run.mjs';
import { BASKET, zonaTiro } from '../src/utils/sports/basket.js';
import { computeSeasonStats } from '../src/utils/stats.js';
import { refertoPartita, tabellaTabellino, totaleTabellino, attaccoSquadra } from '../src/utils/referto.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

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

describe('basket: come abbiamo attaccato', () => {
  // 60 tiri dal campo, 8 rimbalzi offensivi, 12 palle perse, 20 liberi:
  // 60 − 8 + 12 + 8,8 = 72,8 possessi.
  const squadra = { pts: 68, fga2: 45, fga3: 15, orb: 8, tov: 12, fta: 20 };

  test('i possessi si ricavano, non si contano', () => {
    is(attaccoSquadra(squadra).possessi, 73);
  });

  test('i punti per possesso tengono due decimali', () => {
    // 68 / 72,8 = 0,934…
    is(attaccoSquadra(squadra).ppp, 0.93);
  });

  test('le palle perse si leggono ogni cento possessi, non in assoluto', () => {
    is(attaccoSquadra(squadra).perse, 16);
  });

  test('i liberi si rapportano ai tiri dal campo', () => {
    is(attaccoSquadra(squadra).liberi, 33);
  });

  test('due partite a ritmi diversi diventano confrontabili', () => {
    // Stessi 68 punti, ma una squadra ne gioca molti di meno: il punteggio è
    // identico e l'attacco no.
    const lenta = { pts: 68, fga2: 32, fga3: 10, orb: 6, tov: 7, fta: 14 };
    ok(attaccoSquadra(lenta).ppp > attaccoSquadra(squadra).ppp);
  });

  test('una partita senza tiri non produce numeri inventati', () => {
    is(attaccoSquadra({ pts: 0, fga2: 0, fga3: 0, orb: 0, tov: 0, fta: 0 }), null);
    is(attaccoSquadra(null), null);
  });

  test('il referto lo calcola sulla riga della squadra', () => {
    const partita = {
      oppName: 'Aurora', teamScore: 30, oppScore: 20, quarter: 2, chiusi: 1,
      periodScores: [{ us: 30, them: 20 }],
      players: [
        atleta('Rossi', { fgm2: 5, fga2: 12, fgm3: 1, fga3: 4, ftm: 3, fta: 4, orb: 2, tov: 3 }),
        atleta('Bianchi', { fgm2: 3, fga2: 6, fgm3: 2, fga3: 3, orb: 1, tov: 2 })
      ]
    };
    const a = refertoPartita(partita, BASKET).attacco;
    ok(a);
    // 25 tiri − 3 rimbalzi offensivi + 5 perse + 1,76 = 28,76
    is(a.possessi, 29);
  });

  test('nella pallavolo non si parla di possessi', () => {
    ok(!PALLAVOLO.scout.possessi);
  });
});

describe('basket: da dove è partito il tiro', () => {
  test('sotto canestro è area', () => is(zonaTiro(50, 8), 'area'));
  test('in lunetta si è ancora in area', () => is(zonaTiro(50, 38), 'area'));
  test('dall’ala, dentro l’arco, è media', () => is(zonaTiro(20, 30), 'media'));
  test('da fuori è tre', () => is(zonaTiro(50, 90), 'tre'));

  test('l’angolo è più corto, e va rispettato', () => {
    // La tripla d'angolo sta a 6,60 e non a 6,75: senza la regola della
    // retta, ogni tiro dal fondo risulterebbe da due.
    is(zonaTiro(3, 5), 'tre');
    is(zonaTiro(10, 5), 'media');
  });

  test('senza punto non c’è nessuna zona', () => {
    is(zonaTiro(null, null), null);
    is(zonaTiro(50, null), null);
  });

  test('lo sport la porta con sé: il referto non sa dov’è l’arco', () => {
    is(typeof BASKET.zonaTiro, 'function');
    is(BASKET.zoneTiro.length, 3);
    ok(!PALLAVOLO.zonaTiro);
  });
});

describe('basket: la mappa nel referto', () => {
  const conTiri = (tiri) => ({
    oppName: 'Aurora', teamScore: 30, oppScore: 20, quarter: 2, chiusi: 1,
    periodScores: [{ us: 30, them: 20 }],
    players: [{ id: 'r', number: '4', name: 'Rossi', stats: Object.assign(BASKET.newStats(), { tiri }) }]
  });

  test('i tiri di tutti finiscono in un elenco solo', () => {
    const r = refertoPartita(conTiri([
      { x: 50, y: 8, act: 'fg2_made', dentro: true, q: 1 },
      { x: 50, y: 10, act: 'fg2_miss', dentro: false, q: 1 },
      { x: 50, y: 90, act: 'fg3_made', dentro: true, q: 1 }
    ]), BASKET);
    is(r.tiri.punti.length, 3);
  });

  test('le zone si contano sul punto, non su quello che è stato scritto', () => {
    const r = refertoPartita(conTiri([
      { x: 50, y: 8, act: 'fg2_made', dentro: true, q: 1 },
      { x: 50, y: 10, act: 'fg2_miss', dentro: false, q: 1 },
      { x: 50, y: 90, act: 'fg3_made', dentro: true, q: 1 }
    ]), BASKET);
    const area = r.tiri.zone.find(z => z.key === 'area');
    is(area.fatti, 1);
    is(area.tentati, 2);
    is(area.quota, 50);
    is(r.tiri.zone.find(z => z.key === 'tre').quota, 100);
  });

  test('una zona da cui non si è mai tirato non compare', () => {
    const r = refertoPartita(conTiri([{ x: 50, y: 8, act: 'fg2_made', dentro: true, q: 1 }]), BASKET);
    is(r.tiri.zone.length, 1);
  });

  test('una partita segnata senza mappa non ne mostra una vuota', () => {
    is(refertoPartita(conTiri([]), BASKET).tiri, null);
  });

  test('nella pallavolo la mappa non esiste', () => {
    const v = { oppName: 'X', teamScore: 3, oppScore: 0, quarter: 1, players: [] };
    is(refertoPartita(v, PALLAVOLO).tiri, null);
  });
});

describe('basket: la mappa è una scelta, non un obbligo', () => {
  test('lo sport la offre', () => is(BASKET.scout.mappaTiri, true));

  test('solo i tiri dal campo hanno un punto: i liberi si tirano da fermi', () => {
    const azioni = BASKET.scout.groups.flatMap(gr => gr.actions);
    const conZona = azioni.filter(a => a.zona).map(a => a.act).sort();
    is(conZona.join(','), 'fg2_made,fg2_miss,fg3_made,fg3_miss');
  });

  test('i canestri sanno di essere entrati, gli errori no', () => {
    const azioni = BASKET.scout.groups.flatMap(gr => gr.actions);
    is(azioni.find(a => a.act === 'fg3_made').dentro, true);
    ok(!azioni.find(a => a.act === 'fg3_miss').dentro);
  });
});

import { describe, test, is, ok } from './run.mjs';
import {
  computeSeasonStats, findSeasonRow, computeRecord, computeStreak, playerPtsOf
} from '../src/utils/stats.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { CALCIO } from '../src/utils/sports/calcio.js';

function bStats(o) {
  return Object.assign(BASKET.newStats(), o);
}

const gara = (players, teamScore = 0, oppScore = 0) => ({ players, teamScore, oppScore });

describe('statistiche stagionali', () => {
  // Il difetto storico: l'aggregazione era per NOME, quindi due omonimi
  // finivano nella stessa riga e chi cambiava nome perdeva lo storico.
  test('due omonimi restano due righe distinte', () => {
    const rows = computeSeasonStats([
      gara([
        { id: 'a', name: 'Rossi', number: '4', stats: bStats({ fgm2: 5 }) },
        { id: 'b', name: 'Rossi', number: '9', stats: bStats({ fgm2: 2 }) }
      ])
    ], BASKET);
    is(rows.length, 2);
    is(rows.find(r => r.id === 'a').pts, 10);
    is(rows.find(r => r.id === 'b').pts, 4);
  });

  test('chi cambia nome mantiene il proprio storico', () => {
    const rows = computeSeasonStats([
      gara([{ id: 'a', name: 'Bianchi', number: '7', stats: bStats({ fgm3: 2 }) }]),
      gara([{ id: 'a', name: 'Bianchi Verdi', number: '7', stats: bStats({ fgm3: 1 }) }])
    ], BASKET);
    is(rows.length, 1);
    is(rows[0].games, 2);
    is(rows[0].pts, 9);
    is(rows[0].name, 'Bianchi Verdi'); // in tabella si legge il nome attuale
  });

  test('i tabellini vecchi senza id ricadono sul nome', () => {
    const rows = computeSeasonStats([
      gara([{ name: 'Neri', number: '3', stats: bStats({ ftm: 4 }) }]),
      gara([{ name: 'Neri', number: '3', stats: bStats({ ftm: 2 }) }])
    ], BASKET);
    is(rows.length, 1);
    is(rows[0].pts, 6);
  });

  test('somma le voci dichiarate dallo sport, non quelle del basket', () => {
    const rows = computeSeasonStats([
      gara([{ id: 'x', name: 'Verdi', number: '10', stats: { goals: 2, assists: 1 } }]),
      gara([{ id: 'x', name: 'Verdi', number: '10', stats: { goals: 1, assists: 3 } }])
    ], CALCIO);
    is(rows[0].goals, 3);
    is(rows[0].assists, 4);
    is(rows[0].pts, undefined); // "punti" non esiste nel calcio
  });

  test('il punteggio salvato ha la precedenza su quello ricalcolato', () => {
    is(playerPtsOf({ pts: 17, stats: bStats({ fgm2: 1 }) }, BASKET), 17);
    is(playerPtsOf({ stats: bStats({ fgm2: 3, fgm3: 1 }) }, BASKET), 9);
  });
});

describe('aggancio del giocatore alla sua riga', () => {
  const rows = [
    { id: 'a', name: 'Rossi' },
    { id: null, name: 'Storico' }
  ];
  test('preferisce l\'id al nome', () => {
    is(findSeasonRow(rows, { id: 'a', name: 'Nome Cambiato' }).id, 'a');
  });
  test('ricade sul nome solo per le righe senza id', () => {
    is(findSeasonRow(rows, { id: 'z', name: 'Storico' }).name, 'Storico');
  });
  test('senza corrispondenza restituisce null', () => {
    is(findSeasonRow(rows, { id: 'z', name: 'Ignoto' }), null);
  });
});

describe('record e serie', () => {
  test('conta anche i pareggi', () => {
    const r = computeRecord([
      gara([], 3, 1), gara([], 2, 2), gara([], 0, 1)
    ]);
    is(r.w, 1); is(r.d, 1); is(r.l, 1);
  });

  test('la serie si interrompe al primo esito diverso', () => {
    const s = computeStreak([
      gara([], 1, 2), gara([], 3, 0), gara([], 4, 1)
    ]);
    is(s, '2V di fila');
  });

  test('un pareggio spezza la serie di vittorie', () => {
    const s = computeStreak([gara([], 3, 0), gara([], 1, 1)]);
    ok(s.startsWith('1N'));
  });

  test('senza partite non inventa una serie', () => {
    is(computeStreak([]), 'Nessuna partita');
  });
});

import { describe, test, is, ok } from './run.mjs';
import { refertoPartita, tabellaTabellino, quota } from '../src/utils/referto.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

// Il referto non calcola niente di nuovo: mette in ordine quello che il motore
// degli scambi ha raccolto set per set. Quindi i test guardano una cosa sola —
// che nel rimettere in ordine non si perda né si inventi niente.

function atleta(nome, stats) {
  return { id: nome, number: '1', name: nome, stats: Object.assign(PALLAVOLO.newStats(), stats) };
}

const partita = {
  oppName: 'Riccione',
  teamScore: 2, oppScore: 1,
  quarter: 3, chiusi: 3,
  periodScores: [
    { us: 25, them: 20, soV: 12, soT: 15, bpV: 13, bpT: 22, perRot: { 1: { f: 6, s: 3 }, 2: { f: 4, s: 5 } } },
    { us: 21, them: 25, soV: 9, soT: 18, bpV: 12, bpT: 20, perRot: { 1: { f: 5, s: 8 }, 3: { f: 3, s: 4 } } },
    { us: 25, them: 22, soV: 13, soT: 17, bpV: 12, bpT: 21, perRot: { 2: { f: 7, s: 2 } } }
  ],
  players: [
    atleta('Baroncini', { points: 14, kills: 12, attacks: 30, attackErrors: 4, blocks: 1, aces: 1 }),
    atleta('Pedrelli', { points: 9, kills: 7, attacks: 22, attackErrors: 6, blocks: 2 })
  ]
};

describe('il referto: i set', () => {
  const r = refertoPartita(partita, PALLAVOLO);

  test('ci sono tutti e tre, nell’ordine in cui si sono giocati', () => {
    is(r.set.length, 3);
    is(r.set[0].us, 25);
    is(r.set[1].them, 25);
  });

  test('ogni set porta le sue due fasi', () => {
    is(quota(r.set[0].so), 80);
    is(quota(r.set[0].bp), 59);
  });

  test('un set non ancora chiuso non entra nel referto', () => {
    const aperta = { ...partita, quarter: 4, chiusi: 3,
      periodScores: [...partita.periodScores, { us: 7, them: 5 }] };
    is(refertoPartita(aperta, PALLAVOLO).set.length, 3);
  });
});

describe('il referto: le fasi di tutta la partita', () => {
  const r = refertoPartita(partita, PALLAVOLO);

  test('sono la somma di quelle dei set, non una media di percentuali', () => {
    is(r.fasi.so.v, 34); is(r.fasi.so.t, 50);
    is(r.fasi.bp.v, 37); is(r.fasi.bp.t, 63);
    is(quota(r.fasi.so), 68);
  });
});

describe('il referto: le rotazioni', () => {
  const r = refertoPartita(partita, PALLAVOLO);

  test('si sommano attraverso i set', () => {
    const r1 = r.rotazioni.find(x => x.n === 1);
    is(r1.f, 11); is(r1.s, 11); is(r1.saldo, 0);
  });

  test('vengono in ordine di numero', () => {
    is(r.rotazioni.map(x => x.n).join(''), '123');
  });

  test('il saldo dice dove si affonda', () => {
    is(r.rotazioni.find(x => x.n === 2).saldo, 4);
    is(r.rotazioni.find(x => x.n === 3).saldo, -1);
  });

  test('una rotazione mai giocata non compare', () => {
    is(r.rotazioni.find(x => x.n === 5), undefined);
  });
});

describe('il referto: il tabellino', () => {
  const r = refertoPartita(partita, PALLAVOLO);

  test('c’è una riga per giocatrice, dalla più prolifica', () => {
    is(r.tabellino.length, 2);
    is(r.tabellino[0].name, 'Baroncini');
  });

  test('un’amichevole ha comunque il suo referto', () => {
    const am = refertoPartita({ ...partita, friendly: true }, PALLAVOLO);
    is(am.tabellino.length, 2);
  });

  test('la tabella porta le stesse colonne delle statistiche', () => {
    const t = tabellaTabellino(r, PALLAVOLO);
    is(t.intestazioni[0], 'N');
    is(t.intestazioni[1], 'Giocatore');
    ok(t.intestazioni.includes('EFF'));
    is(t.righe.length, 2);
  });

  test('l’efficienza arriva in tabella già in percentuale', () => {
    const t = tabellaTabellino(r, PALLAVOLO);
    const i = t.intestazioni.indexOf('EFF');
    is(t.righe[0][i], '27%');   // (12 - 4) / 30
  });

  test('dove non c’è un dato si scrive un trattino, non uno zero', () => {
    const t = tabellaTabellino(r, PALLAVOLO);
    const i = t.intestazioni.indexOf('RIC');
    is(t.righe[0][i], '—');
  });
});

describe('il referto: partite senza scout', () => {
  test('un risultato scritto a mano non ha tabellino e non si rompe', () => {
    const r = refertoPartita({ oppName: 'X', teamScore: 3, oppScore: 0, quarter: 1, players: [] }, PALLAVOLO);
    is(r.tabellino.length, 0);
    is(r.set.length, 0);
    is(r.rotazioni.length, 0);
  });

  test('senza partita non restituisce niente', () => {
    is(refertoPartita(null, PALLAVOLO), null);
  });
});

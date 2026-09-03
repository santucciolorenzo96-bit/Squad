import { describe, test, is, eq } from './run.mjs';
import { computeStandings, latestGiornata } from '../src/utils/standingsCalc.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { CALCIO } from '../src/utils/sports/calcio.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

const row = (t, rows) => rows.find(r => r.team_name === t);

describe('classifica — regole per sport', () => {
  test('basket: due punti a vittoria, zero a sconfitta', () => {
    const r = computeStandings([
      { home_team: 'Noi', away_team: 'Alfa', home_score: 80, away_score: 70 },
      { home_team: 'Beta', away_team: 'Noi', home_score: 90, away_score: 85 }
    ], BASKET, 'Noi');
    is(row('Noi', r).points, 2);
    is(row('Beta', r).points, 2);
    is(row('Alfa', r).points, 0);
  });

  test('calcio: tre a vittoria, uno a pareggio', () => {
    const r = computeStandings([
      { home_team: 'Noi', away_team: 'Alfa', home_score: 2, away_score: 2 },
      { home_team: 'Beta', away_team: 'Noi', home_score: 0, away_score: 1 }
    ], CALCIO, 'Noi');
    is(row('Noi', r).points, 4);
    is(row('Noi', r).draws, 1);
    is(row('Alfa', r).points, 1);
    is(row('Beta', r).points, 0);
  });

  // La regola che si sbaglia più facilmente: nella pallavolo il punteggio
  // dipende da quanto è stata combattuta, e chi perde 2-3 porta a casa un punto.
  test('pallavolo: 3-0 vale tre, 3-2 vale due, chi perde 2-3 ne prende uno', () => {
    const r = computeStandings([
      { home_team: 'Noi', away_team: 'Alfa', home_score: 3, away_score: 0 },
      { home_team: 'Beta', away_team: 'Noi', home_score: 3, away_score: 2 }
    ], PALLAVOLO, 'Noi');
    is(row('Noi', r).points, 4);   // 3 per il 3-0, 1 per il 2-3
    is(row('Beta', r).points, 2);  // vittoria al quinto set
    is(row('Alfa', r).points, 0);  // sconfitta 0-3
  });
});

describe('classifica — ordinamento e conteggi', () => {
  test('a pari punti decide la differenza fra fatti e subiti', () => {
    const r = computeStandings([
      { home_team: 'Alfa', away_team: 'Gamma', home_score: 5, away_score: 0 },
      { home_team: 'Beta', away_team: 'Delta', home_score: 1, away_score: 0 }
    ], CALCIO, 'Noi');
    is(r[0].team_name, 'Alfa');  // +5 contro +1, stessi punti
    is(r[1].team_name, 'Beta');
  });

  test('le partite non ancora giocate non contano', () => {
    const r = computeStandings([
      { home_team: 'Noi', away_team: 'Alfa', home_score: null, away_score: null }
    ], BASKET, 'Noi');
    eq(r, []);
  });

  test('le squadre inserite a mano compaiono anche a zero partite', () => {
    const r = computeStandings([], BASKET, 'Noi', ['Noi', 'Alfa']);
    is(r.length, 2);
    is(r[0].played, 0);
  });

  test('riconosce la nostra squadra ignorando maiuscole e spazi', () => {
    const r = computeStandings([
      { home_team: '  basket catania ', away_team: 'Alfa', home_score: 70, away_score: 60 }
    ], BASKET, 'Basket Catania');
    is(row('basket catania', r).is_us, true);
  });

  test('accorpa la stessa squadra scritta in modo diverso', () => {
    const r = computeStandings([
      { home_team: 'Alfa', away_team: 'Beta', home_score: 3, away_score: 1 },
      { home_team: 'ALFA', away_team: 'Gamma', home_score: 2, away_score: 0 }
    ], CALCIO, 'Noi');
    // Le due grafie confluiscono in una riga sola, che conserva la prima incontrata.
    const alfa = r.find(x => x.team_name.toLowerCase() === 'alfa');
    is(r.filter(x => x.team_name.toLowerCase() === 'alfa').length, 1);
    is(alfa.played, 2);
    is(alfa.points, 6);
  });
});

describe('classifica — giornata più avanzata', () => {
  test('ignora le giornate senza risultato', () => {
    is(latestGiornata([
      { giornata: 3, home_score: 70 },
      { giornata: 8, home_score: null }
    ]), 3);
  });

  test('senza risultati non propone nessuna giornata', () => {
    is(latestGiornata([{ giornata: 5, home_score: null }]), null);
  });
});

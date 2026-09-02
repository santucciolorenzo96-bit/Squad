// Classifica calcolata dai risultati, non digitata.
//
// Le regole cambiano con lo sport — due punti a vittoria nel basket, 3-1-0 nel
// calcio, e nella pallavolo dipende da come è finita al quinto set — quindi il
// conteggio dei punti lo dichiara il descrittore. Qui c'è solo l'aritmetica.

function emptyRow(name, sport) {
  const row = {
    team_name: name, played: 0, wins: 0, draws: 0, losses: 0, points: 0, stats: {}
  };
  sport.standings.extras.forEach(e => { row.stats[e.key] = 0; });
  return row;
}

function sideOf(match, isHome) {
  return {
    name: isHome ? match.home_team : match.away_team,
    scored: isHome ? match.home_score : match.away_score,
    conceded: isHome ? match.away_score : match.home_score
  };
}

export function computeStandings(matches, sport, ourName, knownTeams = []) {
  const st = sport.standings;
  const table = {};
  const keyOf = (n) => (n || '').trim().toLowerCase();

  // Le squadre già inserite a mano compaiono anche a zero partite: una
  // classifica che elenca solo chi ha già giocato sembra incompleta.
  knownTeams.forEach(n => { if (n && n.trim()) table[keyOf(n)] = emptyRow(n.trim(), sport); });

  matches.forEach(m => {
    if (m.home_score == null || m.away_score == null) return; // non ancora giocata
    [true, false].forEach(isHome => {
      const side = sideOf(m, isHome);
      const k = keyOf(side.name);
      if (!k) return;
      if (!table[k]) table[k] = emptyRow(side.name.trim(), sport);
      const row = table[k];
      row.played += 1;
      if (side.scored > side.conceded) row.wins += 1;
      else if (side.scored < side.conceded) row.losses += 1;
      else row.draws += 1;
      row.points += st.pointsFor(side.scored, side.conceded);
      st.extras.forEach(e => {
        if (e.role === 'scored') row.stats[e.key] += side.scored;
        else if (e.role === 'conceded') row.stats[e.key] += side.conceded;
      });
    });
  });

  const scoredKey = (st.extras.find(e => e.role === 'scored') || {}).key;
  const concededKey = (st.extras.find(e => e.role === 'conceded') || {}).key;

  return Object.values(table)
    .map(r => ({ ...r, is_us: keyOf(r.team_name) === keyOf(ourName) }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      // A pari punti conta la differenza fra fatti e subiti, che è il criterio
      // più diffuso; non è la classifica avulsa delle federazioni, e va detto.
      if (scoredKey && concededKey) {
        const da = a.stats[scoredKey] - a.stats[concededKey];
        const db = b.stats[scoredKey] - b.stats[concededKey];
        if (db !== da) return db - da;
      }
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.team_name.localeCompare(b.team_name);
    });
}

// Il turno più avanzato per cui esiste almeno un risultato: è la giornata che
// conviene proporre per prima quando si aprono i risultati.
export function latestGiornata(matches) {
  const played = matches.filter(m => m.home_score != null && m.giornata != null);
  if (played.length === 0) return null;
  return Math.max(...played.map(m => m.giornata));
}

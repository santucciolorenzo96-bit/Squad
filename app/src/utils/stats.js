export function newPlayerStats() {
  return {
    fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0,
    tov: 0, tovTypes: { generica: 0, palleggio: 0, passaggio: 0, passi: 0 },
    blk: 0, blkAgainst: 0, pf: 0, pfDrawn: 0, plusMinus: 0, seconds: 0
  };
}

export function playerPts(p) {
  return p.stats.fgm2 * 2 + p.stats.fgm3 * 3 + p.stats.ftm;
}

export function playerPtsOf(p) {
  return p.pts != null ? p.pts : playerPts(p);
}

export function computeSeasonStats(history) {
  const totals = {};
  history.forEach(g => {
    (g.players || []).forEach(p => {
      if (!totals[p.name]) {
        totals[p.name] = { name: p.name, number: p.number, games: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, seconds: 0 };
      }
      const t = totals[p.name]; const s = p.stats || {};
      t.games += 1; t.pts += playerPtsOf(p);
      t.reb += (s.orb || 0) + (s.drb || 0); t.ast += s.ast || 0; t.stl += s.stl || 0;
      t.blk += s.blk || 0; t.tov += s.tov || 0; t.seconds += s.seconds || 0;
    });
  });
  return Object.values(totals);
}

export function standingsPosition(standings, teamName) {
  if (!teamName || standings.length === 0) return null;
  const sorted = [...standings].sort((a, b) => b.points - a.points);
  const idx = sorted.findIndex(r => r.team_name.trim().toLowerCase() === teamName.trim().toLowerCase());
  return idx >= 0 ? idx + 1 : null;
}

export function computeRecord(history) {
  let w = 0, l = 0;
  history.forEach(g => { if (g.teamScore > g.oppScore) w++; else if (g.teamScore < g.oppScore) l++; });
  return { w, l };
}

export function computeStreak(history) {
  let streak = 0, type = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const win = history[i].teamScore > history[i].oppScore;
    if (type === null) { type = win ? 'V' : 'S'; streak = 1; }
    else if ((win && type === 'V') || (!win && type === 'S')) { streak++; }
    else break;
  }
  return streak ? `${streak}${type} di fila` : 'Nessuna partita';
}

export function computeTeamPPG(history) {
  if (history.length === 0) return null;
  return history.reduce((a, g) => a + g.teamScore, 0) / history.length;
}

export function computeGameIndex(p) {
  const s = p.stats;
  const missed = (s.fga2 - s.fgm2) + (s.fga3 - s.fgm3) + (s.fta - s.ftm);
  return (playerPtsOf(p)) + (s.orb + s.drb) + s.ast + s.stl + s.blk + s.pfDrawn - missed - s.tov - s.pf - s.blkAgainst;
}

export function computeLastGameMVP(g) {
  if (!g) return null;
  let best = null, bestVal = -9999;
  g.players.forEach(p => {
    const ind = computeGameIndex(p);
    if (ind > bestVal) { bestVal = ind; best = { ...p, pts: playerPtsOf(p), ind }; }
  });
  return best;
}

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

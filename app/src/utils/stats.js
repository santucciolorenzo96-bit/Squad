import { BASKET } from './sports/basket.js';

// Questo modulo non sa più cos'è la pallacanestro: riceve il descrittore dello
// sport e itera le voci che dichiara. Il basket resta il default di ogni
// funzione, così il codice che non passa lo sport continua a funzionare.

export function newPlayerStats() {
  return BASKET.newStats();
}

export function playerPts(p) {
  return BASKET.score(p.stats || {});
}

// Il punteggio salvato nel tabellino vince sempre su quello ricalcolato: negli
// sport a inserimento manuale è l'unico dato che esiste.
export function playerPtsOf(p, sport = BASKET) {
  if (p.pts != null) return p.pts;
  return sport.score(p.stats || {});
}

// Chiave di aggregazione stagionale. Prima era il nome: due omonimi si
// fondevano e chi cambiava nome perdeva lo storico. L'id del giocatore è nei
// tabellini fin dall'inizio; il nome resta solo come rete di sicurezza per
// eventuali partite salvate senza.
function seasonKey(p) {
  return p.id ? 'id:' + p.id : 'nm:' + (p.name || '?');
}

export function computeSeasonStats(history, sport = BASKET) {
  const keys = Object.keys(sport.aggregate);
  const totals = {};
  history.forEach(g => {
    (g.players || []).forEach(p => {
      const k = seasonKey(p);
      if (!totals[k]) {
        const row = { id: p.id || null, name: p.name, number: p.number, games: 0 };
        keys.forEach(key => { row[key] = 0; });
        totals[k] = row;
      }
      const t = totals[k];
      t.games += 1;
      // Nome e numero seguono l'ultima partita: se un giocatore cambia numero
      // a stagione in corso, in tabella si legge quello attuale.
      t.name = p.name || t.name;
      t.number = p.number != null ? p.number : t.number;
      keys.forEach(key => { t[key] += sport.aggregate[key](p) || 0; });
    });
  });
  return Object.values(totals);
}

// Trova la riga stagionale di un giocatore della rosa: per id, con ricaduta sul
// nome per i tabellini più vecchi.
export function findSeasonRow(season, player) {
  if (!player) return null;
  return season.find(r => r.id && r.id === player.id)
    || season.find(r => !r.id && r.name === player.name)
    || null;
}

export function standingsPosition(standings, teamName) {
  if (!teamName || standings.length === 0) return null;
  const sorted = [...standings].sort((a, b) => b.points - a.points);
  const idx = sorted.findIndex(r => r.team_name.trim().toLowerCase() === teamName.trim().toLowerCase());
  return idx >= 0 ? idx + 1 : null;
}

// Il pareggio esiste solo in alcuni sport, ma contarlo non fa danno altrove:
// una partita di basket non finisce mai in parità.
export function computeRecord(history) {
  let w = 0, d = 0, l = 0;
  history.forEach(g => {
    if (g.teamScore > g.oppScore) w++;
    else if (g.teamScore < g.oppScore) l++;
    else d++;
  });
  return { w, d, l };
}

export function computeStreak(history) {
  let streak = 0, type = null;
  for (let i = history.length - 1; i >= 0; i--) {
    const g = history[i];
    const outcome = g.teamScore > g.oppScore ? 'V' : (g.teamScore < g.oppScore ? 'S' : 'N');
    if (type === null) { type = outcome; streak = 1; }
    else if (outcome === type) { streak++; }
    else break;
  }
  return streak ? `${streak}${type} di fila` : 'Nessuna partita';
}

export function computeTeamPPG(history) {
  if (history.length === 0) return null;
  return history.reduce((a, g) => a + g.teamScore, 0) / history.length;
}

// Valutazione cestistica: resta esportata con il vecchio nome perché il
// tracker dal vivo la usa direttamente.
export function computeGameIndex(p) {
  return BASKET.rating(p);
}

export function playerRating(p, sport = BASKET) {
  return sport.rating(p);
}

export function computeLastGameMVP(g, sport = BASKET) {
  if (!g) return null;
  let best = null, bestVal = -Infinity;
  (g.players || []).forEach(p => {
    const ind = sport.rating(p);
    if (ind > bestVal) { bestVal = ind; best = { ...p, pts: playerPtsOf(p, sport), ind }; }
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

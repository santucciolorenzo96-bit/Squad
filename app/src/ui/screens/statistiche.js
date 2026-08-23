import { state } from '../../state.js';
import { esc, fmtMin } from '../../utils/format.js';
import { computeSeasonStats } from '../../utils/stats.js';

export function renderStatisticheTab(c) {
  const season = computeSeasonStats(state.history);
  if (season.length === 0) { c.innerHTML = '<div class="placeholder-card">Nessuna statistica disponibile. Le statistiche stagionali si costruiscono automaticamente man mano che registri le partite.</div>'; return; }
  const sorted = [...season].sort((a, b) => b.pts - a.pts);
  const headers = ['#', 'Giocatore', 'PG', 'PT', 'PPG', 'REB', 'RPG', 'AST', 'APG', 'ST', 'STP', 'PP', 'MIN'];
  let rows = '';
  sorted.forEach(p => {
    rows += `<tr><td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td><td>${p.games}</td>
      <td><b>${p.pts}</b></td><td>${(p.pts / p.games).toFixed(1)}</td>
      <td>${p.reb}</td><td>${(p.reb / p.games).toFixed(1)}</td>
      <td>${p.ast}</td><td>${(p.ast / p.games).toFixed(1)}</td>
      <td>${p.stl}</td><td>${p.blk}</td><td>${p.tov}</td><td>${fmtMin(p.seconds)}</td></tr>`;
  });
  c.innerHTML = `
    <div class="section-label">Statistiche stagionali · ${state.history.length} partite giocate</div>
    <div class="boxscore-wrap"><table class="boxscore"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hint" style="margin-top:8px;">PG = partite giocate · PPG/RPG/APG = medie a partita · STP = stoppate fatte · PP = palle perse</div>
  `;
}

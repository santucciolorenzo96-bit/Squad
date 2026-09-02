import { state } from '../../state.js';
import { esc, fmtMin } from '../../utils/format.js';
import { computeSeasonStats } from '../../utils/stats.js';
import { currentSport } from '../../utils/sports/index.js';

// La tabella non conosce nessuno sport: chiede al descrittore quali colonne
// mostrare e quali di queste vogliono anche la media a partita.
export function renderStatisticheTab(c) {
  const sport = currentSport();
  const season = computeSeasonStats(state.history, sport);
  if (season.length === 0) {
    c.innerHTML = '<div class="placeholder-card">Nessuna statistica disponibile. Le statistiche stagionali si costruiscono automaticamente man mano che registri le partite.</div>';
    return;
  }

  const primary = sport.seasonColumns[0];
  const sorted = [...season].sort((a, b) => (b[primary.key] || 0) - (a[primary.key] || 0));

  const headers = ['#', 'Giocatore', 'PG'];
  sport.seasonColumns.forEach(col => {
    headers.push(col.short);
    if (col.avg) headers.push(col.avg);
  });
  if (sport.showMinutes) headers.push('MIN');

  const rows = sorted.map(p => {
    let cells = `<td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td><td>${p.games}</td>`;
    sport.seasonColumns.forEach((col, i) => {
      const total = p[col.key] || 0;
      cells += i === 0 ? `<td><b>${total}</b></td>` : `<td>${total}</td>`;
      if (col.avg) cells += `<td>${(total / p.games).toFixed(1)}</td>`;
    });
    if (sport.showMinutes) cells += `<td>${fmtMin(p.seconds || 0)}</td>`;
    return `<tr>${cells}</tr>`;
  }).join('');

  c.innerHTML = `
    <div class="section-label">Statistiche stagionali · ${state.history.length} partite giocate</div>
    <div class="boxscore-wrap"><table class="boxscore"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="hint" style="margin-top:8px;">${esc(sport.seasonLegend)}</div>
  `;
}

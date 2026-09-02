import { state } from '../../../state.js';
import { esc, fmtMin } from '../../../utils/format.js';
import { playerPtsOf } from '../../../utils/stats.js';
import { currentSport } from '../../../utils/sports/index.js';

function buildBoxScoreRows(playersArr) {
  return [...playersArr].sort((a, b) => (b.onCourt ? 1 : 0) - (a.onCourt ? 1 : 0) || (playerPtsOf(b) - playerPtsOf(a)));
}

export function openBoxScoreModal(game) {
  const root = document.getElementById('modalRoot');
  // Il tabellino dettagliato esiste solo per la pallacanestro: gli altri sport
  // salvano statistiche di forma diversa e verrebbero letti come colonne vuote.
  if (currentSport().key !== 'basket') return openSimpleBoxScore(game);
  const headers = ['#', 'Giocatore', 'MIN', 'PT', '2PT', '3PT', 'TL', 'RIM', 'AST', 'PR', 'PP', 'ST', 'SS', 'FC', 'FS', '+/-'];
  let rowsHtml = '';
  const sorted = buildBoxScoreRows(game.players);
  sorted.forEach(p => {
    const s = p.stats; const pm = s.plusMinus; const pmClass = pm > 0 ? 'pos' : (pm < 0 ? 'neg' : ''); const pmTxt = (pm > 0 ? '+' : '') + pm;
    rowsHtml += `<tr class="${p.onCourt ? 'on-court' : ''}"><td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td>
      <td>${fmtMin(s.seconds)}</td><td><b>${playerPtsOf(p)}</b></td>
      <td>${s.fgm2}/${s.fga2}</td><td>${s.fgm3}/${s.fga3}</td><td>${s.ftm}/${s.fta}</td>
      <td>${s.orb + s.drb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.tov}</td>
      <td>${s.blk}</td><td>${s.blkAgainst}</td><td>${s.pf}</td><td>${s.pfDrawn}</td>
      <td class="plusminus ${pmClass}">${pmTxt}</td></tr>`;
  });
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" style="max-width:96vw;width:700px;">
    <h3>${esc(state.teamProfile.name)} ${game.teamScore} — ${game.oppScore} ${esc(game.oppName || 'Avversari')}</h3>
    <div class="boxscore-wrap"><table class="boxscore"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
    <div class="modal-actions"><button class="btn btn-secondary" id="csvExportBtn">⬇ CSV</button><button class="btn btn-primary" id="modalCloseBtn" style="width:auto;">Chiudi</button></div>
  </div></div>`;
  document.getElementById('modalCloseBtn').onclick = () => { root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') root.innerHTML = ''; };
  document.getElementById('csvExportBtn').onclick = () => exportCsv(game);
}

// Tabellino generico: punteggio e le voci in evidenza dello sport.
function openSimpleBoxScore(game) {
  const sport = currentSport();
  const root = document.getElementById('modalRoot');
  const rows = [...(game.players || [])]
    .sort((a, b) => playerPtsOf(b, sport) - playerPtsOf(a, sport))
    .map(p => `<tr><td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td>`
      + sport.headline.map(h => `<td>${sport.aggregate[h.key](p) || 0}</td>`).join('')
      + `</tr>`).join('');
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" style="max-width:96vw;width:520px;">
    <h3>${esc(state.teamProfile.name)} ${game.teamScore} — ${game.oppScore} ${esc(game.oppName || 'Avversari')}</h3>
    ${rows
      ? `<div class="boxscore-wrap"><table class="boxscore"><thead><tr><th>#</th><th>Giocatore</th>${sport.headline.map(h => `<th>${h.short}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`
      : '<div class="hint">Nessuna statistica per giocatore registrata per questa partita.</div>'}
    <div class="modal-actions"><button class="btn btn-primary" id="modalCloseBtn" style="width:100%;">Chiudi</button></div>
  </div></div>`;
  document.getElementById('modalCloseBtn').onclick = () => { root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') root.innerHTML = ''; };
}

function exportCsv(game) {
  const headers = ['Numero', 'Giocatore', 'Minuti', 'Punti', '2PT Segnati', '2PT Tentati', '3PT Segnati', '3PT Tentati', 'TL Segnati', 'TL Tentati', 'Reb Off', 'Reb Dif', 'Assist', 'Palle Rubate', 'Palle Perse', 'Stoppate Fatte', 'Stoppate Subite', 'Falli Commessi', 'Falli Subiti', 'Plus Minus'];
  const rows = game.players.map(p => { const s = p.stats; return [p.number, p.name, fmtMin(s.seconds), playerPtsOf(p), s.fgm2, s.fga2, s.fgm3, s.fga3, s.ftm, s.fta, s.orb, s.drb, s.ast, s.stl, s.tov, s.blk, s.blkAgainst, s.pf, s.pfDrawn, s.plusMinus]; });
  let csv = `Partita;${state.teamProfile.name};${game.teamScore};-;${game.oppName || 'Avversari'};${game.oppScore}\n\n`;
  csv += headers.join(';') + '\n';
  rows.forEach(r => { csv += r.map(v => String(v).replace(/;/g, ',')).join(';') + '\n'; });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `statistiche_${state.teamProfile.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

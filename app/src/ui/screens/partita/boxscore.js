import { state } from '../../../state.js';
import { esc, fmtMin } from '../../../utils/format.js';
import { playerPtsOf } from '../../../utils/stats.js';
import { currentSport } from '../../../utils/sports/index.js';

function buildBoxScoreRows(playersArr) {
  return [...playersArr].sort((a, b) => (b.onCourt ? 1 : 0) - (a.onCourt ? 1 : 0) || (playerPtsOf(b) - playerPtsOf(a)));
}

// I parziali di periodo, comuni a tutti gli sport: dicono come si e' arrivati
// al risultato, che dal solo totale non si legge.
function periodStripHtml(game) {
  const periods = game.periodScores || [];
  if (!periods.length) return '';
  const short = currentSport().scout.period.short;
  return `<div class="period-strip" style="margin:0 0 12px;">` + periods.map((x, i) =>
    `<div class="period-chip done"><i>${short}${i + 1}</i><b>${x ? x.us + '–' + x.them : '—'}</b></div>`).join('') + `</div>`;
}

export function openBoxScoreModal(game) {
  const root = document.getElementById('modalRoot');
  // Il tabellino dettagliato esiste solo per la pallacanestro: gli altri sport
  // salvano statistiche di forma diversa e verrebbero letti come colonne vuote.
  if (currentSport().key !== 'basket') return openSimpleBoxScore(game);
  // I minuti compaiono solo se lo sport li rileva davvero: senza cronometro
  // sarebbero una colonna di zeri buona a far credere che il dato ci sia.
  const withMin = currentSport().showMinutes;
  const headers = ['#', 'Giocatore'].concat(withMin ? ['MIN'] : [])
    .concat(['PT', '2PT', '3PT', 'TL', 'RIM', 'AST', 'PR', 'PP', 'ST', 'SS', 'FC', 'FS', '+/-']);
  let rowsHtml = '';
  const sorted = buildBoxScoreRows(game.players);
  sorted.forEach(p => {
    const s = p.stats; const pm = s.plusMinus; const pmClass = pm > 0 ? 'pos' : (pm < 0 ? 'neg' : ''); const pmTxt = (pm > 0 ? '+' : '') + pm;
    rowsHtml += `<tr class="${p.onCourt ? 'on-court' : ''}"><td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td>
      ${withMin ? `<td>${fmtMin(s.seconds)}</td>` : ''}<td><b>${playerPtsOf(p)}</b></td>
      <td>${s.fgm2}/${s.fga2}</td><td>${s.fgm3}/${s.fga3}</td><td>${s.ftm}/${s.fta}</td>
      <td>${s.orb + s.drb}</td><td>${s.ast}</td><td>${s.stl}</td><td>${s.tov}</td>
      <td>${s.blk}</td><td>${s.blkAgainst}</td><td>${s.pf}</td><td>${s.pfDrawn}</td>
      <td class="plusminus ${pmClass}">${pmTxt}</td></tr>`;
  });
  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" style="max-width:96vw;width:700px;">
    <h3>${esc(state.teamProfile.name)} ${game.teamScore} — ${game.oppScore} ${esc(game.oppName || 'Avversari')}</h3>
    ${periodStripHtml(game)}
    <div class="boxscore-wrap"><table class="boxscore"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
    <div class="modal-actions"><button class="btn btn-secondary" id="csvExportBtn">⬇ CSV</button><button class="btn btn-primary" id="modalCloseBtn" style="width:auto;">Chiudi</button></div>
  </div></div>`;
  document.getElementById('modalCloseBtn').onclick = () => { root.innerHTML = ''; };
  document.getElementById('modalOverlay').onclick = (e) => { if (e.target.id === 'modalOverlay') root.innerHTML = ''; };
  document.getElementById('csvExportBtn').onclick = () => exportCsv(game);
}

// Tabellino degli sport senza colonne cestistiche: le voci le dichiara il
// descrittore, così calcio e pallavolo mostrano quello che hanno davvero
// registrato invece di venti colonne vuote.
function openSimpleBoxScore(game) {
  const sport = currentSport();
  const cols = sport.seasonColumns;
  const root = document.getElementById("modalRoot");
  const rows = [...(game.players || [])]
    .sort((a, b) => (b.onCourt ? 1 : 0) - (a.onCourt ? 1 : 0) || (playerPtsOf(b, sport) - playerPtsOf(a, sport)))
    .map(p => `<tr class="${p.onCourt ? "on-court" : ""}"><td>${esc(p.number)}</td><td class="name-cell">${esc(p.name)}</td>`
      + cols.map(col => `<td>${(sport.aggregate[col.key] ? sport.aggregate[col.key](p) : 0) || 0}</td>`).join("")
      + `</tr>`).join("");

  root.innerHTML = `<div class="modal-overlay" id="modalOverlay"><div class="modal-box" style="max-width:96vw;width:640px;">
    <h3>${esc(state.teamProfile.name)} ${game.teamScore} — ${game.oppScore} ${esc(game.oppName || "Avversari")}</h3>
    ${periodStripHtml(game)}
    ${rows
      ? `<div class="boxscore-wrap"><table class="boxscore"><thead><tr><th>#</th><th>Giocatore</th>${cols.map(col => `<th>${col.short}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>`
      : "<div class='hint'>Nessuna statistica per giocatore registrata per questa partita.</div>"}
    <div class="modal-actions"><button class="btn btn-primary" id="modalCloseBtn" style="width:100%;">Chiudi</button></div>
  </div></div>`;
  document.getElementById("modalCloseBtn").onclick = () => { root.innerHTML = ""; };
  document.getElementById("modalOverlay").onclick = (e) => { if (e.target.id === "modalOverlay") root.innerHTML = ""; };
}

function exportCsv(game) {
  const withMin = currentSport().showMinutes;
  const headers = ['Numero', 'Giocatore'].concat(withMin ? ['Minuti'] : []).concat(['Punti', '2PT Segnati', '2PT Tentati', '3PT Segnati', '3PT Tentati', 'TL Segnati', 'TL Tentati', 'Reb Off', 'Reb Dif', 'Assist', 'Palle Rubate', 'Palle Perse', 'Stoppate Fatte', 'Stoppate Subite', 'Falli Commessi', 'Falli Subiti', 'Plus Minus']);
  const rows = game.players.map(p => { const s = p.stats; return [p.number, p.name].concat(withMin ? [fmtMin(s.seconds)] : []).concat([playerPtsOf(p), s.fgm2, s.fga2, s.fgm3, s.fga3, s.ftm, s.fta, s.orb, s.drb, s.ast, s.stl, s.tov, s.blk, s.blkAgainst, s.pf, s.pfDrawn, s.plusMinus]); });
  let csv = `Partita;${state.teamProfile.name};${game.teamScore};-;${game.oppName || 'Avversari'};${game.oppScore}\n\n`;
  csv += headers.join(';') + '\n';
  rows.forEach(r => { csv += r.map(v => String(v).replace(/;/g, ',')).join(';') + '\n'; });
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `statistiche_${state.teamProfile.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

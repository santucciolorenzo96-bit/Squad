import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { openBoxScoreModal } from './partita/boxscore.js';

export function renderStoricoTab(c) {
  if (state.history.length === 0) { c.innerHTML = '<div class="placeholder-card">Nessuna partita in archivio.</div>'; return; }
  c.innerHTML = '<div id="histList"></div>';
  const holder = document.getElementById('histList');
  [...state.history].reverse().forEach(g => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const win = g.teamScore > g.oppScore;
    row.innerHTML = `<div class="top"><span>${esc(state.teamProfile.name)} vs ${esc(g.oppName)}</span><span class="history-score" style="color:${win ? 'var(--green)' : 'var(--red)'}">${g.teamScore}–${g.oppScore}</span></div>
      <div class="date">${new Date(g.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>`;
    row.onclick = () => openBoxScoreModal(g);
    holder.appendChild(row);
  });
}

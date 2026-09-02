import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast } from '../modal.js';
import { upsertStanding, removeStanding } from '../../api/standings.js';
import { canEditHome } from '../../utils/permissions.js';
import { currentSport } from '../../utils/sports/index.js';
import { openBoxScoreModal } from './partita/boxscore.js';

export function renderClassificaTab(c) {
  const canEdit = canEditHome(state.currentUser);
  const sport = currentSport();
  const st = sport.standings;
  c.innerHTML = `
    ${canEdit ? `<div class="card"><button class="btn btn-secondary" id="addStandingBtn" style="width:100%;">+ Aggiungi squadra</button></div>` : ''}
    <div id="standingsHolder"></div>
    ${state.standings.length === 0 ? `<div class="placeholder-card">Nessuna classifica inserita.${canEdit ? ' Aggiungila manualmente qui, oppure attendi il caricamento automatico dal calendario (Fase 3).' : ''}</div>` : ''}
    <div class="section-label" style="margin-top:22px;">Storico partite</div>
    <div id="histList"></div>
  `;
  drawHistory();

  function drawHistory() {
    const holder = document.getElementById('histList');
    if (state.history.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessuna partita in archivio.</div>'; return; }
    holder.innerHTML = '';
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
  function draw() {
    const holder = document.getElementById('standingsHolder');
    if (!holder) return;
    if (state.standings.length === 0) { holder.innerHTML = ''; return; }
    const sorted = [...state.standings].sort((a, b) => b.points - a.points);
    let rows = '';
    sorted.forEach((r, i) => {
      const extras = st.extras.map(e => `<td>${(r.stats && r.stats[e.key]) != null ? r.stats[e.key] : 0}</td>`).join('');
      rows += `<tr class="${r.is_us ? 'on-court' : ''}"><td>${i + 1}</td><td class="name-cell">${r.is_us ? '<b>' : ''}${esc(r.team_name)}${r.is_us ? '</b>' : ''}</td>
        <td>${r.played}</td><td>${r.wins}</td>${st.hasDraws ? `<td>${r.draws || 0}</td>` : ''}<td>${r.losses}</td>${extras}<td><b>${r.points}</b></td>
        ${canEdit ? `<td><button class="icon-btn" data-edit="${r.id}">✎</button><button class="icon-btn danger" data-rm="${r.id}">✕</button></td>` : ''}</tr>`;
    });
    const head = `<th>#</th><th>Squadra</th><th>G</th><th>${st.winLabel}</th>${st.hasDraws ? `<th>${st.drawLabel}</th>` : ''}<th>${st.lossLabel}</th>`
      + st.extras.map(e => `<th>${e.short}</th>`).join('') + '<th>PT</th>';
    holder.innerHTML = `<div class="boxscore-wrap"><table class="boxscore"><thead><tr>${head}${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`
      + `<div class="hint">${st.pointsHint}</div>`;
    if (canEdit) {
      holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openStandingModal(state.standings.find(r => r.id === btn.getAttribute('data-edit'))));
      holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
        confirmModal('Rimuovere squadra dalla classifica?', '', async () => {
          await removeStanding(btn.getAttribute('data-rm'));
          state.standings = state.standings.filter(r => r.id !== btn.getAttribute('data-rm'));
          draw();
        }, 'Rimuovi');
      });
    }
  }
  draw();
  const addBtn = document.getElementById('addStandingBtn');
  if (addBtn) addBtn.onclick = () => openStandingModal(null);

  function openStandingModal(existing) {
    formModal(existing ? 'Modifica squadra' : 'Aggiungi squadra', `
      <div class="field"><label>Nome squadra</label><input type="text" id="stTeam" value="${existing ? esc(existing.team_name) : esc(state.teamProfile.name)}"></div>
      <div class="row2">
        <div class="field"><label>Giocate</label><input type="number" id="stPlayed" value="${existing ? existing.played : 0}" min="0"></div>
        <div class="field"><label>Punti</label><input type="number" id="stPoints" value="${existing ? existing.points : 0}" min="0"></div>
      </div>
      <div class="${st.hasDraws ? 'row3' : 'row2'}">
        <div class="field"><label>Vittorie</label><input type="number" id="stWins" value="${existing ? existing.wins : 0}" min="0"></div>
        ${st.hasDraws ? `<div class="field"><label>Pareggi</label><input type="number" id="stDraws" value="${existing ? (existing.draws || 0) : 0}" min="0"></div>` : ''}
        <div class="field"><label>Sconfitte</label><input type="number" id="stLosses" value="${existing ? existing.losses : 0}" min="0"></div>
      </div>
      ${st.extras.length ? `<div class="row2">${st.extras.map(e => `<div class="field"><label>${e.label}</label><input type="number" id="stX_${e.key}" value="${existing && existing.stats ? (existing.stats[e.key] || 0) : 0}" min="0"></div>`).join('')}</div>` : ''}
      <div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="stIsUs" ${existing && existing.is_us ? 'checked' : ''} style="width:auto;"> È la nostra squadra</label></div>
    `, async () => {
      const team_name = document.getElementById('stTeam').value.trim();
      if (!team_name) return 'Inserisci il nome della squadra.';
      const is_us = document.getElementById('stIsUs').checked;
      const stats = {};
      st.extras.forEach(e => {
        const el = document.getElementById('stX_' + e.key);
        stats[e.key] = el ? (parseInt(el.value) || 0) : 0;
      });
      const drawsEl = document.getElementById('stDraws');
      const data = {
        team_name, played: parseInt(document.getElementById('stPlayed').value) || 0,
        wins: parseInt(document.getElementById('stWins').value) || 0,
        draws: drawsEl ? (parseInt(drawsEl.value) || 0) : 0,
        losses: parseInt(document.getElementById('stLosses').value) || 0,
        points: parseInt(document.getElementById('stPoints').value) || 0, is_us, stats
      };
      if (is_us) state.standings.forEach(r => r.is_us = false);
      if (existing) {
        await upsertStanding(state.teamProfile.id, state.activeSectorId, { id: existing.id, ...data });
        Object.assign(existing, data);
      } else {
        await upsertStanding(state.teamProfile.id, state.activeSectorId, data);
        const { fetchStandings } = await import('../../api/standings.js');
        state.standings = await fetchStandings(state.activeSectorId);
      }
      draw();
      toast('Classifica aggiornata');
    });
  }
}

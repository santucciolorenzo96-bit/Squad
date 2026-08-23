import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast } from '../modal.js';
import { upsertStanding, removeStanding } from '../../api/standings.js';

export function renderClassificaTab(c) {
  const canEdit = state.currentUser.role === 'admin' || state.currentUser.role === 'allenatore';
  c.innerHTML = `
    ${canEdit ? `<div class="card"><button class="btn btn-secondary" id="addStandingBtn" style="width:100%;">+ Aggiungi squadra</button></div>` : ''}
    <div id="standingsHolder"></div>
    ${state.standings.length === 0 ? `<div class="placeholder-card">Nessuna classifica inserita.${canEdit ? ' Aggiungila manualmente qui, oppure attendi il caricamento automatico dal calendario (Fase 3).' : ''}</div>` : ''}
  `;
  function draw() {
    const holder = document.getElementById('standingsHolder');
    if (!holder) return;
    if (state.standings.length === 0) { holder.innerHTML = ''; return; }
    const sorted = [...state.standings].sort((a, b) => b.points - a.points);
    let rows = '';
    sorted.forEach((r, i) => {
      rows += `<tr class="${r.is_us ? 'on-court' : ''}"><td>${i + 1}</td><td class="name-cell">${r.is_us ? '<b>' : ''}${esc(r.team_name)}${r.is_us ? '</b>' : ''}</td>
        <td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td><b>${r.points}</b></td>
        ${canEdit ? `<td><button class="icon-btn" data-edit="${r.id}">✎</button><button class="icon-btn danger" data-rm="${r.id}">✕</button></td>` : ''}</tr>`;
    });
    holder.innerHTML = `<div class="boxscore-wrap"><table class="boxscore"><thead><tr><th>#</th><th>Squadra</th><th>G</th><th>V</th><th>S</th><th>PT</th>${canEdit ? '<th></th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
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
      <div class="row2">
        <div class="field"><label>Vittorie</label><input type="number" id="stWins" value="${existing ? existing.wins : 0}" min="0"></div>
        <div class="field"><label>Sconfitte</label><input type="number" id="stLosses" value="${existing ? existing.losses : 0}" min="0"></div>
      </div>
      <div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="stIsUs" ${existing && existing.is_us ? 'checked' : ''} style="width:auto;"> È la nostra squadra</label></div>
    `, async () => {
      const team_name = document.getElementById('stTeam').value.trim();
      if (!team_name) return 'Inserisci il nome della squadra.';
      const is_us = document.getElementById('stIsUs').checked;
      const data = {
        team_name, played: parseInt(document.getElementById('stPlayed').value) || 0,
        wins: parseInt(document.getElementById('stWins').value) || 0,
        losses: parseInt(document.getElementById('stLosses').value) || 0,
        points: parseInt(document.getElementById('stPoints').value) || 0, is_us
      };
      if (is_us) state.standings.forEach(r => r.is_us = false);
      if (existing) {
        await upsertStanding(state.teamProfile.id, { id: existing.id, ...data });
        Object.assign(existing, data);
      } else {
        await upsertStanding(state.teamProfile.id, data);
        const { fetchStandings } = await import('../../api/standings.js');
        state.standings = await fetchStandings(state.teamProfile.id);
      }
      draw();
      toast('Classifica aggiornata');
    });
  }
}

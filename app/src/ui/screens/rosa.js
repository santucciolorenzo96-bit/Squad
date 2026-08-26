import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { confirmModal, toast } from '../modal.js';
import { addPlayer, removePlayerFromSector, fetchPlayerPhotoUrls } from '../../api/roster.js';
import { canEditRoster } from '../../utils/permissions.js';
import { avatarHtml, wireAvatarClicks } from '../playerAvatar.js';

export async function renderRosaTab(c) {
  const canEdit = canEditRoster(state.currentUser);
  c.innerHTML = `
    ${canEdit ? `
    <div class="card">
      <h2>Aggiungi giocatore</h2>
      <div class="player-add-row">
        <input type="text" id="rNum" placeholder="N°" inputmode="numeric">
        <input type="text" id="rName" placeholder="Nome giocatore">
        <button class="btn btn-secondary" id="rAdd">+ Aggiungi</button>
      </div>
      <div class="hint">Per dati anagrafici e certificato medico vai su Anagrafica.</div>
    </div>` : ''}
    <div class="section-label" id="rosaCountLabel">Rosa (${state.roster.length})</div>
    <div id="rosterList"></div>
    <div id="rosaHint">${canEdit && state.roster.length < 5 ? `<div class="hint">Servono almeno 5 giocatori in rosa per poter avviare una partita.</div>` : ''}</div>
  `;
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));

  function drawList() {
    document.getElementById('rosaCountLabel').textContent = `Rosa (${state.roster.length})`;
    const hintEl = document.getElementById('rosaHint');
    if (hintEl) hintEl.innerHTML = canEdit && state.roster.length < 5 ? `<div class="hint">Servono almeno 5 giocatori in rosa per poter avviare una partita.</div>` : '';
    const holder = document.getElementById('rosterList');
    holder.innerHTML = '';
    if (state.roster.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giocatore in rosa.</div>'; return; }
    state.roster.forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 36)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div>${canEdit ? `<button class="icon-btn danger" data-rm="${p.id}">✕</button>` : ''}`;
      holder.appendChild(row);
    });
    wireAvatarClicks(holder, photoUrls);
    if (!canEdit) return;
    holder.querySelectorAll('[data-rm]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-rm');
        const pl = state.roster.find(x => x.id === id);
        confirmModal('Rimuovere giocatore dal settore?', `#${pl.number} ${pl.name} verrà rimosso dalla rosa di questo settore (resta nell'anagrafica e negli altri settori in cui è eventualmente rosterizzato).`, async () => {
          await removePlayerFromSector(id, state.activeSectorId);
          state.roster = state.roster.filter(x => x.id !== id);
          drawList();
        }, 'Rimuovi');
      };
    });
  }
  drawList();
  if (!canEdit) return;
  document.getElementById('rAdd').onclick = async () => {
    const numIn = document.getElementById('rNum'), nameIn = document.getElementById('rName');
    const num = numIn.value.trim(), name = nameIn.value.trim();
    if (!name) { toast('Inserisci il nome del giocatore'); return; }
    const created = await addPlayer(state.teamProfile.id, state.activeSectorId, num || '-', name);
    state.roster.push(created);
    numIn.value = ''; nameIn.value = ''; numIn.focus();
    drawList();
  };
  document.getElementById('rName').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('rAdd').click(); });
}

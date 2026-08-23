import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { confirmModal, toast } from '../modal.js';
import { addPlayer, removePlayer } from '../../api/roster.js';

export function renderRosaTab(c) {
  c.innerHTML = `
    <div class="card">
      <h2>Aggiungi giocatore</h2>
      <div class="player-add-row">
        <input type="text" id="rNum" placeholder="N°" inputmode="numeric">
        <input type="text" id="rName" placeholder="Nome giocatore">
        <button class="btn btn-secondary" id="rAdd">+ Aggiungi</button>
      </div>
    </div>
    <div class="section-label">Rosa (${state.roster.length})</div>
    <div id="rosterList"></div>
    ${state.roster.length < 5 ? `<div class="hint">Servono almeno 5 giocatori in rosa per poter avviare una partita.</div>` : ''}
  `;
  function drawList() {
    const holder = document.getElementById('rosterList');
    holder.innerHTML = '';
    if (state.roster.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giocatore in rosa.</div>'; return; }
    state.roster.forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `<div class="jersey-num">${esc(p.number)}</div><div class="main"><div class="nm">${esc(p.name)}</div></div><button class="icon-btn danger" data-rm="${p.id}">✕</button>`;
      holder.appendChild(row);
    });
    holder.querySelectorAll('[data-rm]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-rm');
        const pl = state.roster.find(x => x.id === id);
        confirmModal('Rimuovere giocatore?', `#${pl.number} ${pl.name} verrà rimosso dalla rosa (le statistiche delle partite già giocate restano).`, async () => {
          await removePlayer(id);
          state.roster = state.roster.filter(x => x.id !== id);
          drawList();
        }, 'Rimuovi');
      };
    });
  }
  drawList();
  document.getElementById('rAdd').onclick = async () => {
    const numIn = document.getElementById('rNum'), nameIn = document.getElementById('rName');
    const num = numIn.value.trim(), name = nameIn.value.trim();
    if (!name) { toast('Inserisci il nome del giocatore'); return; }
    const created = await addPlayer(state.teamProfile.id, num || '-', name);
    state.roster.push(created);
    numIn.value = ''; nameIn.value = ''; numIn.focus();
    drawList();
  };
  document.getElementById('rName').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('rAdd').click(); });
}

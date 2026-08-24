import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast } from '../modal.js';
import { addTraining, updateTraining, removeTraining } from '../../api/trainings.js';
import { canEditHome } from '../../utils/permissions.js';

export function renderAllenamentiTab(c) {
  const canEdit = canEditHome(state.currentUser);
  c.innerHTML = `
    ${canEdit ? `<div class="card"><button class="btn btn-secondary" id="addTrainingBtn" style="width:100%;">+ Nuovo allenamento</button></div>` : ''}
    <div class="section-label">Allenamenti</div>
    <div id="trainingList"></div>
  `;
  function draw() {
    const holder = document.getElementById('trainingList');
    if (state.trainings.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun allenamento in programma.</div>'; return; }
    holder.innerHTML = '';
    [...state.trainings].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '14px';
      row.innerHTML = `
        <div style="width:44px;height:44px;border-radius:11px;background:rgba(255,255,255,0.05);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-mono);flex-shrink:0;">
          <span style="font-size:9px;color:var(--dim);">${new Date(t.date).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}</span>
          <span style="font-size:15px;font-weight:700;">${new Date(t.date).getDate()}</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${esc(t.title)}</div>
          <div class="hint">${t.start_time || ''}${t.end_time ? '–' + t.end_time : ''}${t.location ? ' · ' + esc(t.location) : ''}</div>
        </div>
        ${canEdit ? `<button class="icon-btn" data-edit="${t.id}">✎</button><button class="icon-btn danger" data-rm="${t.id}">✕</button>` : ''}
      `;
      holder.appendChild(row);
    });
    if (!canEdit) return;
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openModal(state.trainings.find(t => t.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      confirmModal('Rimuovere allenamento?', '', async () => {
        await removeTraining(btn.getAttribute('data-rm'));
        state.trainings = state.trainings.filter(t => t.id !== btn.getAttribute('data-rm'));
        draw();
      }, 'Rimuovi');
    });
  }
  draw();
  const addBtn = document.getElementById('addTrainingBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    formModal(existing ? 'Modifica allenamento' : 'Nuovo allenamento', `
      <div class="field"><label>Titolo</label><input type="text" id="tTitle" value="${existing ? esc(existing.title) : 'Allenamento'}"></div>
      <div class="field"><label>Data</label><input type="date" id="tDate" value="${existing ? existing.date : ''}"></div>
      <div class="row2">
        <div class="field"><label>Orario inizio</label><input type="text" id="tStart" placeholder="19:00" value="${existing ? esc(existing.start_time || '') : ''}"></div>
        <div class="field"><label>Orario fine</label><input type="text" id="tEnd" placeholder="20:30" value="${existing ? esc(existing.end_time || '') : ''}"></div>
      </div>
      <div class="field"><label>Luogo</label><input type="text" id="tLoc" value="${existing ? esc(existing.location || '') : ''}"></div>
    `, async () => {
      const title = document.getElementById('tTitle').value.trim() || 'Allenamento';
      const date = document.getElementById('tDate').value;
      if (!date) return 'Inserisci la data.';
      const data = {
        title, date,
        start_time: document.getElementById('tStart').value.trim() || null,
        end_time: document.getElementById('tEnd').value.trim() || null,
        location: document.getElementById('tLoc').value.trim() || null
      };
      if (existing) {
        const updated = await updateTraining(existing.id, data);
        Object.assign(existing, updated);
      } else {
        const created = await addTraining(state.teamProfile.id, state.activeSectorId, data);
        state.trainings.push(created);
      }
      draw();
      toast('Allenamento salvato');
    });
  }
}

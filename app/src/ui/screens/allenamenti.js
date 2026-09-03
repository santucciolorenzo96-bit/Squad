import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast } from '../modal.js';
import { addTraining, updateTraining, removeTraining } from '../../api/trainings.js';
import {
  WEEKDAY_LABELS, createRecurrence, updateRecurrence, removeRecurrence, ensureOccurrencesGenerated
} from '../../api/trainingRecurrences.js';
import { fetchAttendance, setAttendance } from '../../api/attendance.js';
import { fetchPlayerPhotoUrls } from '../../api/roster.js';
import { avatarHtml, wireAvatarClicks } from '../playerAvatar.js';
import { canEditHome } from '../../utils/permissions.js';
import { pinIcon, repeatIcon, peopleIcon } from '../icons.js';

export function renderAllenamentiTab(c) {
  const canEdit = canEditHome(state.currentUser);
  c.innerHTML = `
    ${canEdit ? `
    <div class="section-label">Programma settimanale</div>
    <div id="recurrenceList"></div>
    <div class="card"><button class="btn btn-secondary" id="addRecurrenceBtn" style="width:100%;">+ Nuovo giorno fisso</button></div>
    <div class="card"><button class="btn btn-primary" id="addTrainingBtn" style="width:100%;">+ Allenamento straordinario</button></div>
    ` : ''}
    <div class="section-label">Allenamenti</div>
    <div id="trainingList"></div>
  `;

  drawRecurrences();
  drawTrainings();

  if (canEdit) {
    document.getElementById('addRecurrenceBtn').onclick = () => openRecurrenceModal(null);
    document.getElementById('addTrainingBtn').onclick = () => openTrainingModal(null);
    generateAndRefresh();
  }

  async function generateAndRefresh() {
    try {
      const created = await ensureOccurrencesGenerated(state.teamProfile.id, state.activeSectorId, state.trainingRecurrences, state.trainings);
      if (created.length > 0) {
        state.trainings = state.trainings.concat(created);
        drawTrainings();
      }
    } catch (e) { /* silenzioso: non blocca la schermata */ }
  }

  function drawRecurrences() {
    const holder = document.getElementById('recurrenceList');
    if (!holder) return;
    if (state.trainingRecurrences.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giorno fisso impostato: gli allenamenti settimanali ricorrenti (es. "martedì alle 20:00") vanno qui.</div>'; return; }
    holder.innerHTML = '';
    [...state.trainingRecurrences].sort((a, b) => a.weekday - b.weekday).forEach(r => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `
        <div class="main">
          <div class="nm">${WEEKDAY_LABELS[r.weekday]}${!r.active ? ' <span class="hint">(sospeso)</span>' : ''}</div>
          <div class="sub">${r.start_time || '?'}${r.end_time ? '–' + r.end_time : ''}${r.location ? ' · ' + esc(r.location) : ''}</div>
        </div>
        <button class="icon-btn" data-edit="${r.id}">✎</button>
        <button class="icon-btn danger" data-rm="${r.id}">✕</button>
      `;
      holder.appendChild(row);
    });
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openRecurrenceModal(state.trainingRecurrences.find(r => r.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      const r = state.trainingRecurrences.find(x => x.id === btn.getAttribute('data-rm'));
      confirmModal('Rimuovere il programma fisso?', `${WEEKDAY_LABELS[r.weekday]} ${r.start_time || ''} verrà rimosso. Gli allenamenti già generati restano nel calendario ma non verranno più rinnovati.`, async () => {
        await removeRecurrence(r.id);
        state.trainingRecurrences = state.trainingRecurrences.filter(x => x.id !== r.id);
        drawRecurrences();
        toast('Programma rimosso');
      }, 'Rimuovi');
    });
  }

  function openRecurrenceModal(existing) {
    formModal(existing ? 'Modifica giorno fisso' : 'Nuovo giorno fisso', `
      <div class="field"><label>Giorno della settimana</label>
        <select id="rcDay">${WEEKDAY_LABELS.map((lbl, i) => `<option value="${i}" ${existing && existing.weekday === i ? 'selected' : ''}>${lbl}</option>`).join('')}</select>
      </div>
      <div class="row2">
        <div class="field"><label>Ora inizio</label><input type="text" id="rcStart" placeholder="20:00" value="${existing ? esc(existing.start_time || '') : ''}"></div>
        <div class="field"><label>Ora fine</label><input type="text" id="rcEnd" placeholder="21:30" value="${existing ? esc(existing.end_time || '') : ''}"></div>
      </div>
      <div class="field"><label>Luogo</label><input type="text" id="rcLoc" value="${existing ? esc(existing.location || '') : ''}"></div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="rcActive" ${existing.active ? 'checked' : ''} style="width:auto;"> Programma attivo</label></div>` : ''}
      <div class="hint">Genera automaticamente gli allenamenti per le prossime settimane, fino a un cambiamento.</div>
    `, async () => {
      const patch = {
        weekday: parseInt(document.getElementById('rcDay').value, 10),
        start_time: document.getElementById('rcStart').value.trim() || null,
        end_time: document.getElementById('rcEnd').value.trim() || null,
        location: document.getElementById('rcLoc').value.trim() || null
      };
      if (existing) {
        patch.active = document.getElementById('rcActive').checked;
        const updated = await updateRecurrence(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const created = await createRecurrence(state.teamProfile.id, state.activeSectorId, patch);
        state.trainingRecurrences.push(created);
      }
      drawRecurrences();
      await generateAndRefresh();
      toast('Programma salvato');
    });
  }

  function drawTrainings() {
    const holder = document.getElementById('trainingList');
    if (!holder) return;
    if (state.trainings.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun allenamento in programma.</div>'; return; }
    holder.innerHTML = '';
    [...state.trainings].sort((a, b) => a.date.localeCompare(b.date)).forEach(t => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '14px';
      row.innerHTML = `
        <div style="width:44px;height:44px;border-radius:11px;background:var(--tint);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-mono);flex-shrink:0;">
          <span style="font-size:9px;color:var(--dim);">${new Date(t.date).toLocaleDateString('it-IT', { month: 'short' }).toUpperCase()}</span>
          <span style="font-size:15px;font-weight:700;">${new Date(t.date).getDate()}</span>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${esc(t.title)}</div>
          <div class="hint">${t.start_time || ''}${t.end_time ? '–' + t.end_time : ''}${t.recurrence_id ? ` · <span title="Generato dal programma fisso">${repeatIcon()}</span>` : ''}</div>
          ${t.location ? `<div style="font-size:12.5px;font-weight:600;color:var(--text);margin-top:2px;">${pinIcon()} ${esc(t.location)}</div>` : ''}
        </div>
        ${canEdit ? `<button class="icon-btn" data-att="${t.id}" title="Presenze">${peopleIcon(17)}</button><button class="icon-btn" data-edit="${t.id}">✎</button><button class="icon-btn danger" data-rm="${t.id}">✕</button>` : ''}
      `;
      holder.appendChild(row);
    });
    if (!canEdit) return;
    holder.querySelectorAll('[data-att]').forEach(btn => btn.onclick = () => openAttendancePanel(state.trainings.find(t => t.id === btn.getAttribute('data-att'))));
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openTrainingModal(state.trainings.find(t => t.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      confirmModal('Rimuovere allenamento?', '', async () => {
        await removeTraining(btn.getAttribute('data-rm'));
        state.trainings = state.trainings.filter(t => t.id !== btn.getAttribute('data-rm'));
        drawTrainings();
      }, 'Rimuovi');
    });
  }

  function openTrainingModal(existing) {
    formModal(existing ? 'Modifica allenamento' : 'Nuovo allenamento straordinario', `
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
        const created = await addTraining(state.teamProfile.id, state.activeSectorId, data, state.activeSeasonId);
        state.trainings.push(created);
      }
      drawTrainings();
      toast('Allenamento salvato');
    });
  }

  async function openAttendancePanel(training) {
    const modalRoot = document.getElementById('modalRoot');
    modalRoot.innerHTML = `<div class="modal-overlay" id="attOverlay"><div class="modal-box wide">
      <h3>Presenze</h3>
      <p>${esc(training.title)} · ${new Date(training.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <div id="attList"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>
      <div class="modal-actions"><button class="btn btn-secondary" id="attClose" style="width:100%;">Chiudi</button></div>
    </div></div>`;
    document.getElementById('attOverlay').onclick = (e) => { if (e.target.id === 'attOverlay') modalRoot.innerHTML = ''; };
    document.getElementById('attClose').onclick = () => { modalRoot.innerHTML = ''; };

    const attendance = await fetchAttendance(training.id);
    const byPlayer = {};
    attendance.forEach(a => { byPlayer[a.player_id] = a.status; });

    const holder = document.getElementById('attList');
    if (!holder) return; // modale chiusa nel frattempo
    if (state.roster.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giocatore in rosa.</div>'; return; }
    const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
    holder.innerHTML = '';
    const STATUSES = [
      { key: 'present', label: 'Presente', cls: 'made' },
      { key: 'absent', label: 'Assente', cls: 'miss' },
      { key: 'excused', label: 'Giustificato', cls: 'neutral' }
    ];
    state.roster.forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 32)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div>
        <div style="display:flex;gap:4px;" data-player="${p.id}">
          ${STATUSES.map(s => `<button class="stat-btn ${s.cls}" data-status="${s.key}" style="padding:6px 9px;font-size:10.5px;opacity:${byPlayer[p.id] === s.key ? '1' : '0.4'};">${s.label}</button>`).join('')}
        </div>`;
      holder.appendChild(row);
      wireAvatarClicks(row, photoUrls);
      row.querySelectorAll('[data-status]').forEach(btn => btn.onclick = async () => {
        const status = btn.getAttribute('data-status');
        row.querySelectorAll('[data-status]').forEach(b => b.style.opacity = b === btn ? '1' : '0.4');
        try { await setAttendance(training.id, p.id, status); }
        catch (e) { toast('Errore nel salvataggio presenza'); }
      });
    });
  }
}

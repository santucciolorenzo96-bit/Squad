import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { canEditHome, isLinkedUser } from '../../utils/permissions.js';
import { formModal, confirmModal, toast, showLoadError, withButtonLoading } from '../modal.js';
import {
  fetchCommunications, fetchMyCommunications, createCommunication,
  closeCommunication, removeCommunication, respondToCommunication
} from '../../api/communications.js';
import { pinIcon } from '../icons.js';

const KIND_LABEL = { convocazione: 'Convocazione', trasferta: 'Trasferta', avviso: 'Avviso' };

function fmtDay(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
}

function tally(recipients) {
  const t = { total: recipients.length, confirmed: 0, declined: 0, pending: 0 };
  recipients.forEach(r => { t[r.status === 'confirmed' ? 'confirmed' : r.status === 'declined' ? 'declined' : 'pending']++; });
  return t;
}

export function renderComunicazioniTab(c) {
  return isLinkedUser(state.currentUser) ? renderFamilyView(c) : renderStaffView(c);
}

/* ===================== Vista staff: convoca e monitora ===================== */
async function renderStaffView(c) {
  const canEdit = canEditHome(state.currentUser);
  c.innerHTML = `
    <div class="settings-col">
      ${canEdit ? `<div class="card"><button class="btn btn-primary" id="newCommBtn" style="width:100%;">+ Nuova convocazione</button></div>` : ''}
      <div id="commList"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>
    </div>
  `;
  const addBtn = document.getElementById('newCommBtn');
  if (addBtn) addBtn.onclick = () => openCreateModal(c);

  const holder = document.getElementById('commList');
  let comms;
  try {
    comms = await fetchCommunications(state.activeSectorId);
  } catch (e) {
    showLoadError(holder, e, 'le comunicazioni');
    return;
  }
  if (comms.length === 0) {
    holder.innerHTML = '<div class="placeholder-card">Nessuna comunicazione inviata per questo settore.</div>';
    return;
  }

  holder.innerHTML = '';
  comms.forEach(comm => {
    const t = tally(comm.communication_recipients || []);
    const card = document.createElement('div');
    card.className = 'card panel-link';
    card.innerHTML = `
      <div class="comm-head">
        <div style="min-width:0;">
          <div class="comm-kind">${esc(KIND_LABEL[comm.kind] || comm.kind)}${comm.closed_at ? ' · chiusa' : ''}</div>
          <div class="comm-title">${esc(comm.title)}</div>
          <div class="hint" style="margin-top:2px;">
            ${comm.event_date ? esc(fmtDay(comm.event_date)) : ''}${comm.start_time ? ' · ' + esc(comm.start_time) : ''}${comm.location ? ' · ' + esc(comm.location) : ''}
          </div>
        </div>
      </div>
      ${comm.requires_response ? `
        <div class="comm-tally">
          <span class="att-pill present">${t.confirmed}</span>
          <span class="att-pill absent">${t.declined}</span>
          <span class="att-pill pendingp">${t.pending}</span>
          <span class="hint" style="margin:0;">confermati · rifiutati · in attesa (su ${t.total})</span>
        </div>
        <div class="comm-bar"><span style="width:${t.total ? Math.round(t.confirmed / t.total * 100) : 0}%"></span></div>
      ` : `<div class="hint">${t.total} destinatari · nessuna risposta richiesta</div>`}
    `;
    card.onclick = () => openDetail(c, comm);
    holder.appendChild(card);
  });
}

function openDetail(c, comm) {
  const canEdit = canEditHome(state.currentUser);
  const byId = {};
  (comm.communication_recipients || []).forEach(r => { byId[r.player_id] = r; });
  const rows = state.roster
    .filter(p => byId[p.id])
    .map(p => ({ player: p, r: byId[p.id] }));

  const statusLabel = { confirmed: 'Confermato', declined: 'Rifiutato', pending: 'In attesa' };
  const statusCls = { confirmed: 'ok', declined: 'rejected', pending: 'pending' };

  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="commOverlay"><div class="modal-box wide">
    <h3>${esc(comm.title)}</h3>
    <p>${comm.event_date ? esc(fmtDay(comm.event_date)) : ''}${comm.meet_time ? ` · ritrovo ${esc(comm.meet_time)}` : ''}${comm.start_time ? ` · inizio ${esc(comm.start_time)}` : ''}${comm.location ? `<br>${pinIcon()} ${esc(comm.location)}` : ''}</p>
    ${comm.body ? `<div class="hint" style="margin-bottom:10px;">${esc(comm.body)}</div>` : ''}
    <div class="section-label" style="margin-top:4px;">Convocati (${rows.length})</div>
    <div>${rows.map(({ player, r }) => `
      <div class="list-row">
        <div class="main">
          <div class="nm">#${esc(player.number)} ${esc(player.name)}</div>
          ${r.note ? `<div class="sub">${esc(r.note)}</div>` : ''}
        </div>
        <span class="status-badge ${statusCls[r.status]}">${statusLabel[r.status]}</span>
      </div>`).join('') || '<div class="hint">Nessun convocato ancora in rosa.</div>'}</div>
    <div class="modal-actions">
      ${canEdit && !comm.closed_at ? '<button class="btn btn-secondary" id="commClose" style="flex:1;">Chiudi risposte</button>' : ''}
      ${canEdit ? '<button class="btn btn-danger" id="commDelete" style="flex:1;">Elimina</button>' : ''}
      <button class="btn btn-ghost" id="commDismiss" style="flex:1;">Chiudi</button>
    </div>
  </div></div>`;

  const close = () => { root.innerHTML = ''; };
  document.getElementById('commOverlay').onclick = (e) => { if (e.target.id === 'commOverlay') close(); };
  document.getElementById('commDismiss').onclick = close;

  const closeBtn = document.getElementById('commClose');
  if (closeBtn) closeBtn.onclick = () => confirmModal(
    'Chiudere le risposte?',
    'Nessuno potrà più confermare o rifiutare. Le risposte già date restano.',
    async () => { await closeCommunication(comm.id); toast('Risposte chiuse'); renderStaffView(c); },
    'Chiudi risposte'
  );

  const delBtn = document.getElementById('commDelete');
  if (delBtn) delBtn.onclick = () => confirmModal(
    'Eliminare la comunicazione?',
    'Sparirà anche l\'elenco delle risposte raccolte. Operazione irreversibile.',
    async () => { await removeCommunication(comm.id); toast('Comunicazione eliminata'); renderStaffView(c); },
    'Elimina'
  );
}

function openCreateModal(c) {
  if (state.roster.length === 0) { toast('Nessun giocatore in rosa in questo settore'); return; }
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...state.calendar]
    .filter(m => !m.played && (!m.date || m.date >= today))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .slice(0, 6);

  formModal('Nuova comunicazione', `
    <div class="field"><label>Tipo</label>
      <select id="cKind">
        <option value="convocazione">Convocazione</option>
        <option value="trasferta">Trasferta</option>
        <option value="avviso">Avviso</option>
      </select>
    </div>
    ${upcoming.length ? `
    <div class="field"><label>Riferita a una partita</label>
      <select id="cMatch">
        <option value="">— nessuna —</option>
        ${upcoming.map((m, i) => `<option value="${i}">${esc(m.opponent)}${m.date ? ' · ' + new Date(m.date).toLocaleDateString('it-IT') : ''}</option>`).join('')}
      </select>
      <div class="hint">Sceglierla compila data, orario e luogo.</div>
    </div>` : ''}
    <div class="field"><label>Titolo</label><input type="text" id="cTitle" placeholder="Es. U15 — partita con Rookies"></div>
    <div class="field"><label>Data</label><input type="date" id="cDate"></div>
    <div class="row2">
      <div class="field"><label>Ritrovo</label><input type="text" id="cMeet" placeholder="14:00"></div>
      <div class="field"><label>Inizio</label><input type="text" id="cStart" placeholder="15:00"></div>
    </div>
    <div class="field"><label>Luogo</label><input type="text" id="cLoc"></div>
    <div class="field"><label>Note</label><input type="text" id="cBody" placeholder="Facoltative"></div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;">
      <input type="checkbox" id="cAsk" checked style="width:auto;"> Richiedi conferma ai genitori
    </label></div>
    <div class="field"><label>Entro il</label><input type="date" id="cBy"></div>
    <div class="field">
      <label>Convocati <button type="button" id="cAll" class="file-btn" style="float:right;padding:2px 8px;font-size:11px;">Tutti / nessuno</button></label>
      <div id="cPlayers" style="max-height:190px;overflow-y:auto;">
        ${state.roster.map(p => `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <input type="checkbox" data-p="${p.id}" checked style="width:auto;"> #${esc(p.number)} ${esc(p.name)}
        </label>`).join('')}
      </div>
    </div>
  `, async () => {
    const title = document.getElementById('cTitle').value.trim();
    if (!title) return 'Inserisci un titolo.';
    const ids = Array.from(document.querySelectorAll('#cPlayers [data-p]:checked')).map(el => el.getAttribute('data-p'));
    if (ids.length === 0) return 'Seleziona almeno un convocato.';
    await createCommunication(state.teamProfile.id, state.activeSectorId, {
      kind: document.getElementById('cKind').value,
      title,
      body: document.getElementById('cBody').value.trim() || null,
      event_date: document.getElementById('cDate').value || null,
      meet_time: document.getElementById('cMeet').value.trim() || null,
      start_time: document.getElementById('cStart').value.trim() || null,
      location: document.getElementById('cLoc').value.trim() || null,
      requires_response: document.getElementById('cAsk').checked,
      respond_by: document.getElementById('cBy').value || null
    }, ids, state.currentUser.id);
    toast('Comunicazione inviata');
    renderStaffView(c);
  });

  const allBtn = document.getElementById('cAll');
  allBtn.onclick = () => {
    const boxes = Array.from(document.querySelectorAll('#cPlayers [data-p]'));
    const allOn = boxes.every(b => b.checked);
    boxes.forEach(b => { b.checked = !allOn; });
  };

  const matchSel = document.getElementById('cMatch');
  if (matchSel) matchSel.onchange = () => {
    const m = upcoming[parseInt(matchSel.value, 10)];
    if (!m) return;
    document.getElementById('cTitle').value = `${sectorLabel()} — ${m.home === false ? 'trasferta con' : 'partita con'} ${m.opponent}`;
    if (m.date) document.getElementById('cDate').value = m.date;
    if (m.time) document.getElementById('cStart').value = m.time;
    if (m.location) document.getElementById('cLoc').value = m.location;
    document.getElementById('cKind').value = m.home === false ? 'trasferta' : 'convocazione';
  };
}

function sectorLabel() {
  const s = state.sectors.find(x => x.id === state.activeSectorId);
  return s ? s.name : '';
}

/* ===================== Vista famiglia: conferma o rifiuta ===================== */
async function renderFamilyView(c) {
  c.innerHTML = `<div class="settings-col"><div id="myComms">
    <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div></div>`;
  const holder = document.getElementById('myComms');

  let rows;
  try {
    rows = await fetchMyCommunications(state.linkedPlayers.map(p => p.id));
  } catch (e) {
    showLoadError(holder, e, 'le comunicazioni');
    return;
  }
  if (rows.length === 0) {
    holder.innerHTML = '<div class="placeholder-card">Nessuna comunicazione al momento.</div>';
    return;
  }

  holder.innerHTML = '';
  rows.forEach(row => {
    const comm = row.communications;
    const player = state.linkedPlayers.find(p => p.id === row.player_id);
    const answered = row.status !== 'pending';
    const locked = !!comm.closed_at;
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="comm-kind">${esc(KIND_LABEL[comm.kind] || comm.kind)}${player ? ' · ' + esc(player.name) : ''}</div>
      <div class="comm-title">${esc(comm.title)}</div>
      <div class="hint">${comm.event_date ? esc(fmtDay(comm.event_date)) : ''}</div>
      <div class="comm-detail">
        ${comm.meet_time ? `<div><span>Ritrovo</span><b>${esc(comm.meet_time)}</b></div>` : ''}
        ${comm.start_time ? `<div><span>Inizio</span><b>${esc(comm.start_time)}</b></div>` : ''}
        ${comm.location ? `<div><span>Luogo</span><b>${esc(comm.location)}</b></div>` : ''}
      </div>
      ${comm.body ? `<div class="hint">${esc(comm.body)}</div>` : ''}
      ${!comm.requires_response ? '' : locked
        ? `<div class="hint">Risposte chiuse${answered ? ` · hai risposto: ${row.status === 'confirmed' ? 'presente' : 'assente'}` : ''}</div>`
        : `<div class="comm-answer">
             <button class="btn ${row.status === 'confirmed' ? 'btn-primary' : 'btn-secondary'}"
                     data-yes="${comm.id}" data-player="${row.player_id}">Ci sarà</button>
             <button class="btn ${row.status === 'declined' ? 'btn-danger' : 'btn-ghost'}"
                     data-no="${comm.id}" data-player="${row.player_id}">Non ci sarà</button>
           </div>
           ${comm.respond_by ? `<div class="hint">Rispondi entro il ${new Date(comm.respond_by).toLocaleDateString('it-IT')}</div>` : ''}`}
    `;
    holder.appendChild(card);
  });

  const answer = (btn, status) => withButtonLoading(btn, async () => {
    try {
      await respondToCommunication(
        btn.getAttribute(status === 'confirmed' ? 'data-yes' : 'data-no'),
        btn.getAttribute('data-player'), status
      );
      toast(status === 'confirmed' ? 'Presenza confermata' : 'Assenza segnalata');
      renderFamilyView(c);
    } catch (e) {
      toast(e.message || 'Impossibile registrare la risposta');
    }
  });
  holder.querySelectorAll('[data-yes]').forEach(b => b.onclick = () => answer(b, 'confirmed'));
  holder.querySelectorAll('[data-no]').forEach(b => b.onclick = () => answer(b, 'declined'));
}

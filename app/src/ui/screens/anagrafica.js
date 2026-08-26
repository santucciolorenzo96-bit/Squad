import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { toast, confirmModal } from '../modal.js';
import { DOC_TYPES, canReviewDocuments, isFamiglia } from '../../utils/permissions.js';
import {
  fetchPlayer, updatePlayer, fetchPlayerDocuments, uploadPlayerDocument,
  getDocumentSignedUrl, reviewDocument, fetchPendingDocuments,
  uploadPlayerPhoto, getPlayerPhotoSignedUrl, fetchPlayerPhotoUrls
} from '../../api/roster.js';
import { resizeImageFile } from '../../utils/image.js';
import { avatarHtml, wireAvatarClicks, openPhotoViewModal } from '../playerAvatar.js';
import { openPhotoPositionModal } from '../photoEditor.js';

export function renderAnagraficaTab(c) {
  if (isFamiglia(state.currentUser)) return renderFamiglia(c);
  return renderStaffList(c);
}

/* ======================= FAMIGLIA: solo i propri figli ======================= */
function renderFamiglia(c) {
  if (state.linkedPlayers.length === 0) {
    c.innerHTML = '<div class="placeholder-card">Il tuo account non è ancora collegato a nessun giocatore.</div>';
    return;
  }
  c.innerHTML = `<div id="famiglia-players"></div>`;
  const holder = c.querySelector('#famiglia-players');
  state.linkedPlayers.forEach(p => {
    const wrap = document.createElement('div');
    holder.appendChild(wrap);
    renderPlayerDetail(wrap, p.id, { readOnlyIdentity: true });
  });
}

/* ======================= STAFF: lista rosa + dettaglio ======================= */
async function renderStaffList(c) {
  c.innerHTML = `
    ${state.pendingDocsCount > 0 ? `<button class="btn btn-secondary" id="pendingBtn" style="width:100%;margin-bottom:14px;display:flex;align-items:center;justify-content:center;gap:8px;">
      <span class="status-badge pending">${state.pendingDocsCount} da approvare</span>
    </button>` : ''}
    <div class="section-label">Anagrafica (${state.roster.length})</div>
    <div id="anagraficaList"></div>
  `;
  const holder = document.getElementById('anagraficaList');
  if (state.roster.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giocatore in rosa.</div>'; }
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
  state.roster.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 36)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div><span class="icon-btn">›</span>`;
    row.onclick = () => renderPlayerDetail(c, p.id, {});
    holder.appendChild(row);
  });
  wireAvatarClicks(holder, photoUrls);
  const pendingBtn = document.getElementById('pendingBtn');
  if (pendingBtn) pendingBtn.onclick = () => renderPendingQueue(c);
}

async function renderPendingQueue(c) {
  c.innerHTML = `<div class="section-label">Documenti da approvare</div><div id="pendingList" class="hint">Caricamento…</div>`;
  const docs = await fetchPendingDocuments(state.teamProfile.id);
  const holder = document.getElementById('pendingList');
  if (docs.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun documento da approvare.</div>'; return; }
  holder.innerHTML = '';
  docs.forEach(d => {
    const row = document.createElement('div');
    row.className = 'card';
    const label = (DOC_TYPES.find(t => t.key === d.doc_type) || {}).label || d.doc_type;
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;">${esc(d.players.name)} <span class="hint" style="display:inline;">#${esc(d.players.number)}</span></div>
          <div class="hint">${esc(label)} · caricato il ${new Date(d.uploaded_at).toLocaleDateString('it-IT')}</div>
        </div>
        <span class="status-badge pending">In verifica</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button class="btn btn-secondary" data-view="${d.file_path}" style="flex:1;">Visualizza</button>
        <button class="btn btn-primary" data-approve="${d.id}" style="flex:1;">✓ Conferma</button>
        <button class="btn btn-danger" data-reject="${d.id}" style="flex:1;">✗ Rifiuta</button>
      </div>
    `;
    holder.appendChild(row);
  });
  holder.querySelectorAll('[data-view]').forEach(btn => btn.onclick = async () => {
    const url = await getDocumentSignedUrl(btn.getAttribute('data-view'));
    window.open(url, '_blank');
  });
  holder.querySelectorAll('[data-approve]').forEach(btn => btn.onclick = async () => {
    await reviewDocument(btn.getAttribute('data-approve'), 'approved', state.currentUser.id);
    toast('Documento confermato');
    state.pendingDocsCount = Math.max(0, state.pendingDocsCount - 1);
    renderPendingQueue(c);
  });
  holder.querySelectorAll('[data-reject]').forEach(btn => btn.onclick = async () => {
    await reviewDocument(btn.getAttribute('data-reject'), 'rejected', state.currentUser.id);
    toast('Documento rifiutato');
    state.pendingDocsCount = Math.max(0, state.pendingDocsCount - 1);
    renderPendingQueue(c);
  });
  const backRow = document.createElement('button');
  backRow.className = 'btn btn-ghost';
  backRow.textContent = '← Torna alla rosa';
  backRow.style.cssText = 'width:100%;margin-top:14px;';
  backRow.onclick = () => renderStaffList(c);
  holder.parentElement.appendChild(backRow);
}

/* ======================= Dettaglio giocatore (staff o famiglia) ======================= */
async function renderPlayerDetail(c, playerId, { readOnlyIdentity }) {
  const player = await fetchPlayer(playerId);
  const docs = await fetchPlayerDocuments(playerId);
  const canReview = canReviewDocuments(state.currentUser);
  const canEditFields = !readOnlyIdentity;
  const photoUrl = player.photo_path ? await getPlayerPhotoSignedUrl(player.photo_path) : null;

  c.innerHTML = `
    ${!readOnlyIdentity ? `<button class="btn btn-ghost" id="backBtn" style="margin-bottom:14px;">← Torna alla rosa</button>` : ''}
    <div class="card" style="text-align:center;">
      <div class="player-avatar${photoUrl ? ' clickable' : ''}" id="playerAvatar">${photoUrl ? `<img src="${esc(photoUrl)}" style="object-position:${player.photo_focal_x ?? 50}% ${player.photo_focal_y ?? 50}%;">` : esc((player.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
      ${canEditFields ? `<input type="file" id="fPhotoInput" accept="image/*" class="hidden"><div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;"><button class="file-btn" id="fPhotoBtn">${photoUrl ? 'Cambia foto' : 'Carica foto'}</button>${photoUrl ? '<button class="file-btn" id="fPhotoReframe">Inquadra</button>' : ''}</div>` : ''}
      <div style="font-family:var(--font-display);font-weight:800;font-size:18px;">${esc(player.name)}</div>
      <div class="hint">#${esc(player.number)}${player.role_position ? ' · ' + esc(player.role_position) : ''}${player.height_cm ? ' · ' + player.height_cm + ' cm' : ''}</div>
    </div>

    <div class="card">
      <h2>Dati anagrafici</h2>
      <div class="row2">
        <div class="field"><label>Data di nascita</label><input type="date" id="fBirth" value="${player.birth_date || ''}" ${canEditFields ? '' : 'disabled'}></div>
        <div class="field"><label>Codice fiscale</label><input type="text" id="fFiscal" value="${esc(player.fiscal_code || '')}" ${canEditFields ? '' : 'disabled'}></div>
      </div>
      <div class="row2">
        <div class="field"><label>Ruolo in campo</label><input type="text" id="fRole" value="${esc(player.role_position || '')}" placeholder="Es. Guardia" ${canEditFields ? '' : 'disabled'}></div>
        <div class="field"><label>Altezza (cm)</label><input type="number" id="fHeight" min="100" max="250" value="${player.height_cm ?? ''}" ${canEditFields ? '' : 'disabled'}></div>
      </div>
      <div class="row2">
        <div class="field"><label>In rosa dal</label><input type="date" id="fJoined" value="${player.joined_at || ''}" ${canEditFields ? '' : 'disabled'}></div>
        <div class="field"><label>Telefono genitore/tutore</label><input type="tel" id="fPhone" value="${esc(player.guardian_phone || '')}" ${canEditFields ? '' : 'disabled'}></div>
      </div>
      <div class="field"><label>Email</label><input type="email" id="fEmail" value="${esc(player.email || '')}" ${canEditFields ? '' : 'disabled'}></div>
      ${canEditFields ? `<div class="error-msg" id="fError"></div><button class="btn btn-primary" id="fSave">Salva dati</button>` : `<div class="hint">Per modificare questi dati contatta lo staff della squadra.</div>`}
    </div>

    <div class="section-label">Documenti</div>
    <div id="docList"></div>
  `;

  if (!readOnlyIdentity) {
    document.getElementById('backBtn').onclick = () => renderStaffList(c);
  }
  const avatarEl = document.getElementById('playerAvatar');
  if (avatarEl && photoUrl) avatarEl.onclick = () => openPhotoViewModal(photoUrl);
  const photoBtn = document.getElementById('fPhotoBtn');
  if (photoBtn) {
    photoBtn.onclick = () => document.getElementById('fPhotoInput').click();
    document.getElementById('fPhotoInput').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const blob = await resizeImageFile(file, 480);
        await uploadPlayerPhoto(state.teamProfile.id, playerId, blob);
        const previewUrl = URL.createObjectURL(blob);
        openPhotoPositionModal(previewUrl, 50, 50, async (x, y) => {
          await updatePlayer(playerId, { photo_focal_x: x, photo_focal_y: y });
          toast('Foto aggiornata');
          renderPlayerDetail(c, playerId, { readOnlyIdentity });
        });
      } catch (err) {
        toast(err.message || 'Errore nel caricamento della foto');
      }
    };
  }
  const reframeBtn = document.getElementById('fPhotoReframe');
  if (reframeBtn) reframeBtn.onclick = () => {
    openPhotoPositionModal(photoUrl, player.photo_focal_x ?? 50, player.photo_focal_y ?? 50, async (x, y) => {
      await updatePlayer(playerId, { photo_focal_x: x, photo_focal_y: y });
      toast('Inquadratura salvata');
      renderPlayerDetail(c, playerId, { readOnlyIdentity });
    });
  };
  const saveBtn = document.getElementById('fSave');
  if (saveBtn) saveBtn.onclick = async () => {
    const errEl = document.getElementById('fError');
    try {
      await updatePlayer(playerId, {
        birth_date: document.getElementById('fBirth').value || null,
        fiscal_code: document.getElementById('fFiscal').value.trim() || null,
        role_position: document.getElementById('fRole').value.trim() || null,
        height_cm: document.getElementById('fHeight').value ? parseInt(document.getElementById('fHeight').value, 10) : null,
        joined_at: document.getElementById('fJoined').value || null,
        guardian_phone: document.getElementById('fPhone').value.trim() || null,
        email: document.getElementById('fEmail').value.trim() || null
      });
      toast('Dati salvati');
    } catch (e) {
      errEl.textContent = e.message || 'Errore nel salvataggio.';
    }
  };

  const docHolder = document.getElementById('docList');
  DOC_TYPES.forEach(dt => {
    const existing = docs.filter(d => d.doc_type === dt.key).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
    const card = document.createElement('div');
    card.className = 'card';
    if (existing) {
      const statusClass = existing.status === 'approved' ? 'ok' : (existing.status === 'rejected' ? 'rejected' : 'pending');
      const statusLabel = existing.status === 'approved' ? 'Inserito' : (existing.status === 'rejected' ? 'Rifiutato' : 'In verifica');
      card.innerHTML = `
        <div class="lbl" style="margin-bottom:10px;">${esc(dt.label)}</div>
        <div class="doc-row ${statusClass}">
          <div class="doc-icon" style="background:var(--tint);">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="var(--text)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h6l3 3V17a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1z"/><path d="M12 2.5V6h3"/></svg>
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(existing.file_name)}</div>
            <div class="hint">Caricato il ${new Date(existing.uploaded_at).toLocaleDateString('it-IT')}${existing.expires_at ? ' · valido fino al ' + new Date(existing.expires_at).toLocaleDateString('it-IT') : ''}</div>
          </div>
          <span class="status-badge ${statusClass === 'ok' ? 'ok' : (statusClass === 'rejected' ? 'rejected' : 'pending')}">${statusLabel}</span>
        </div>
        <div style="display:flex;gap:8px;margin-top:10px;">
          <button class="btn btn-secondary" data-view="${existing.file_path}" style="flex:1;">Visualizza</button>
          <button class="btn btn-ghost" data-replace="${dt.key}" style="flex:1;">Sostituisci</button>
          ${canReview && existing.status === 'in_review' ? `<button class="btn btn-primary" data-approve="${existing.id}" style="flex:1;">✓ Conferma</button><button class="btn btn-danger" data-reject="${existing.id}" style="flex:1;">✗ Rifiuta</button>` : ''}
        </div>
        <input type="file" data-file-for="${dt.key}" class="hidden" accept=".pdf,image/*">
      `;
    } else {
      card.innerHTML = `
        <div class="lbl" style="margin-bottom:10px;">${esc(dt.label)}</div>
        <div class="dropzone" data-dropzone="${dt.key}">
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="var(--dim)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13V4M6.5 7.5 10 4l3.5 3.5"/><path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"/></svg>
          <div style="font-size:13px;font-weight:600;">Tocca per caricare il file</div>
          <div class="hint">PDF o immagine, max 10MB</div>
          <span class="status-badge missing" style="margin-top:4px;">Da caricare</span>
        </div>
        <input type="file" data-file-for="${dt.key}" class="hidden" accept=".pdf,image/*">
      `;
    }
    docHolder.appendChild(card);

    const fileInput = card.querySelector(`[data-file-for="${dt.key}"]`);
    const trigger = card.querySelector(`[data-dropzone="${dt.key}"]`) || card.querySelector(`[data-replace="${dt.key}"]`);
    if (trigger) trigger.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > 10 * 1024 * 1024) { toast('File troppo grande (max 10MB)'); return; }
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
      try {
        await uploadPlayerDocument(state.teamProfile.id, playerId, dt.key, file, ext, state.currentUser.id);
        toast('Documento caricato, in attesa di verifica');
        renderPlayerDetail(c, playerId, { readOnlyIdentity });
      } catch (e) {
        toast(e.message || 'Errore nel caricamento');
      }
    };
    const viewBtn = card.querySelector('[data-view]');
    if (viewBtn) viewBtn.onclick = async () => {
      const url = await getDocumentSignedUrl(viewBtn.getAttribute('data-view'));
      window.open(url, '_blank');
    };
    const approveBtn = card.querySelector('[data-approve]');
    if (approveBtn) approveBtn.onclick = () => confirmModal('Confermare il documento?', `${dt.label} risulterà "Inserito".`, async () => {
      await reviewDocument(approveBtn.getAttribute('data-approve'), 'approved', state.currentUser.id);
      toast('Documento confermato');
      renderPlayerDetail(c, playerId, { readOnlyIdentity });
    }, 'Conferma');
    const rejectBtn = card.querySelector('[data-reject]');
    if (rejectBtn) rejectBtn.onclick = () => confirmModal('Rifiutare il documento?', `${dt.label} tornerà "Da caricare".`, async () => {
      await reviewDocument(rejectBtn.getAttribute('data-reject'), 'rejected', state.currentUser.id);
      toast('Documento rifiutato');
      renderPlayerDetail(c, playerId, { readOnlyIdentity });
    }, 'Rifiuta');
  });
}

import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { toast, confirmModal, formModal, withButtonLoading } from '../modal.js';
import { DOC_TYPES, canReviewDocuments, isLinkedUser } from '../../utils/permissions.js';
import {
  fetchPlayer, updatePlayer, updateLinkedPlayerDetails, fetchPlayerDocuments, uploadPlayerDocument,
  getDocumentSignedUrl, reviewDocument, fetchPendingDocuments, fetchExpiringDocuments,
  uploadPlayerPhoto, getPlayerPhotoSignedUrl, fetchPlayerPhotoUrls
} from '../../api/roster.js';
import { resizeImageFile } from '../../utils/image.js';
import { avatarHtml, wireAvatarClicks, openPhotoViewModal } from '../playerAvatar.js';
import { openPhotoPositionModal } from '../photoEditor.js';

export function renderAnagraficaTab(c) {
  if (isLinkedUser(state.currentUser)) return renderFamiglia(c);
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
    <div style="display:flex;gap:8px;margin-bottom:14px;">
      ${state.pendingDocsCount > 0 ? `<button class="btn btn-secondary" id="pendingBtn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span class="status-badge pending">${state.pendingDocsCount} da approvare</span>
      </button>` : ''}
      ${state.expiringDocsCount > 0 ? `<button class="btn btn-secondary" id="expiringBtn" style="flex:1;display:flex;align-items:center;justify-content:center;gap:8px;">
        <span class="status-badge pending">${state.expiringDocsCount} in scadenza</span>
      </button>` : ''}
    </div>
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
  const expiringBtn = document.getElementById('expiringBtn');
  if (expiringBtn) expiringBtn.onclick = () => renderExpiringQueue(c);
}

async function renderExpiringQueue(c) {
  c.innerHTML = `<div class="section-label">Documenti in scadenza</div><div id="expiringList"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>`;
  const docs = await fetchExpiringDocuments(state.teamProfile.id);
  const holder = document.getElementById('expiringList');
  if (docs.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun documento in scadenza.</div>'; return; }
  holder.innerHTML = '';
  const today = new Date().toISOString().slice(0, 10);
  docs.forEach(d => {
    const label = (DOC_TYPES.find(t => t.key === d.doc_type) || {}).label || d.doc_type;
    const expired = d.expires_at < today;
    const row = document.createElement('div');
    row.className = 'card';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:700;">${esc(d.players.name)} <span class="hint" style="display:inline;">#${esc(d.players.number)}</span></div>
          <div class="hint">${esc(label)} · ${expired ? 'scaduto il' : 'valido fino al'} ${new Date(d.expires_at).toLocaleDateString('it-IT')}</div>
        </div>
        <span class="status-badge ${expired ? 'rejected' : 'pending'}">${expired ? 'Scaduto' : 'In scadenza'}</span>
      </div>
      <button class="btn btn-secondary" data-view="${d.file_path}" style="width:100%;margin-top:10px;">Visualizza</button>
    `;
    holder.appendChild(row);
  });
  holder.querySelectorAll('[data-view]').forEach(btn => btn.onclick = async () => {
    const url = await getDocumentSignedUrl(btn.getAttribute('data-view'));
    window.open(url, '_blank');
  });
  const backRow = document.createElement('button');
  backRow.className = 'btn btn-ghost';
  backRow.textContent = '← Torna alla rosa';
  backRow.style.cssText = 'width:100%;margin-top:14px;';
  backRow.onclick = () => renderStaffList(c);
  holder.parentElement.appendChild(backRow);
}

async function renderPendingQueue(c) {
  c.innerHTML = `<div class="section-label">Documenti da approvare</div><div id="pendingList"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>`;
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
  // Lo staff modifica tutto; l'account collegato completa i propri dati
  // anagrafici, ma non numero di maglia, ruolo o data di ingresso in rosa.
  const isFamilyView = !!readOnlyIdentity;
  const canEditFields = !isFamilyView;
  const canEditOwn = canEditFields || isFamilyView;
  const canUploadDocs = canEditFields || !!state.currentUser.can_upload_documents;
  const own = canEditOwn ? '' : 'disabled';
  const staffOnly = canEditFields ? '' : 'disabled';
  const photoUrl = player.photo_path ? await getPlayerPhotoSignedUrl(player.photo_path) : null;

  c.innerHTML = `
    <div class="settings-col">
    ${!readOnlyIdentity ? `<button class="btn btn-ghost" id="backBtn" style="margin-bottom:14px;">← Torna alla rosa</button>` : ''}
    <div class="card" style="text-align:center;">
      <div class="player-avatar${photoUrl ? ' clickable' : ''}" id="playerAvatar">${photoUrl ? `<img src="${esc(photoUrl)}" style="object-position:${player.photo_focal_x ?? 50}% ${player.photo_focal_y ?? 50}%;">` : esc((player.name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase())}</div>
      ${canEditFields ? `<input type="file" id="fPhotoInput" accept="image/*" class="hidden"><div style="display:flex;gap:8px;justify-content:center;margin-bottom:10px;"><button class="file-btn" id="fPhotoBtn">${photoUrl ? 'Cambia foto' : 'Carica foto'}</button>${photoUrl ? '<button class="file-btn" id="fPhotoReframe">Inquadra</button>' : ''}</div>` : ''}
      <div style="font-family:var(--font-display);font-weight:700;font-size:18px;">${esc(player.name)}</div>
      <div class="hint">#${esc(player.number)}${player.role_position ? ' · ' + esc(player.role_position) : ''}${player.height_cm ? ' · ' + player.height_cm + ' cm' : ''}</div>
    </div>

    <div class="card">
      <h2>Dati anagrafici</h2>
      <div class="row2">
        <div class="field"><label>Data di nascita</label><input type="date" id="fBirth" value="${player.birth_date || ''}" ${own}></div>
        <div class="field"><label>Codice fiscale</label><input type="text" id="fFiscal" value="${esc(player.fiscal_code || '')}" ${own}></div>
      </div>
      <div class="row2">
        <div class="field"><label>Ruolo in campo</label><input type="text" id="fRole" value="${esc(player.role_position || '')}" placeholder="Es. Guardia" ${staffOnly}></div>
        <div class="field"><label>Altezza (cm)</label><input type="number" id="fHeight" min="100" max="250" value="${player.height_cm ?? ''}" ${own}></div>
      </div>
      <div class="row2">
        <div class="field"><label>In rosa dal</label><input type="date" id="fJoined" value="${player.joined_at || ''}" ${staffOnly}></div>
        <div class="field"><label>Telefono genitore/tutore</label><input type="tel" id="fPhone" value="${esc(player.guardian_phone || '')}" ${own}></div>
      </div>
      <div class="field"><label>Email</label><input type="email" id="fEmail" value="${esc(player.email || '')}" ${own}></div>
      <div class="error-msg" id="fError"></div>
      <button class="btn btn-primary" id="fSave">Salva dati</button>
      ${isFamilyView ? '<div class="hint">Ruolo in campo e data di ingresso in rosa li imposta lo staff.</div>' : ''}
    </div>

    <div class="section-label">Documenti</div>
    ${!canUploadDocs ? '<div class="hint" style="margin-bottom:8px;">Il caricamento dei documenti non è abilitato sul tuo account: puoi consultare quelli già presenti. Per caricarli chiedi a un amministratore di abilitarti.</div>' : ''}
    <div id="docList"></div>
    </div>
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
  if (saveBtn) saveBtn.onclick = (ev) => withButtonLoading(ev.currentTarget, async () => {
    const errEl = document.getElementById('fError');
    const common = {
      birth_date: document.getElementById('fBirth').value || null,
      fiscal_code: document.getElementById('fFiscal').value.trim() || null,
      height_cm: document.getElementById('fHeight').value ? parseInt(document.getElementById('fHeight').value, 10) : null,
      guardian_phone: document.getElementById('fPhone').value.trim() || null,
      email: document.getElementById('fEmail').value.trim() || null
    };
    try {
      if (isFamilyView) {
        await updateLinkedPlayerDetails(playerId, common);
      } else {
        await updatePlayer(playerId, {
          ...common,
          role_position: document.getElementById('fRole').value.trim() || null,
          joined_at: document.getElementById('fJoined').value || null
        });
      }
      errEl.textContent = '';
      toast('Dati salvati');
    } catch (e) {
      errEl.textContent = e.message || 'Errore nel salvataggio.';
    }
  });

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
          ${canUploadDocs ? `<button class="btn btn-ghost" data-replace="${dt.key}" style="flex:1;">Sostituisci</button>` : ''}
          ${canReview && existing.status === 'in_review' ? `<button class="btn btn-primary" data-approve="${existing.id}" style="flex:1;">✓ Conferma</button><button class="btn btn-danger" data-reject="${existing.id}" style="flex:1;">✗ Rifiuta</button>` : ''}
        </div>
        <input type="file" data-file-for="${dt.key}" class="hidden" accept=".pdf,image/*">
      `;
    } else {
      card.innerHTML = `
        <div class="lbl" style="margin-bottom:10px;">${esc(dt.label)}</div>
        <div class="dropzone" ${canUploadDocs ? `data-dropzone="${dt.key}"` : 'style="opacity:.6;"'}>
          <svg width="24" height="24" viewBox="0 0 20 20" fill="none" stroke="var(--dim)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13V4M6.5 7.5 10 4l3.5 3.5"/><path d="M4 14v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"/></svg>
          <div style="font-size:13px;font-weight:600;">${canUploadDocs ? 'Tocca per caricare il file' : 'Caricamento non abilitato'}</div>
          <div class="hint">${canUploadDocs ? 'PDF o immagine, max 10MB' : 'Lo staff può caricarlo per te'}</div>
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
      const doUpload = async (expiresAt) => {
        try {
          await uploadPlayerDocument(state.teamProfile.id, playerId, dt.key, file, ext, state.currentUser.id, expiresAt);
          toast('Documento caricato, in attesa di verifica');
          renderPlayerDetail(c, playerId, { readOnlyIdentity });
        } catch (e) {
          toast(e.message || 'Errore nel caricamento');
        }
      };
      if (dt.key === 'certificato_medico') {
        formModal('Scadenza certificato', `
          <div class="field"><label>Valido fino al</label><input type="date" id="fCertExpiry"></div>
          <div class="hint">Il sistema avviserà quando si avvicina la scadenza.</div>
        `, async () => {
          const expiresAt = document.getElementById('fCertExpiry').value;
          if (!expiresAt) return 'Inserisci la data di scadenza.';
          await doUpload(expiresAt);
        });
      } else {
        await doUpload(null);
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

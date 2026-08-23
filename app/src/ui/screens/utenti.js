import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { ROLES, ROLE_CLASS } from '../../utils/permissions.js';
import { confirmModal, formModal, toast } from '../modal.js';
import { updateProfile, deactivateProfile } from '../../api/profiles.js';

export function renderUtentiTab(c) {
  c.innerHTML = `
    <div class="placeholder-card">
      <span class="tag">Codice invito</span><br>
      Per aggiungere staff, condividi il codice invito della squadra (sezione Squadra): la persona si registra da sola scegliendo "Entra in una squadra esistente", poi qui puoi assegnarle il ruolo giusto.
    </div>
    <div class="section-label">Staff (${state.staff.length})</div>
    <div id="userList"></div>
  `;
  function drawUsers() {
    const holder = document.getElementById('userList');
    holder.innerHTML = '';
    state.staff.forEach(u => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const isSelf = u.id === state.currentUser.id;
      row.innerHTML = `<div class="main"><div class="nm">${esc(u.display_name)} ${isSelf ? '<span class="hint">(tu)</span>' : ''}</div></div>
        <span class="role-badge ${ROLE_CLASS[u.role]}">${ROLES[u.role]}</span>
        <button class="icon-btn" data-edit="${u.id}">✎</button>
        ${!isSelf ? `<button class="icon-btn danger" data-rm="${u.id}">✕</button>` : ''}`;
      holder.appendChild(row);
    });
    holder.querySelectorAll('[data-edit]').forEach(btn => {
      btn.onclick = () => openUserModal(state.staff.find(u => u.id === btn.getAttribute('data-edit')));
    });
    holder.querySelectorAll('[data-rm]').forEach(btn => {
      btn.onclick = () => {
        const u = state.staff.find(x => x.id === btn.getAttribute('data-rm'));
        const adminCount = state.staff.filter(x => x.role === 'admin').length;
        if (u.role === 'admin' && adminCount <= 1) { toast('Deve rimanere almeno un amministratore'); return; }
        confirmModal('Rimuovere utente?', `${u.display_name} non potrà più accedere.`, async () => {
          await deactivateProfile(u.id);
          state.staff = state.staff.filter(x => x.id !== u.id);
          drawUsers();
        }, 'Rimuovi');
      };
    });
  }
  drawUsers();

  function openUserModal(existing) {
    formModal('Modifica utente', `
      <div class="field"><label>Nome e cognome</label><input type="text" id="uName" value="${esc(existing.display_name)}"></div>
      <div class="field"><label>Ruolo</label>
        <select id="uRole">
          <option value="admin" ${existing.role === 'admin' ? 'selected' : ''}>Amministratore</option>
          <option value="allenatore" ${existing.role === 'allenatore' ? 'selected' : ''}>Allenatore</option>
          <option value="segnapunti" ${existing.role === 'segnapunti' ? 'selected' : ''}>Segnapunti</option>
        </select>
      </div>
    `, async () => {
      const displayName = document.getElementById('uName').value.trim();
      const role = document.getElementById('uRole').value;
      if (!displayName) return 'Inserisci il nome.';
      if (existing.role === 'admin' && role !== 'admin') {
        const adminCount = state.staff.filter(x => x.role === 'admin').length;
        if (adminCount <= 1) return 'Deve rimanere almeno un amministratore.';
      }
      const updated = await updateProfile(existing.id, { display_name: displayName, role });
      Object.assign(existing, updated);
      if (existing.id === state.currentUser.id) Object.assign(state.currentUser, updated);
      drawUsers();
      toast('Utente salvato');
    });
  }
}

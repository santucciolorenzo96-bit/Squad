import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { ROLES, ROLE_CLASS, isFinanceAdmin, isAdmin, ADMIN_ROLES, ASSIGNABLE_ROLES, LINKED_ROLES, roleLabel } from '../../utils/permissions.js';
import { confirmModal, formModal, toast, showLoadError } from '../modal.js';
import { updateProfile, deactivateProfile } from '../../api/profiles.js';
import { assignStaffToSector, removeStaffFromSector, fetchStaffSectors } from '../../api/sectors.js';
import { fetchFamilyLinksForTeam, linkProfileToPlayer, unlinkProfileFromPlayer } from '../../api/family.js';

export function renderUtentiTab(c) {
  c.innerHTML = `
    <div class="placeholder-card">
      <span class="tag">Codice invito</span><br>
      Condividi il codice invito della squadra (sezione Squadra): staff e genitori/giocatori si registrano da soli scegliendo "Entra in una squadra esistente", poi qui puoi assegnare ruolo/settori o collegare l'account al giocatore giusto.
    </div>
    <div class="section-label">Staff (${state.staff.length})</div>
    <div id="userList"></div>
    <div class="section-label" style="margin-top:24px;">Giocatori e genitori</div>
    <div id="familyList"><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div></div>
  `;
  function sectorNames(profileId) {
    const ids = state.staffSectors[profileId] || [];
    if (ids.length === 0) return 'Nessun settore assegnato';
    return ids.map(id => (state.sectors.find(s => s.id === id) || {}).name).filter(Boolean).join(', ');
  }
  function drawUsers() {
    const holder = document.getElementById('userList');
    holder.innerHTML = '';
    state.staff.forEach(u => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const isSelf = u.id === state.currentUser.id;
      row.innerHTML = `<div class="main"><div class="nm">${esc(u.display_name)} ${isSelf ? '<span class="hint">(tu)</span>' : ''}</div><div class="sub">${isAdmin(u) ? 'Tutti i settori' : esc(sectorNames(u.id))}</div></div>
        <span class="role-badge ${ROLE_CLASS[u.role] || ''}">${esc(roleLabel(u.role))}</span>
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
        const adminCount = state.staff.filter(x => ADMIN_ROLES.includes(x.role)).length;
        if (ADMIN_ROLES.includes(u.role) && adminCount <= 1) { toast('Deve rimanere almeno un amministratore'); return; }
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
    const canGrantFinance = isFinanceAdmin(state.currentUser);
    formModal('Modifica utente', `
      <div class="field"><label>Nome e cognome</label><input type="text" id="uName" value="${esc(existing.display_name)}"></div>
      <div class="field"><label>Ruolo</label>
        <select id="uRole">
          ${/* se il ruolo attuale non è tra quelli previsti lo si mostra comunque,
               altrimenti salvando si assegnerebbe in silenzio il primo dell'elenco */
            ASSIGNABLE_ROLES.includes(existing.role) ? '' :
            `<option value="${esc(existing.role || '')}" selected>${esc(roleLabel(existing.role))}</option>`}
          ${ASSIGNABLE_ROLES.map(r => `<option value="${r}" ${existing.role === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}
        </select>
      </div>
      <div class="field" id="sectorCheckWrap">
        <label>Settori assegnati</label>
        ${state.sectors.map(s => `<label style="display:flex;align-items:center;gap:8px;margin-bottom:6px;"><input type="checkbox" data-sector="${s.id}" ${(state.staffSectors[existing.id] || []).includes(s.id) ? 'checked' : ''} style="width:auto;"> ${esc(s.name)}</label>`).join('') || '<div class="hint">Nessun settore creato: creane uno da Squadra.</div>'}
      </div>
      ${canGrantFinance ? `
      <div class="field"><label>Ruolo finanza</label>
        <select id="uFinanceRole">
          <option value="" ${!existing.finance_role ? 'selected' : ''}>Nessun accesso</option>
          <option value="admin" ${existing.finance_role === 'admin' ? 'selected' : ''}>Amministratore</option>
          <option value="manager" ${existing.finance_role === 'manager' ? 'selected' : ''}>Responsabile amministrativo</option>
          <option value="viewer_team" ${existing.finance_role === 'viewer_team' ? 'selected' : ''}>Responsabile società (sola lettura)</option>
          <option value="viewer_sector" ${existing.finance_role === 'viewer_sector' ? 'selected' : ''}>Responsabile settore (sola lettura, solo i propri settori)</option>
        </select>
      </div>` : ''}
    `, async () => {
      const displayName = document.getElementById('uName').value.trim();
      const role = document.getElementById('uRole').value;
      if (!displayName) return 'Inserisci il nome.';
      if (ADMIN_ROLES.includes(existing.role) && !ADMIN_ROLES.includes(role)) {
        const adminCount = state.staff.filter(x => ADMIN_ROLES.includes(x.role)).length;
        if (adminCount <= 1) return 'Deve rimanere almeno un amministratore.';
      }
      const patch = { display_name: displayName, role };
      if (canGrantFinance) patch.finance_role = document.getElementById('uFinanceRole').value || null;
      const updated = await updateProfile(existing.id, patch);
      Object.assign(existing, updated);
      if (existing.id === state.currentUser.id) Object.assign(state.currentUser, updated);

      const checked = Array.from(document.querySelectorAll('#sectorCheckWrap [data-sector]:checked')).map(el => el.getAttribute('data-sector'));
      const before = state.staffSectors[existing.id] || [];
      const toAdd = checked.filter(id => !before.includes(id));
      const toRemove = before.filter(id => !checked.includes(id));
      for (const id of toAdd) await assignStaffToSector(existing.id, id);
      for (const id of toRemove) await removeStaffFromSector(existing.id, id);
      state.staffSectors = await fetchStaffSectors(state.teamProfile.id);

      // Spostato tra gli utenti base: esce dall'elenco staff e compare sotto
      if (LINKED_ROLES.includes(role)) {
        state.staff = state.staff.filter(x => x.id !== existing.id);
        drawFamily();
      }
      drawUsers();
      toast('Utente salvato');
    });
  }

  drawFamily();
  async function drawFamily() {
    const holder = document.getElementById('familyList');
    let families;
    try {
      families = await fetchFamilyLinksForTeam(state.teamProfile.id);
    } catch (e) {
      showLoadError(holder, e, 'gli account giocatore/genitore');
      return;
    }
    if (families.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun account giocatore o genitore registrato.</div>'; return; }
    holder.innerHTML = '';
    families.forEach(f => {
      const row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="min-width:0;">
            <div style="font-weight:700;">${esc(f.display_name)}
              <span class="role-badge ${ROLE_CLASS[f.role] || ''}" style="margin-left:6px;">${esc(roleLabel(f.role))}</span>
            </div>
            ${f.linkedPlayers.length
              ? `<div class="linked-chips">${f.linkedPlayers.map(p => `
                  <span class="linked-chip">#${esc(p.number)} ${esc(p.name)}
                    <button data-unlink-profile="${f.id}" data-unlink-player="${p.id}"
                            title="Scollega" aria-label="Scollega ${esc(p.name)} da ${esc(f.display_name)}">✕</button>
                  </span>`).join('')}</div>`
              : '<div class="hint">Non ancora collegato a nessun giocatore</div>'}
          </div>
          <button class="btn btn-secondary" data-link="${f.id}" style="flex-shrink:0;">Collega giocatore</button>
        </div>
        <div class="field" style="margin:12px 0 0;">
          <label>Ruolo</label>
          <select data-role-for="${f.id}">
            ${LINKED_ROLES.map(r => `<option value="${r}" ${f.role === r ? 'selected' : ''}>${ROLES[r]}</option>`).join('')}
          </select>
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:12px;font-size:13px;cursor:pointer;">
          <input type="checkbox" data-perm="can_upload_documents" data-profile="${f.id}" ${f.can_upload_documents ? 'checked' : ''} style="width:auto;">
          Può caricare i documenti (es. certificato medico)
        </label>
        <label style="display:flex;align-items:center;gap:8px;margin-top:8px;font-size:13px;cursor:pointer;">
          <input type="checkbox" data-perm="can_score_matches" data-profile="${f.id}" ${f.can_score_matches ? 'checked' : ''} style="width:auto;">
          Può tenere il tabellino della partita
        </label>
      `;
      holder.appendChild(row);
    });
    holder.querySelectorAll('[data-link]').forEach(btn => btn.onclick = () => openLinkModal(btn.getAttribute('data-link')));
    holder.querySelectorAll('[data-unlink-player]').forEach(btn => btn.onclick = () => {
      const profileId = btn.getAttribute('data-unlink-profile');
      const playerId = btn.getAttribute('data-unlink-player');
      const family = families.find(x => x.id === profileId);
      const player = (family ? family.linkedPlayers : []).find(p => p.id === playerId);
      confirmModal(
        'Scollegare il giocatore?',
        `${family ? family.display_name : "L'account"} non vedrà più i dati di ${player ? player.name : 'questo giocatore'}. Il giocatore resta in anagrafica e il collegamento si può rifare.`,
        async () => {
          await unlinkProfileFromPlayer(profileId, playerId);
          toast('Collegamento rimosso');
          drawFamily();
        },
        'Scollega'
      );
    });
    const PERM_LABELS = {
      can_upload_documents: 'Caricamento documenti',
      can_score_matches: 'Tabellino partita'
    };
    holder.querySelectorAll('[data-role-for]').forEach(sel => {
      const previous = sel.value;
      sel.onchange = async () => {
        try {
          await updateProfile(sel.getAttribute('data-role-for'), { role: sel.value });
          toast(`Ruolo aggiornato: ${ROLES[sel.value]}`);
          drawFamily();
        } catch (e) {
          sel.value = previous;
          toast(e.message || 'Impossibile aggiornare il ruolo');
        }
      };
    });
    holder.querySelectorAll('[data-perm]').forEach(cb => cb.onchange = async () => {
      const perm = cb.getAttribute('data-perm');
      const id = cb.getAttribute('data-profile');
      try {
        await updateProfile(id, { [perm]: cb.checked });
        toast(`${PERM_LABELS[perm]}: ${cb.checked ? 'abilitato' : 'disabilitato'}`);
      } catch (e) {
        cb.checked = !cb.checked;
        toast(e.message || 'Impossibile aggiornare il permesso');
      }
    });
  }

  function openLinkModal(profileId) {
    const allPlayers = state.roster; // giocatori del settore attivo; per collegare un giocatore di un altro settore, cambia settore e riprova
    formModal('Collega a un giocatore', `
      <div class="field"><label>Giocatore (settore attivo)</label>
        <select id="lnkPlayer">${allPlayers.map(p => `<option value="${p.id}">#${esc(p.number)} ${esc(p.name)}</option>`).join('') || '<option disabled>Nessun giocatore in questo settore</option>'}</select>
      </div>
      <div class="hint">Per collegare un giocatore di un altro settore, cambia settore dall'header e riapri questa finestra.</div>
    `, async () => {
      const playerId = document.getElementById('lnkPlayer').value;
      if (!playerId) return 'Seleziona un giocatore.';
      await linkProfileToPlayer(profileId, playerId);
      toast('Collegato');
      drawFamily();
    });
  }
}

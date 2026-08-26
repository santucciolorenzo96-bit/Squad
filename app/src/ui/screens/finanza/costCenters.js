import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createCostCenter, updateCostCenter, removeCostCenter } from '../../../api/financeCostCenters.js';

export function renderCostCentersSection(c, canManage) {
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addCcBtn" style="width:100%;">+ Nuovo centro di costo</button></div>` : ''}
    <div class="section-label">Centri di costo/ricavo (${state.financeCostCenters.length})</div>
    <div id="ccList"></div>
  `;
  function draw() {
    const holder = document.getElementById('ccList');
    if (state.financeCostCenters.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun centro di costo configurato.</div>'; return; }
    holder.innerHTML = '';
    [...state.financeCostCenters].sort((a, b) => a.sort_order - b.sort_order).forEach(cc => {
      const sector = state.sectors.find(s => s.id === cc.sector_id);
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `<div class="main"><div class="nm">${esc(cc.name)}${!cc.active ? ' <span class="hint">(disattivato)</span>' : ''}</div><div class="sub">${sector ? esc(sector.name) : 'Generale'}</div></div>` +
        (canManage ? `<button class="icon-btn" data-edit="${cc.id}">✎</button><button class="icon-btn danger" data-rm="${cc.id}">✕</button>` : '');
      holder.appendChild(row);
    });
    if (!canManage) return;
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openModal(state.financeCostCenters.find(cc => cc.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      const cc = state.financeCostCenters.find(x => x.id === btn.getAttribute('data-rm'));
      confirmModal('Eliminare il centro di costo?', `"${cc.name}" verrà eliminato. Non è possibile se ha già ripartizioni collegate.`, async () => {
        try {
          await removeCostCenter(cc.id);
          state.financeCostCenters = state.financeCostCenters.filter(x => x.id !== cc.id);
          draw();
          toast('Centro di costo eliminato');
        } catch (e) {
          toast(e.message && e.message.includes('violates foreign key') ? 'Il centro ha movimenti collegati: disattivalo invece di eliminarlo.' : (e.message || 'Errore'));
        }
      }, 'Elimina');
    });
  }
  draw();
  const addBtn = document.getElementById('addCcBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    formModal(existing ? 'Modifica centro di costo' : 'Nuovo centro di costo', `
      <div class="field"><label>Nome</label><input type="text" id="ccName" value="${existing ? esc(existing.name) : ''}" placeholder="Es. Amministrazione, Marketing…"></div>
      <div class="field"><label>Settore collegato (opzionale)</label>
        <select id="ccSector">
          <option value="">— Nessuno (centro generale)</option>
          ${state.sectors.map(s => `<option value="${s.id}" ${existing && existing.sector_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="ccActive" ${existing.active ? 'checked' : ''} style="width:auto;"> Attivo</label></div>` : ''}
    `, async () => {
      const name = document.getElementById('ccName').value.trim();
      if (!name) return 'Inserisci il nome.';
      const patch = { name, sector_id: document.getElementById('ccSector').value || null };
      if (existing) {
        patch.active = document.getElementById('ccActive').checked;
        const updated = await updateCostCenter(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const created = await createCostCenter(state.teamProfile.id, patch);
        state.financeCostCenters.push(created);
      }
      draw();
      toast('Centro di costo salvato');
    });
  }
}

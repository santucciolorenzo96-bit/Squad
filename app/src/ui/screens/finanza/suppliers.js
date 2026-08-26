import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createSupplier, updateSupplier, removeSupplier } from '../../../api/financeSuppliers.js';

export function renderSuppliersSection(c, canManage) {
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addSupplierBtn" style="width:100%;">+ Nuovo fornitore</button></div>` : ''}
    <div class="section-label">Fornitori (${state.financeSuppliers.length})</div>
    <div id="supplierList"></div>
  `;
  function draw() {
    const holder = document.getElementById('supplierList');
    if (state.financeSuppliers.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun fornitore in anagrafica.</div>'; return; }
    holder.innerHTML = '';
    state.financeSuppliers.forEach(s => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `<div class="main"><div class="nm">${esc(s.name)}${!s.active ? ' <span class="hint">(disattivato)</span>' : ''}</div><div class="sub">${[s.vat_number, s.email, s.phone].filter(Boolean).map(esc).join(' · ')}</div></div>` +
        (canManage ? `<button class="icon-btn" data-edit="${s.id}">✎</button><button class="icon-btn danger" data-rm="${s.id}">✕</button>` : '');
      holder.appendChild(row);
    });
    if (!canManage) return;
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openModal(state.financeSuppliers.find(s => s.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      const s = state.financeSuppliers.find(x => x.id === btn.getAttribute('data-rm'));
      confirmModal('Eliminare il fornitore?', `"${s.name}" verrà eliminato.`, async () => {
        await removeSupplier(s.id);
        state.financeSuppliers = state.financeSuppliers.filter(x => x.id !== s.id);
        draw();
        toast('Fornitore eliminato');
      }, 'Elimina');
    });
  }
  draw();
  const addBtn = document.getElementById('addSupplierBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    formModal(existing ? 'Modifica fornitore' : 'Nuovo fornitore', `
      <div class="field"><label>Nome</label><input type="text" id="spName" value="${existing ? esc(existing.name) : ''}"></div>
      <div class="row2">
        <div class="field"><label>Partita IVA</label><input type="text" id="spVat" value="${existing ? esc(existing.vat_number || '') : ''}"></div>
        <div class="field"><label>Telefono</label><input type="tel" id="spPhone" value="${existing ? esc(existing.phone || '') : ''}"></div>
      </div>
      <div class="field"><label>Email</label><input type="email" id="spEmail" value="${existing ? esc(existing.email || '') : ''}"></div>
      <div class="field"><label>Note</label><input type="text" id="spNotes" value="${existing ? esc(existing.notes || '') : ''}"></div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="spActive" ${existing.active ? 'checked' : ''} style="width:auto;"> Attivo</label></div>` : ''}
    `, async () => {
      const name = document.getElementById('spName').value.trim();
      if (!name) return 'Inserisci il nome del fornitore.';
      const patch = {
        name,
        vat_number: document.getElementById('spVat').value.trim() || null,
        phone: document.getElementById('spPhone').value.trim() || null,
        email: document.getElementById('spEmail').value.trim() || null,
        notes: document.getElementById('spNotes').value.trim() || null
      };
      if (existing) {
        patch.active = document.getElementById('spActive').checked;
        const updated = await updateSupplier(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const created = await createSupplier(state.teamProfile.id, patch);
        state.financeSuppliers.push(created);
      }
      draw();
      toast('Fornitore salvato');
    });
  }
}

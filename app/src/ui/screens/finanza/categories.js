import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createCategory, updateCategory, removeCategory } from '../../../api/financeCategories.js';

export function renderCategoriesSection(c, canManage) {
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addCategoryBtn" style="width:100%;">+ Nuova categoria</button></div>` : ''}
    <div id="categoryTree"></div>
  `;
  function draw() {
    const holder = document.getElementById('categoryTree');
    holder.innerHTML = '';
    ['income', 'expense'].forEach(kind => {
      const label = document.createElement('div');
      label.className = 'section-label';
      label.textContent = kind === 'income' ? 'Entrate' : 'Uscite';
      holder.appendChild(label);
      const roots = state.financeCategories.filter(cat => cat.kind === kind && !cat.parent_id).sort((a, b) => a.sort_order - b.sort_order);
      if (roots.length === 0) { const ph = document.createElement('div'); ph.className = 'placeholder-card'; ph.textContent = 'Nessuna categoria.'; holder.appendChild(ph); return; }
      roots.forEach(root => {
        holder.appendChild(makeRow(root, false));
        state.financeCategories.filter(cat => cat.parent_id === root.id).sort((a, b) => a.sort_order - b.sort_order)
          .forEach(child => holder.appendChild(makeRow(child, true)));
      });
    });
  }
  function makeRow(cat, indented) {
    const row = document.createElement('div');
    row.className = 'list-row';
    if (indented) row.style.marginLeft = '20px';
    row.innerHTML = `<div class="main"><div class="nm">${esc(cat.name)}${!cat.active ? ' <span class="hint">(disattivata)</span>' : ''}</div></div>` +
      (canManage ? `<button class="icon-btn" data-edit="${cat.id}">✎</button><button class="icon-btn danger" data-rm="${cat.id}">✕</button>` : '');
    if (canManage) {
      row.querySelector('[data-edit]').onclick = () => openModal(cat);
      row.querySelector('[data-rm]').onclick = () => {
        confirmModal('Eliminare la categoria?', `"${cat.name}" verrà eliminata insieme alle eventuali sottocategorie.`, async () => {
          await removeCategory(cat.id);
          state.financeCategories = state.financeCategories.filter(x => x.id !== cat.id && x.parent_id !== cat.id);
          draw();
          toast('Categoria eliminata');
        }, 'Elimina');
      };
    }
    return row;
  }
  draw();
  const addBtn = document.getElementById('addCategoryBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    const kindOptions = k => `<option value="${k}" ${(existing ? existing.kind : 'income') === k ? 'selected' : ''}>${k === 'income' ? 'Entrata' : 'Uscita'}</option>`;
    formModal(existing ? 'Modifica categoria' : 'Nuova categoria', `
      <div class="field"><label>Tipo</label>
        <select id="catKind" ${existing ? 'disabled' : ''}>${kindOptions('income')}${kindOptions('expense')}</select>
      </div>
      <div class="field"><label>Categoria padre (opzionale)</label>
        <select id="catParent"><option value="">— Nessuna (categoria principale)</option></select>
      </div>
      <div class="field"><label>Nome</label><input type="text" id="catName" value="${existing ? esc(existing.name) : ''}"></div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="catActive" ${existing.active ? 'checked' : ''} style="width:auto;"> Categoria attiva</label></div>` : ''}
    `, async () => {
      const name = document.getElementById('catName').value.trim();
      if (!name) return 'Inserisci il nome della categoria.';
      const kind = document.getElementById('catKind').value;
      const parentId = document.getElementById('catParent').value || null;
      if (existing) {
        const patch = { name, parent_id: parentId, active: document.getElementById('catActive').checked };
        const updated = await updateCategory(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const created = await createCategory(state.teamProfile.id, { name, kind, parent_id: parentId });
        state.financeCategories.push(created);
      }
      draw();
      toast('Categoria salvata');
    });
    const kindSel = document.getElementById('catKind');
    const parentSel = document.getElementById('catParent');
    function fillParents() {
      const kind = kindSel.value;
      const options = state.financeCategories.filter(cat => cat.kind === kind && !cat.parent_id && (!existing || cat.id !== existing.id));
      parentSel.innerHTML = '<option value="">— Nessuna (categoria principale)</option>' +
        options.map(o => `<option value="${o.id}" ${existing && existing.parent_id === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
    }
    kindSel.onchange = fillParents;
    fillParents();
  }
}

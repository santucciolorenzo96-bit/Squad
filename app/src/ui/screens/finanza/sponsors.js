import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createSponsor, updateSponsor, removeSponsor } from '../../../api/financeSponsors.js';

function fmtMoney(n) {
  return n == null ? '—' : n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function renderSponsorsSection(c, canManage) {
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addSponsorBtn" style="width:100%;">+ Nuovo sponsor</button></div>` : ''}
    <div class="section-label">Sponsor (${state.financeSponsors.length})</div>
    <div id="sponsorList"></div>
  `;
  function draw() {
    const holder = document.getElementById('sponsorList');
    if (state.financeSponsors.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessuno sponsor in anagrafica.</div>'; return; }
    holder.innerHTML = '';
    state.financeSponsors.forEach(s => {
      const sector = state.sectors.find(x => x.id === s.sector_id);
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `<div class="main"><div class="nm">${esc(s.name)}${!s.active ? ' <span class="hint">(disattivato)</span>' : ''}</div>
        <div class="sub">${sector ? esc(sector.name) : 'Generale'}${s.contract_start ? ' · ' + s.contract_start + (s.contract_end ? ' → ' + s.contract_end : '') : ''}</div></div>
        <div style="font-family:var(--font-mono);font-size:13px;color:var(--gold);">${fmtMoney(s.contract_value)}</div>` +
        (canManage ? `<button class="icon-btn" data-edit="${s.id}">✎</button><button class="icon-btn danger" data-rm="${s.id}">✕</button>` : '');
      holder.appendChild(row);
    });
    if (!canManage) return;
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openModal(state.financeSponsors.find(s => s.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      const s = state.financeSponsors.find(x => x.id === btn.getAttribute('data-rm'));
      confirmModal('Eliminare lo sponsor?', `"${s.name}" verrà eliminato.`, async () => {
        await removeSponsor(s.id);
        state.financeSponsors = state.financeSponsors.filter(x => x.id !== s.id);
        draw();
        toast('Sponsor eliminato');
      }, 'Elimina');
    });
  }
  draw();
  const addBtn = document.getElementById('addSponsorBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    formModal(existing ? 'Modifica sponsor' : 'Nuovo sponsor', `
      <div class="field"><label>Nome</label><input type="text" id="spName" value="${existing ? esc(existing.name) : ''}"></div>
      <div class="field"><label>Settore collegato (opzionale)</label>
        <select id="spSector">
          <option value="">— Nessuno (sponsor generale)</option>
          ${state.sectors.map(x => `<option value="${x.id}" ${existing && existing.sector_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}
        </select>
      </div>
      <div class="row2">
        <div class="field"><label>Valore contratto (€)</label><input type="number" step="0.01" id="spValue" value="${existing && existing.contract_value != null ? existing.contract_value : ''}"></div>
        <div class="field"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Inizio contratto</label><input type="date" id="spStart" value="${existing ? existing.contract_start || '' : ''}"></div>
        <div class="field"><label>Fine contratto</label><input type="date" id="spEnd" value="${existing ? existing.contract_end || '' : ''}"></div>
      </div>
      <div class="field"><label>Note</label><input type="text" id="spNotes" value="${existing ? esc(existing.notes || '') : ''}"></div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="spActive" ${existing.active ? 'checked' : ''} style="width:auto;"> Attivo</label></div>` : ''}
    `, async () => {
      const name = document.getElementById('spName').value.trim();
      if (!name) return 'Inserisci il nome dello sponsor.';
      const patch = {
        name,
        sector_id: document.getElementById('spSector').value || null,
        contract_value: document.getElementById('spValue').value ? parseFloat(document.getElementById('spValue').value) : null,
        contract_start: document.getElementById('spStart').value || null,
        contract_end: document.getElementById('spEnd').value || null,
        notes: document.getElementById('spNotes').value.trim() || null
      };
      if (existing) {
        patch.active = document.getElementById('spActive').checked;
        const updated = await updateSponsor(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const created = await createSponsor(state.teamProfile.id, patch);
        state.financeSponsors.push(created);
      }
      draw();
      toast('Sponsor salvato');
    });
  }
}

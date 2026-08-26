import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createFiscalYear, closeFiscalYear, reopenFiscalYear } from '../../../api/financeFiscalYears.js';
import { isFinanceAdmin } from '../../../utils/permissions.js';

export function renderFiscalYearsSection(c, canManage) {
  const canReopen = isFinanceAdmin(state.currentUser);
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addFyBtn" style="width:100%;">+ Nuovo esercizio</button></div>` : ''}
    <div class="section-label">Esercizi (${state.financeFiscalYears.length})</div>
    <div id="fyList"></div>
  `;
  function draw() {
    const holder = document.getElementById('fyList');
    if (state.financeFiscalYears.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun esercizio configurato: crearne uno è necessario prima di registrare movimenti.</div>'; return; }
    holder.innerHTML = '';
    [...state.financeFiscalYears].sort((a, b) => b.start_date.localeCompare(a.start_date)).forEach(fy => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '14px';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${esc(fy.name)}</div>
          <div class="hint">${fy.start_date} → ${fy.end_date}</div>
        </div>
        <span class="status-badge ${fy.closed ? 'rejected' : 'ok'}">${fy.closed ? 'Chiuso' : 'Aperto'}</span>
        ${canManage && !fy.closed ? `<button class="btn btn-secondary" data-close="${fy.id}" style="width:auto;">Chiudi</button>` : ''}
        ${canReopen && fy.closed ? `<button class="btn btn-ghost" data-reopen="${fy.id}" style="width:auto;">Riapri</button>` : ''}
      `;
      holder.appendChild(row);
    });
    if (!canManage) return;
    holder.querySelectorAll('[data-close]').forEach(btn => btn.onclick = () => {
      const fy = state.financeFiscalYears.find(x => x.id === btn.getAttribute('data-close'));
      confirmModal('Chiudere l\'esercizio?', `"${fy.name}" verrà bloccato in scrittura: servirà un amministratore per riaprirlo.`, async () => {
        const updated = await closeFiscalYear(fy.id, state.currentUser.id);
        Object.assign(fy, updated);
        draw();
        toast('Esercizio chiuso');
      }, 'Chiudi');
    });
    holder.querySelectorAll('[data-reopen]').forEach(btn => btn.onclick = () => {
      const fy = state.financeFiscalYears.find(x => x.id === btn.getAttribute('data-reopen'));
      confirmModal('Riaprire l\'esercizio?', `"${fy.name}" tornerà scrivibile.`, async () => {
        const updated = await reopenFiscalYear(fy.id);
        Object.assign(fy, updated);
        draw();
        toast('Esercizio riaperto');
      }, 'Riapri');
    });
  }
  draw();
  const addBtn = document.getElementById('addFyBtn');
  if (addBtn) addBtn.onclick = () => {
    formModal('Nuovo esercizio', `
      <div class="field"><label>Nome</label><input type="text" id="fyName" placeholder="Es. 2025/2026"></div>
      <div class="row2">
        <div class="field"><label>Data inizio</label><input type="date" id="fyStart"></div>
        <div class="field"><label>Data fine</label><input type="date" id="fyEnd"></div>
      </div>
    `, async () => {
      const name = document.getElementById('fyName').value.trim();
      const start = document.getElementById('fyStart').value;
      const end = document.getElementById('fyEnd').value;
      if (!name) return 'Inserisci un nome.';
      if (!start || !end) return 'Inserisci data inizio e fine.';
      if (end <= start) return 'La data fine deve essere successiva alla data inizio.';
      const created = await createFiscalYear(state.teamProfile.id, { name, start_date: start, end_date: end });
      state.financeFiscalYears.push(created);
      draw();
      toast('Esercizio creato');
    });
  };
}

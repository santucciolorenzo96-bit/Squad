import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { createAccount, updateAccount, removeAccount, fetchAccountBalances } from '../../../api/financeAccounts.js';

const TYPE_LABELS = { bank: 'Conto corrente', cash: 'Cassa', card: 'Carta', paypal: 'PayPal', other: 'Altro' };

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export function renderAccountsSection(c, canManage) {
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-secondary" id="addAccountBtn" style="width:100%;">+ Nuovo conto</button></div>` : ''}
    <div class="section-label">Conti (${state.financeAccounts.length})</div>
    <div id="accountList"></div>
  `;
  function draw() {
    const holder = document.getElementById('accountList');
    if (state.financeAccounts.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun conto configurato.</div>'; return; }
    holder.innerHTML = '';
    state.financeAccounts.forEach(a => {
      const balance = state.financeAccountBalances[a.id];
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '14px';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${esc(a.name)} ${!a.active ? '<span class="hint">(inattivo)</span>' : ''}</div>
          <div class="hint">${TYPE_LABELS[a.type] || a.type}${a.iban ? ' · ' + esc(a.iban) : ''}</div>
        </div>
        <div style="font-family:var(--font-display);font-weight:700;font-size:16px;color:${balance < 0 ? 'var(--red)' : 'var(--gold)'};">${fmtMoney(balance)}</div>
        ${canManage ? `<button class="icon-btn" data-edit="${a.id}">✎</button><button class="icon-btn danger" data-rm="${a.id}">✕</button>` : ''}
      `;
      holder.appendChild(row);
    });
    if (!canManage) return;
    holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openModal(state.financeAccounts.find(a => a.id === btn.getAttribute('data-edit'))));
    holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      const a = state.financeAccounts.find(x => x.id === btn.getAttribute('data-rm'));
      confirmModal('Eliminare il conto?', `"${a.name}" verrà eliminato. Non è possibile se ha già movimenti collegati.`, async () => {
        try {
          await removeAccount(a.id);
          state.financeAccounts = state.financeAccounts.filter(x => x.id !== a.id);
          draw();
          toast('Conto eliminato');
        } catch (e) {
          toast(e.message && e.message.includes('violates foreign key') ? 'Il conto ha movimenti collegati: disattivalo invece di eliminarlo.' : (e.message || 'Errore'));
        }
      }, 'Elimina');
    });
  }
  draw();
  const addBtn = document.getElementById('addAccountBtn');
  if (addBtn) addBtn.onclick = () => openModal(null);

  function openModal(existing) {
    const a = existing || { name: '', type: 'bank', iban: '', initial_balance: 0, initial_balance_date: new Date().toISOString().slice(0, 10), active: true, notes: '' };
    formModal(existing ? 'Modifica conto' : 'Nuovo conto', `
      <div class="field"><label>Nome</label><input type="text" id="acName" value="${esc(a.name)}" placeholder="Es. Conto corrente principale"></div>
      <div class="row2">
        <div class="field"><label>Tipo</label>
          <select id="acType">${Object.entries(TYPE_LABELS).map(([k, v]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        </div>
        <div class="field"><label>IBAN</label><input type="text" id="acIban" value="${esc(a.iban || '')}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Saldo iniziale</label><input type="number" step="0.01" id="acBalance" value="${a.initial_balance}" ${existing ? 'disabled' : ''}></div>
        <div class="field"><label>Data saldo iniziale</label><input type="date" id="acDate" value="${a.initial_balance_date}" ${existing ? 'disabled' : ''}></div>
      </div>
      ${existing ? '<div class="hint">Il saldo iniziale non è modificabile dopo la creazione: correggilo con un movimento se necessario.</div>' : ''}
      <div class="field"><label>Note</label><input type="text" id="acNotes" value="${esc(a.notes || '')}"></div>
      ${existing ? `<div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="acActive" ${a.active ? 'checked' : ''} style="width:auto;"> Conto attivo</label></div>` : ''}
    `, async () => {
      const name = document.getElementById('acName').value.trim();
      if (!name) return 'Inserisci il nome del conto.';
      const patch = {
        name,
        type: document.getElementById('acType').value,
        iban: document.getElementById('acIban').value.trim() || null,
        notes: document.getElementById('acNotes').value.trim() || null
      };
      if (existing) {
        patch.active = document.getElementById('acActive').checked;
        const updated = await updateAccount(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        patch.initial_balance = parseFloat(document.getElementById('acBalance').value) || 0;
        patch.initial_balance_date = document.getElementById('acDate').value;
        const created = await createAccount(state.teamProfile.id, patch);
        state.financeAccounts.push(created);
      }
      state.financeAccountBalances = await fetchAccountBalances(state.teamProfile.id);
      draw();
      toast('Conto salvato');
    });
  }
}

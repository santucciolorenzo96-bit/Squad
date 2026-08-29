import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { formModal, confirmModal, toast } from '../../modal.js';
import { fetchEntries, fetchEntryDetail, createEntry, updateEntry, cancelEntry } from '../../../api/financeEntries.js';
import { createPayment } from '../../../api/financePayments.js';
import { uploadFinanceDocument, getFinanceDocumentSignedUrl, removeFinanceDocument } from '../../../api/financeDocuments.js';
import { FINANCE_DOC_TYPES } from '../../../utils/permissions.js';
import { fetchAccountBalances } from '../../../api/financeAccounts.js';

const STATUS_LABELS = {
  previsto: 'Previsto', scaduto: 'Scaduto', pagato: 'Pagato', incassato: 'Incassato',
  parzialmente_pagato: 'Parziale', parzialmente_incassato: 'Parziale', annullato: 'Annullato'
};
const STATUS_CLASS = {
  previsto: 'pending', scaduto: 'rejected', pagato: 'ok', incassato: 'ok',
  parzialmente_pagato: 'pending', parzialmente_incassato: 'pending', annullato: 'rejected'
};

function fmtMoney(n) { return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }

export function renderIncomeSection(c, canManage) { renderEntriesSection(c, canManage, 'income'); }
export function renderExpenseSection(c, canManage) { renderEntriesSection(c, canManage, 'expense'); }

async function renderEntriesSection(c, canManage, kind) {
  c.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
  const entries = await fetchEntries(state.teamProfile.id, kind);
  drawList(c, canManage, kind, entries);
}

function partyLabel(e) {
  if (e.party_name) return e.party_name;
  return null; // il nome giocatore/sponsor/fornitore va risolto dal chiamante se serve; qui basta la descrizione
}

function drawList(c, canManage, kind, entries) {
  const label = kind === 'income' ? 'Entrate' : 'Uscite';
  c.innerHTML = `
    ${canManage ? `<div class="card"><button class="btn btn-primary" id="addEntryBtn" style="width:100%;">+ Nuov${kind === 'income' ? 'a entrata' : 'a uscita'}</button></div>` : ''}
    <div class="section-label">${label} (${entries.length})</div>
    <div id="entryList"></div>
  `;
  const holder = document.getElementById('entryList');
  if (entries.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun movimento registrato.</div>'; return; }
  [...entries].sort((a, b) => b.accrual_date.localeCompare(a.accrual_date)).forEach(e => {
    const st = e._status || {};
    const row = document.createElement('div');
    row.className = 'card';
    row.style.cursor = 'pointer';
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${esc(e.description)}${partyLabel(e) ? ' · ' + esc(partyLabel(e)) : ''}</div>
          <div class="hint">${e.finance_categories ? esc(e.finance_categories.name) : '—'} · ${e.accrual_date}${e.due_date ? ' · scad. ' + e.due_date : ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;">
          <div style="font-family:var(--font-display);font-weight:700;font-size:15px;">${fmtMoney(e.planned_amount)}</div>
          <span class="status-badge ${STATUS_CLASS[st.status] || 'pending'}">${STATUS_LABELS[st.status] || st.status || ''}</span>
        </div>
      </div>
    `;
    row.onclick = () => openDetail(c, canManage, kind, e.id);
    holder.appendChild(row);
  });
  const addBtn = document.getElementById('addEntryBtn');
  if (addBtn) addBtn.onclick = () => openEntryModal(c, canManage, kind, null, null, () => renderEntriesSection(c, canManage, kind));
}

async function openDetail(c, canManage, kind, entryId) {
  c.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
  const { entry, allocations, payments, documents, status } = await fetchEntryDetail(entryId);
  const back = () => renderEntriesSection(c, canManage, kind);

  c.innerHTML = `
    <button class="btn btn-ghost" id="backBtn" style="margin-bottom:14px;">← Torna a ${kind === 'income' ? 'Entrate' : 'Uscite'}</button>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:17px;">${esc(entry.description)}</div>
          <div class="hint">${entry.finance_categories ? esc(entry.finance_categories.name) : '—'} · competenza ${entry.accrual_date}${entry.due_date ? ' · scadenza ' + entry.due_date : ''}</div>
          ${entry.party_name ? `<div class="hint">Controparte: ${esc(entry.party_name)}</div>` : ''}
          ${entry.notes ? `<div class="hint">${esc(entry.notes)}</div>` : ''}
        </div>
        <span class="status-badge ${STATUS_CLASS[status && status.status] || 'pending'}">${STATUS_LABELS[status && status.status] || (status && status.status) || ''}</span>
      </div>
      <div class="stat-highlight" style="margin-top:14px;">
        <div class="box"><div class="lbl">Importo</div><div class="val">${fmtMoney(entry.planned_amount)}</div></div>
        <div class="box"><div class="lbl">${kind === 'income' ? 'Incassato' : 'Pagato'}</div><div class="val">${fmtMoney(status && status.paid_amount)}</div></div>
      </div>
      ${status && status.residual_amount > 0 && !entry.cancelled_at ? `<div class="hint" style="margin-top:8px;">Residuo: ${fmtMoney(status.residual_amount)}</div>` : ''}
      ${entry.cancelled_at ? `<div class="hint">Annullato${entry.cancelled_reason ? ': ' + esc(entry.cancelled_reason) : ''}</div>` : ''}
      ${canManage && !entry.cancelled_at ? `
      <div style="display:flex;gap:8px;margin-top:14px;">
        <button class="btn btn-secondary" id="editEntryBtn" style="flex:1;">Modifica</button>
        <button class="btn btn-danger" id="cancelEntryBtn" style="flex:1;">Annulla movimento</button>
      </div>` : ''}
    </div>

    <div class="section-label">Ripartizione</div>
    <div class="card">
      ${allocations.map(a => `<div style="display:flex;justify-content:space-between;padding:4px 0;"><span>${a.cost_centers ? esc(a.cost_centers.name) : '—'}</span><span>${fmtMoney(a.amount)}</span></div>`).join('')}
    </div>

    <div class="section-label">Pagamenti${canManage && !entry.cancelled_at ? '' : ''}</div>
    ${canManage && !entry.cancelled_at ? `<div class="card"><button class="btn btn-secondary" id="addPaymentBtn" style="width:100%;">+ Registra ${kind === 'income' ? 'incasso' : 'pagamento'}</button></div>` : ''}
    <div id="paymentList"></div>

    <div class="section-label">Documenti</div>
    ${canManage ? `<div class="card"><input type="file" id="docInput" class="hidden" accept=".pdf,image/*"><button class="btn btn-secondary" id="addDocBtn" style="width:100%;">+ Carica documento</button></div>` : ''}
    <div id="docList"></div>
  `;

  document.getElementById('backBtn').onclick = back;

  const paymentHolder = document.getElementById('paymentList');
  if (payments.length === 0) { paymentHolder.innerHTML = '<div class="placeholder-card">Nessun pagamento registrato.</div>'; }
  else {
    paymentHolder.innerHTML = '';
    payments.forEach(p => {
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.innerHTML = `
        <div>
          <div style="font-weight:600;">${fmtMoney(p.amount)} ${p.cancelled_at ? '<span class="hint">(annullato)</span>' : ''}</div>
          <div class="hint">${p.paid_at} · ${p.finance_accounts ? esc(p.finance_accounts.name) : ''} · ${p.method}${p.reconciled ? ' · riconciliato' : ''}</div>
        </div>
      `;
      paymentHolder.appendChild(row);
    });
  }

  const docHolder = document.getElementById('docList');
  if (documents.length === 0) { docHolder.innerHTML = '<div class="placeholder-card">Nessun documento allegato.</div>'; }
  else {
    docHolder.innerHTML = '';
    documents.forEach(d => {
      const label = (FINANCE_DOC_TYPES.find(t => t.key === d.doc_type) || {}).label || d.doc_type;
      const row = document.createElement('div');
      row.className = 'card';
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.gap = '8px';
      row.innerHTML = `
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(d.file_name)}</div>
          <div class="hint">${esc(label)} · ${new Date(d.uploaded_at).toLocaleDateString('it-IT')}</div>
        </div>
        <button class="btn btn-secondary" data-view="${d.file_path}" style="width:auto;">Apri</button>
        ${canManage ? `<button class="icon-btn danger" data-rm="${d.id}">✕</button>` : ''}
      `;
      docHolder.appendChild(row);
    });
    docHolder.querySelectorAll('[data-view]').forEach(btn => btn.onclick = async () => {
      const url = await getFinanceDocumentSignedUrl(btn.getAttribute('data-view'));
      window.open(url, '_blank');
    });
    docHolder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
      confirmModal('Eliminare il documento?', '', async () => {
        await removeFinanceDocument(btn.getAttribute('data-rm'));
        openDetail(c, canManage, kind, entryId);
      }, 'Elimina');
    });
  }

  if (!canManage) return;

  const editBtn = document.getElementById('editEntryBtn');
  if (editBtn) editBtn.onclick = () => openEntryModal(c, canManage, kind, entry, allocations, () => openDetail(c, canManage, kind, entryId));

  const cancelBtn = document.getElementById('cancelEntryBtn');
  if (cancelBtn) cancelBtn.onclick = () => {
    formModal('Annullare il movimento?', `<div class="hint">Il movimento resterà visibile come annullato (storno), non verrà eliminato.</div><div class="field"><label>Motivo (opzionale)</label><input type="text" id="cancelReason"></div>`, async () => {
      await cancelEntry(entry.id, document.getElementById('cancelReason').value.trim() || null);
      toast('Movimento annullato');
      openDetail(c, canManage, kind, entryId);
    });
  };

  const addPaymentBtn = document.getElementById('addPaymentBtn');
  if (addPaymentBtn) addPaymentBtn.onclick = async () => {
    const balances = await fetchAccountBalances(state.teamProfile.id).catch(() => ({}));
    const residual = status ? Math.max(0, status.residual_amount) : entry.planned_amount;
    formModal(kind === 'income' ? 'Registra incasso' : 'Registra pagamento', `
      <div class="field"><label>Conto</label>
        <select id="pAccount">${state.financeAccounts.filter(a => a.active).map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('') || '<option disabled>Nessun conto configurato</option>'}</select>
      </div>
      <div class="row2">
        <div class="field"><label>Importo</label><input type="number" step="0.01" id="pAmount" value="${residual || ''}"></div>
        <div class="field"><label>Data</label><input type="date" id="pDate" value="${new Date().toISOString().slice(0, 10)}"></div>
      </div>
      <div class="field"><label>Metodo</label>
        <select id="pMethod">
          <option value="bonifico">Bonifico</option>
          <option value="contanti">Contanti</option>
          <option value="carta">Carta</option>
          <option value="assegno">Assegno</option>
          <option value="paypal">PayPal</option>
          <option value="altro">Altro</option>
        </select>
      </div>
    `, async () => {
      const accountId = document.getElementById('pAccount').value;
      if (!accountId) return 'Configura almeno un conto prima di registrare un pagamento.';
      const amount = parseFloat(document.getElementById('pAmount').value);
      if (!amount || amount <= 0) return 'Inserisci un importo valido.';
      const paidAt = document.getElementById('pDate').value;
      if (!paidAt) return 'Inserisci la data.';
      try {
        await createPayment(state.teamProfile.id, {
          entry_id: entry.id, account_id: accountId, kind, amount, paid_at: paidAt,
          method: document.getElementById('pMethod').value, created_by: state.currentUser.id
        });
        toast('Pagamento registrato');
        openDetail(c, canManage, kind, entryId);
      } catch (e) {
        return e.message || 'Errore nella registrazione.';
      }
    });
  };

  const addDocBtn = document.getElementById('addDocBtn');
  if (addDocBtn) {
    addDocBtn.onclick = () => document.getElementById('docInput').click();
    document.getElementById('docInput').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      formModal('Tipo di documento', `
        <div class="field"><label>Tipo</label>
          <select id="docType">${FINANCE_DOC_TYPES.map(t => `<option value="${t.key}">${t.label}</option>`).join('')}</select>
        </div>
      `, async () => {
        try {
          await uploadFinanceDocument(state.teamProfile.id, { entryId: entry.id }, file, document.getElementById('docType').value, state.currentUser.id);
          toast('Documento caricato');
          openDetail(c, canManage, kind, entryId);
        } catch (err) {
          return err.message || 'Errore nel caricamento.';
        }
      });
    };
  }
}

function openEntryModal(c, canManage, kind, existing, existingAllocations, onDone) {
  let allocRows = existingAllocations && existingAllocations.length > 0
    ? existingAllocations.map(a => ({ cost_center_id: a.cost_center_id, amount: a.amount }))
    : [{ cost_center_id: '', amount: existing ? existing.planned_amount : '' }];

  const partyType = existing
    ? (existing.player_id ? 'player' : existing.sponsor_id ? 'sponsor' : existing.supplier_id ? 'supplier' : existing.party_name ? 'free' : 'none')
    : 'none';

  formModal(existing ? 'Modifica movimento' : (kind === 'income' ? 'Nuova entrata' : 'Nuova uscita'), `
    <div class="field"><label>Descrizione</label><input type="text" id="eDesc" value="${existing ? esc(existing.description) : ''}"></div>
    <div class="field"><label>Categoria</label>
      <select id="eCategory">${state.financeCategories.filter(cat => cat.kind === kind && cat.active).map(cat => `<option value="${cat.id}" ${existing && existing.category_id === cat.id ? 'selected' : ''}>${cat.parent_id ? '— ' : ''}${esc(cat.name)}</option>`).join('') || '<option disabled>Nessuna categoria: creane una in Categorie</option>'}</select>
    </div>
    <div class="row2">
      <div class="field"><label>Importo</label><input type="number" step="0.01" id="eAmount" value="${existing ? existing.planned_amount : ''}"></div>
      <div class="field"><label>Data competenza</label><input type="date" id="eAccrual" value="${existing ? existing.accrual_date : new Date().toISOString().slice(0, 10)}"></div>
    </div>
    <div class="field"><label>Scadenza (opzionale)</label><input type="date" id="eDue" value="${existing && existing.due_date ? existing.due_date : ''}"></div>

    <div class="field"><label>Controparte</label>
      <select id="ePartyType">
        <option value="none" ${partyType === 'none' ? 'selected' : ''}>Nessuna</option>
        <option value="player" ${partyType === 'player' ? 'selected' : ''}>Giocatore (settore attivo)</option>
        <option value="sponsor" ${partyType === 'sponsor' ? 'selected' : ''}>Sponsor</option>
        <option value="supplier" ${partyType === 'supplier' ? 'selected' : ''}>Fornitore</option>
        <option value="free" ${partyType === 'free' ? 'selected' : ''}>Altro (testo libero)</option>
      </select>
    </div>
    <div class="field" id="ePartyPlayerWrap">
      <select id="ePartyPlayer">${state.roster.map(p => `<option value="${p.id}" ${existing && existing.player_id === p.id ? 'selected' : ''}>#${esc(p.number)} ${esc(p.name)}</option>`).join('') || '<option disabled>Nessun giocatore nel settore attivo</option>'}</select>
      <div class="hint">Per un giocatore di un altro settore, cambia settore dall'header e riapri questa finestra.</div>
    </div>
    <div class="field" id="ePartySponsorWrap">
      <select id="ePartySponsor">${state.financeSponsors.map(s => `<option value="${s.id}" ${existing && existing.sponsor_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') || '<option disabled>Nessuno sponsor in anagrafica</option>'}</select>
    </div>
    <div class="field" id="ePartySupplierWrap">
      <select id="ePartySupplier">${state.financeSuppliers.map(s => `<option value="${s.id}" ${existing && existing.supplier_id === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('') || '<option disabled>Nessun fornitore in anagrafica</option>'}</select>
    </div>
    <div class="field" id="ePartyFreeWrap">
      <input type="text" id="ePartyFree" placeholder="Es. Genitore, socio…" value="${existing ? esc(existing.party_name || '') : ''}">
    </div>

    <div class="section-label" style="margin:16px 2px 6px;">Ripartizione su centri di costo</div>
    <div id="allocRowsHolder"></div>
    <button class="btn btn-ghost" id="addAllocRowBtn" type="button" style="width:100%;margin-bottom:10px;">+ Aggiungi centro di costo</button>

    <div class="field"><label>Note</label><input type="text" id="eNotes" value="${existing ? esc(existing.notes || '') : ''}"></div>
  `, async () => {
    const description = document.getElementById('eDesc').value.trim();
    if (!description) return 'Inserisci una descrizione.';
    const categoryId = document.getElementById('eCategory').value;
    if (!categoryId) return 'Seleziona una categoria.';
    const amount = parseFloat(document.getElementById('eAmount').value);
    if (!amount || amount <= 0) return 'Inserisci un importo valido.';
    const accrualDate = document.getElementById('eAccrual').value;
    if (!accrualDate) return 'Inserisci la data di competenza.';

    const allocSum = allocRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    if (allocRows.some(r => !r.cost_center_id)) return 'Seleziona un centro di costo per ogni riga di ripartizione.';
    if (Math.abs(allocSum - amount) > 0.005) return `La somma delle ripartizioni (${fmtMoney(allocSum)}) deve coincidere con l'importo (${fmtMoney(amount)}).`;

    const partyType = document.getElementById('ePartyType').value;
    const patch = {
      kind, description, category_id: categoryId, planned_amount: amount,
      accrual_date: accrualDate,
      due_date: document.getElementById('eDue').value || null,
      player_id: partyType === 'player' ? (document.getElementById('ePartyPlayer').value || null) : null,
      sponsor_id: partyType === 'sponsor' ? (document.getElementById('ePartySponsor').value || null) : null,
      supplier_id: partyType === 'supplier' ? (document.getElementById('ePartySupplier').value || null) : null,
      party_name: partyType === 'free' ? (document.getElementById('ePartyFree').value.trim() || null) : null,
      notes: document.getElementById('eNotes').value.trim() || null
    };

    try {
      if (existing) {
        patch.created_by = undefined;
        delete patch.created_by;
        await updateEntry(existing.id, patch);
        // aggiorna ripartizioni: rimpiazza tutte le righe con quelle correnti
        const { supabase } = await import('../../../supabaseClient.js');
        await supabase.from('finance_entry_allocations').delete().eq('entry_id', existing.id);
        await supabase.from('finance_entry_allocations').insert(allocRows.map(r => ({ entry_id: existing.id, cost_center_id: r.cost_center_id, amount: parseFloat(r.amount) })));
      } else {
        patch.created_by = state.currentUser.id;
        await createEntry(state.teamProfile.id, patch, allocRows.map(r => ({ cost_center_id: r.cost_center_id, amount: parseFloat(r.amount) })));
      }
      toast('Movimento salvato');
      onDone();
    } catch (e) {
      return e.message || 'Errore nel salvataggio.';
    }
  }, { wide: true });

  // controparte dinamica
  const partySel = document.getElementById('ePartyType');
  function refreshPartyVisibility() {
    const v = partySel.value;
    document.getElementById('ePartyPlayerWrap').style.display = v === 'player' ? '' : 'none';
    document.getElementById('ePartySponsorWrap').style.display = v === 'sponsor' ? '' : 'none';
    document.getElementById('ePartySupplierWrap').style.display = v === 'supplier' ? '' : 'none';
    document.getElementById('ePartyFreeWrap').style.display = v === 'free' ? '' : 'none';
  }
  partySel.onchange = refreshPartyVisibility;
  refreshPartyVisibility();

  // righe di ripartizione dinamiche
  function drawAllocRows() {
    const holder = document.getElementById('allocRowsHolder');
    holder.innerHTML = '';
    allocRows.forEach((r, i) => {
      const row = document.createElement('div');
      row.className = 'row2';
      row.style.alignItems = 'end';
      row.innerHTML = `
        <div class="field"><label>Centro di costo</label>
          <select data-i="${i}" data-f="cc">${state.financeCostCenters.filter(cc => cc.active).map(cc => `<option value="${cc.id}" ${r.cost_center_id === cc.id ? 'selected' : ''}>${esc(cc.name)}</option>`).join('') || '<option disabled>Nessun centro configurato</option>'}</select>
        </div>
        <div style="display:flex;gap:6px;align-items:end;">
          <div class="field" style="flex:1;"><label>Importo</label><input type="number" step="0.01" data-i="${i}" data-f="amount" value="${r.amount}"></div>
          ${allocRows.length > 1 ? `<button class="icon-btn danger" data-rmrow="${i}" type="button" style="margin-bottom:12px;">✕</button>` : ''}
        </div>
      `;
      holder.appendChild(row);
    });
    holder.querySelectorAll('select[data-f="cc"]').forEach(el => el.onchange = () => { allocRows[+el.getAttribute('data-i')].cost_center_id = el.value; });
    holder.querySelectorAll('input[data-f="amount"]').forEach(el => el.oninput = () => { allocRows[+el.getAttribute('data-i')].amount = el.value; });
    holder.querySelectorAll('[data-rmrow]').forEach(btn => btn.onclick = () => { allocRows.splice(+btn.getAttribute('data-rmrow'), 1); drawAllocRows(); });
  }
  drawAllocRows();
  document.getElementById('addAllocRowBtn').onclick = () => { allocRows.push({ cost_center_id: '', amount: '' }); drawAllocRows(); };
}

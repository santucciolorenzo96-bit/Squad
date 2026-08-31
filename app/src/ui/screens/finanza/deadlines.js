import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { fetchDeadlines } from '../../../api/financeEntries.js';
import { showLoadError } from '../../modal.js';

function fmtMoney(n) { return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }); }

function bucketFor(dueDate) {
  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (dueDate < today) return { key: 'scaduto', label: 'Scaduto', cls: 'rejected' };
  if (dueDate === today) return { key: 'oggi', label: 'Oggi', cls: 'pending' };
  if (dueDate <= in7) return { key: '7g', label: 'Entro 7 giorni', cls: 'pending' };
  if (dueDate <= in30) return { key: '30g', label: 'Entro 30 giorni', cls: 'ok' };
  return { key: 'futuro', label: 'Futuro', cls: 'ok' };
}

export async function renderDeadlinesSection(c, canManage) {
  c.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
  let deadlines;
  try {
    deadlines = await fetchDeadlines(state.teamProfile.id);
  } catch (e) {
    showLoadError(c, e, 'le scadenze');
    return;
  }

  c.innerHTML = `
    <div class="field"><label>Filtra per tipo</label>
      <select id="ddKind">
        <option value="all">Tutte</option>
        <option value="income">Solo entrate</option>
        <option value="expense">Solo uscite</option>
      </select>
    </div>
    <div class="section-label">Scadenze (${deadlines.length})</div>
    <div id="ddList"></div>
  `;
  const kindSel = document.getElementById('ddKind');
  kindSel.onchange = draw;
  draw();

  function draw() {
    const kind = kindSel.value;
    const filtered = kind === 'all' ? deadlines : deadlines.filter(d => d.kind === kind);
    const holder = document.getElementById('ddList');
    if (filtered.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessuna scadenza in sospeso.</div>'; return; }
    holder.innerHTML = '';
    [...filtered].sort((a, b) => a.due_date.localeCompare(b.due_date)).forEach(e => {
      const bucket = bucketFor(e.due_date);
      const row = document.createElement('div');
      row.className = 'card';
      row.style.cursor = 'pointer';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${e.kind === 'income' ? '↓' : '↑'} ${esc(e.description)}</div>
            <div class="hint">${e.finance_categories ? esc(e.finance_categories.name) : '—'} · scad. ${e.due_date}</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:var(--font-display);font-weight:700;font-size:15px;">${fmtMoney(e._status ? e._status.residual_amount : e.planned_amount)}</div>
            <span class="status-badge ${bucket.cls}">${bucket.label}</span>
          </div>
        </div>
      `;
      row.onclick = async () => {
        state.financeSubTab = e.kind === 'income' ? 'entrate' : 'uscite';
        const { renderFinanzaTab } = await import('./index.js');
        renderFinanzaTab(c.closest('.tab-content') || c.parentElement);
      };
      holder.appendChild(row);
    });
  }
}

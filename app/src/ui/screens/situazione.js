import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { showLoadError } from '../modal.js';
import { detectIssues, todayISO, SEVERITY_LABEL } from '../../utils/issues.js';
import {
  fetchAllPlayers, fetchAllPlayerDocuments, fetchOpenDeadlines,
  fetchOpenCommunications, fetchTrainingsInRange
} from '../../api/dashboard.js';
import { fetchAttendanceForTrainings } from '../../api/attendance.js';

const SEVERITY_COLOR = { critical: 'var(--red)', warning: 'var(--amber)', info: 'var(--gold)' };
const PREVIEW_ITEMS = 4;

// Quanto indietro guardare per le presenze non rilevate: oltre le tre settimane
// non è più un promemoria utile, è archeologia.
const TRAINING_WINDOW_DAYS = 21;

function daysAgoISO(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

async function goToTab(tab) {
  state.currentTab = tab;
  const { renderApp } = await import('../layout.js');
  renderApp();
}

// Un contatto diretto vale più di qualsiasi automatismo: se c'è un numero,
// dallo all'amministratore così com'è, pronto da toccare.
function contactHtml(person) {
  if (!person) return '';
  if (person.guardian_phone) {
    return `<a class="sit-contact" href="tel:${esc(person.guardian_phone.replace(/\s/g, ''))}">${esc(person.guardian_phone)}</a>`;
  }
  if (person.email) {
    return `<a class="sit-contact" href="mailto:${esc(person.email)}">${esc(person.email)}</a>`;
  }
  return '';
}

function itemHtml(item) {
  const contacts = (item.contacts || [])
    .map(p => `<span class="sit-chip">${esc(p.name)}${p.guardian_phone ? ' ' + contactHtml(p) : ''}</span>`)
    .join('');
  return `
    <div class="sit-item">
      <div class="sit-item-main">
        <div class="nm">${esc(item.label)}</div>
        <div class="sub">${esc(item.sub || '')}</div>
        ${contacts ? `<div class="sit-chips">${contacts}</div>` : ''}
      </div>
      ${item.player ? contactHtml(item.player) : ''}
    </div>`;
}

function issueCardHtml(issue, index) {
  const shown = issue.items.slice(0, PREVIEW_ITEMS);
  const rest = issue.items.length - shown.length;
  return `
    <div class="card sit-card" data-issue="${esc(issue.id)}" style="--sev:${SEVERITY_COLOR[issue.severity]};animation-delay:${Math.min(index, 6) * 45}ms;">
      <div class="sit-head">
        <div>
          <div class="sit-sev">${SEVERITY_LABEL[issue.severity]}</div>
          <div class="sit-title">${esc(issue.title)}</div>
        </div>
        <div class="sit-count">${issue.items.length}</div>
      </div>
      <div class="sit-summary">${esc(issue.summary)}</div>
      <div class="sit-items" data-list="${esc(issue.id)}">${shown.map(itemHtml).join('')}</div>
      ${rest > 0 ? `<button class="btn btn-ghost sit-more" data-more="${esc(issue.id)}">Mostra tutti (${issue.items.length})</button>` : ''}
      ${issue.action ? `<button class="btn btn-secondary sit-action" data-tab="${esc(issue.action.tab)}">${esc(issue.action.label)}</button>` : ''}
    </div>`;
}

export async function renderSituazioneTab(c) {
  c.innerHTML = `
    <div class="section-label">
      <span>Situazione della società</span>
      <button class="btn btn-ghost" id="sitReload" style="padding:4px 10px;font-size:11px;">Aggiorna</button>
    </div>
    <div id="sitBody">
      <div class="skeleton skeleton-row" style="height:96px;margin-bottom:12px;"></div>
      <div class="skeleton skeleton-row" style="height:150px;"></div>
      <div class="skeleton skeleton-row" style="height:150px;"></div>
    </div>`;

  document.getElementById('sitReload').onclick = () => renderSituazioneTab(c);

  const body = document.getElementById('sitBody');
  const teamId = state.teamProfile.id;
  const today = todayISO();
  const hasFinance = !!state.currentUser.finance_role;

  let players, documents, communications, trainings, attendance;
  try {
    [players, documents, communications, trainings] = await Promise.all([
      fetchAllPlayers(teamId),
      fetchAllPlayerDocuments(teamId),
      fetchOpenCommunications(teamId),
      fetchTrainingsInRange(teamId, daysAgoISO(TRAINING_WINDOW_DAYS), today)
    ]);
    attendance = await fetchAttendanceForTrainings(trainings.map(t => t.id));
  } catch (e) {
    if (document.getElementById('sitBody')) showLoadError(body, e, 'la situazione della società');
    return;
  }

  // La finanza ha autorizzazioni proprie e più fini dei ruoli: se non passano,
  // il resto dei controlli resta valido e va mostrato lo stesso.
  let deadlines = [];
  let financeBlocked = false;
  if (hasFinance) {
    try { deadlines = await fetchOpenDeadlines(teamId); }
    catch (e) { financeBlocked = true; }
  }
  if (!document.getElementById('sitBody')) return; // tab cambiata durante il caricamento

  const issues = detectIssues({
    today, players, documents, deadlines, communications, trainings, attendance,
    sponsors: state.financeSponsors, sectors: state.sectors, hasFinance
  });

  const counts = { critical: 0, warning: 0, info: 0 };
  issues.forEach(i => { counts[i.severity] += i.items.length; });
  const totalItems = counts.critical + counts.warning + counts.info;

  body.innerHTML = `
    <div class="card sit-hero ${issues.length === 0 ? 'clear' : ''}">
      <div class="sit-hero-main">
        <div class="sit-hero-title">${issues.length === 0
          ? 'Tutto in regola'
          : totalItems + (totalItems === 1 ? ' cosa richiede attenzione' : ' cose richiedono attenzione')}</div>
        <div class="sit-hero-sub">${issues.length === 0
          ? 'Certificati, scadenze, conferme e presenze: nessuna anomalia rilevata su tutte le categorie.'
          : 'Controllo su tutte le categorie: certificati, scadenze economiche, conferme e presenze.'}</div>
      </div>
      ${issues.length ? `
      <div class="sit-hero-counts">
        ${counts.critical ? `<div class="sit-badge critical"><b>${counts.critical}</b><span>Da risolvere</span></div>` : ''}
        ${counts.warning ? `<div class="sit-badge warning"><b>${counts.warning}</b><span>Da seguire</span></div>` : ''}
        ${counts.info ? `<div class="sit-badge info"><b>${counts.info}</b><span>Da sistemare</span></div>` : ''}
      </div>` : ''}
    </div>

    ${issues.length === 0
      ? '<div class="placeholder-card">Non c\'è niente da fare adesso. Questa pagina si ricontrolla ogni volta che la apri.</div>'
      : issues.map(issueCardHtml).join('')}

    <div class="hint">I controlli si basano solo sui dati già inseriti nell'app e vengono ricalcolati a ogni apertura.${!hasFinance ? ' Le scadenze economiche compaiono solo per chi ha accesso alla Finanza.' : (financeBlocked ? ' Le scadenze economiche non sono state caricate: il tuo profilo finanza non ha i permessi per leggerle.' : '')}</div>
  `;

  body.querySelectorAll('[data-more]').forEach(btn => {
    btn.onclick = () => {
      const issue = issues.find(i => i.id === btn.dataset.more);
      if (!issue) return;
      body.querySelector(`[data-list="${issue.id}"]`).innerHTML = issue.items.map(itemHtml).join('');
      btn.remove();
    };
  });

  body.querySelectorAll('.sit-action').forEach(btn => {
    btn.onclick = () => goToTab(btn.dataset.tab);
  });
}

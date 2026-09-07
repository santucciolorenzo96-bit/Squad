import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { showLoadError } from '../modal.js';
import { detectIssues, todayISO } from '../../utils/issues.js';
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

// Le sovrapposizioni di palestra si cercano in avanti: su quelle passate non
// c'e' piu' niente da decidere.
const TRAINING_AHEAD_DAYS = 21;

function daysAheadISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

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

function issueCardHtml(issue, index, groupKey) {
  const shown = issue.items.slice(0, PREVIEW_ITEMS);
  const rest = issue.items.length - shown.length;
  return `
    <div class="card sit-card" data-issue="${esc(groupKey + '|' + issue.id)}" style="--sev:${SEVERITY_COLOR[issue.severity]};animation-delay:${Math.min(index, 6) * 45}ms;">
      <div class="sit-head">
        <div class="sit-title">${esc(issue.title)}</div>
        <div class="sit-count">${issue.items.length}</div>
      </div>
      <div class="sit-summary">${esc(issue.summary)}</div>
      <div class="sit-items" data-list="${esc(groupKey + '|' + issue.id)}">${shown.map(itemHtml).join('')}</div>
      ${rest > 0 ? `<button class="btn btn-ghost sit-more" data-more="${esc(groupKey + '|' + issue.id)}">Mostra tutti (${issue.items.length})</button>` : ''}
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
      fetchTrainingsInRange(teamId, daysAgoISO(TRAINING_WINDOW_DAYS), daysAheadISO(TRAINING_AHEAD_DAYS))
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

  // I problemi si dividono per categoria, che e' la divisione con cui una
  // societa' ragiona davvero: chi guarda l'Under 15 vuole i problemi
  // dell'Under 15. Le voci senza categoria — sponsor, movimenti non legati a
  // un atleta, palestre contese fra due squadre — stanno sotto "Societa'".
  const gruppi = [];
  const perSettore = (sectorId) => issues
    .map(i => ({ ...i, items: i.items.filter(x => (x.sectorId || null) === sectorId) }))
    .filter(i => i.items.length > 0);

  state.sectors.forEach(sec => {
    const suoi = perSettore(sec.id);
    if (suoi.length) gruppi.push({ key: sec.id, nome: sec.name, issues: suoi });
  });
  const societa = perSettore(null);
  if (societa.length) gruppi.push({ key: 'societa', nome: 'Società', issues: societa });

  const totalItems = gruppi.reduce((n, g) => n + g.issues.reduce((m, i) => m + i.items.length, 0), 0);

  body.innerHTML = `
    <div class="card sit-hero ${totalItems === 0 ? 'clear' : ''}">
      <div class="sit-hero-main">
        <div class="sit-hero-title">${totalItems === 0
          ? 'Tutto in regola'
          : totalItems + (totalItems === 1 ? ' cosa da sistemare' : ' cose da sistemare')}</div>
        <div class="sit-hero-sub">${totalItems === 0
          ? 'Certificati, scadenze, conferme e presenze: nessuna anomalia rilevata su tutte le categorie.'
          : 'Certificati, scadenze economiche, conferme, presenze e palestre, categoria per categoria.'}</div>
      </div>
      ${gruppi.length ? `
      <div class="sit-hero-counts">
        ${gruppi.map(g => {
          const n = g.issues.reduce((m, i) => m + i.items.length, 0);
          return `<button class="sit-badge" data-jump="${esc(g.key)}"><b>${n}</b><span>${esc(g.nome)}</span></button>`;
        }).join('')}
      </div>` : ''}
    </div>

    ${totalItems === 0
      ? '<div class="placeholder-card">Non c\'è niente da fare adesso. Questa pagina si ricontrolla ogni volta che la apri.</div>'
      : gruppi.map(g => `
        <div class="section-label" id="grp-${esc(g.key)}">${esc(g.nome)}</div>
        ${g.issues.map((i, idx) => issueCardHtml(i, idx, g.key)).join('')}
      `).join('')}

    <div class="hint">I controlli si basano solo sui dati già inseriti nell'app e vengono ricalcolati a ogni apertura.${!hasFinance ? ' Le scadenze economiche compaiono solo per chi ha accesso alla Finanza.' : (financeBlocked ? ' Le scadenze economiche non sono state caricate: il tuo profilo finanza non ha i permessi per leggerle.' : '')}</div>
  `;

  // Le pastiglie in cima portano alla propria categoria: con quattro squadre
  // l'elenco diventa lungo e scorrerlo a mano e' lavoro inutile.
  body.querySelectorAll('[data-jump]').forEach(btn => {
    btn.onclick = () => {
      const el = document.getElementById('grp-' + btn.dataset.jump);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
  });

  body.querySelectorAll('[data-more]').forEach(btn => {
    btn.onclick = () => {
      const [gk, id] = btn.dataset.more.split('|');
      const gruppo = gruppi.find(g => g.key === gk);
      const issue = gruppo && gruppo.issues.find(i => i.id === id);
      if (!issue) return;
      body.querySelector(`[data-list="${btn.dataset.more}"]`).innerHTML = issue.items.map(itemHtml).join('');
      btn.remove();
    };
  });

  body.querySelectorAll('.sit-action').forEach(btn => {
    btn.onclick = () => goToTab(btn.dataset.tab);
  });
}

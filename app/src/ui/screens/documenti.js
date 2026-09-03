import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { DOC_TYPES } from '../../utils/permissions.js';
import { toast, showLoadError, withButtonLoading } from '../modal.js';
import { fetchPlayer, fetchPlayerDocuments, getDocumentSignedUrl } from '../../api/roster.js';
import { fetchPlayerPaymentsForYear } from '../../api/financeEntries.js';
import { fetchLinkedProfilesForPlayer } from '../../api/family.js';
import { generateTaxDeclaration, generateEnrollmentForm } from '../documents.js';
import { EXPORTS } from '../dataExport.js';
import { fetchPlayerPersonalData, erasePlayer } from '../../api/privacy.js';
import { downloadCsv, safeName } from '../../utils/csv.js';
import { isAdmin } from '../../utils/permissions.js';
import { confirmModal } from '../modal.js';

function sectorName() {
  const s = state.sectors.find(x => x.id === state.activeSectorId);
  return s ? s.name : '';
}

export function renderDocumentiTab(c) {
  const hasFinance = !!state.currentUser.finance_role;
  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 4; y--) years.push(y);

  c.innerHTML = `
    <div class="settings-col">
      <div class="card">
        <h2>Modulistica</h2>
        <div class="hint" style="margin-top:0;">Moduli in bianco, da stampare e distribuire.</div>
        <button class="btn btn-secondary" id="blankEnrollBtn" style="width:100%;margin-top:12px;">
          Scarica modulo d'iscrizione vuoto (PDF)
        </button>
      </div>

      <div class="section-label">Esporta i dati</div>
      <div class="card">
        <div class="hint" style="margin-top:0;">In CSV, già pronti per Excel. Servono quando li chiede un commercialista, una federazione o un atleta — che ha diritto ad averli.</div>
        <div id="exportList"></div>
      </div>

      <div class="section-label">Scheda atleta</div>
      <div class="card">
        <div class="field" style="margin-bottom:0;">
          <label>Atleta</label>
          <select id="docPlayer">
            <option value="">— seleziona —</option>
            ${state.roster.map(p => `<option value="${p.id}">#${esc(p.number)} ${esc(p.name)}</option>`).join('')}
          </select>
        </div>
        ${state.roster.length === 0 ? '<div class="hint">Nessun giocatore in rosa in questo settore.</div>' : ''}
      </div>

      <div id="docDetail"></div>
    </div>
  `;

  drawExports();

  document.getElementById('blankEnrollBtn').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    await generateEnrollmentForm({ team: state.teamProfile, player: null, sectorName: sectorName() });
  });

  document.getElementById('docPlayer').onchange = (e) => {
    const id = e.target.value;
    const holder = document.getElementById('docDetail');
    if (!id) { holder.innerHTML = ''; return; }
    renderPlayerDossier(holder, id, { hasFinance, years });
  };
}

async function renderPlayerDossier(holder, playerId, { hasFinance, years }) {
  holder.innerHTML = '<div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>';
  let player, docs, guardians;
  try {
    [player, docs, guardians] = await Promise.all([
      fetchPlayer(playerId),
      fetchPlayerDocuments(playerId),
      fetchLinkedProfilesForPlayer(playerId).catch(() => [])
    ]);
  } catch (e) {
    showLoadError(holder, e, 'la scheda atleta');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  holder.innerHTML = `
    <div class="card">
      <h2>${esc(player.name)}</h2>
      <div class="hint" style="margin-top:0;">
        #${esc(player.number)}${player.birth_date ? ' · nato il ' + new Date(player.birth_date).toLocaleDateString('it-IT') : ''}${player.fiscal_code ? ' · ' + esc(player.fiscal_code) : ''}
      </div>
      ${guardians.length ? `<div class="hint">Account collegati: ${guardians.map(g => esc(g.display_name)).join(', ')}</div>` : ''}
    </div>

    <div class="section-label">Documenti caricati</div>
    <div id="dossierDocs"></div>

    <div class="section-label">Documenti da generare</div>
    <div class="card">
      <button class="btn btn-secondary" id="enrollBtn" style="width:100%;margin-bottom:10px;">
        Modulo d'iscrizione precompilato (PDF)
      </button>
      ${hasFinance ? `
        <div class="field" style="margin-bottom:8px;">
          <label>Anno della dichiarazione</label>
          <select id="taxYear">${years.map(y => `<option value="${y}">${y}</option>`).join('')}</select>
        </div>
        <button class="btn btn-primary" id="taxBtn">Dichiarazione quote versate (PDF)</button>
        <div class="hint">Certifica quanto effettivamente incassato nell'anno, per la detrazione in dichiarazione dei redditi.</div>
      ` : `<div class="hint">La dichiarazione delle quote richiede l'accesso alla sezione Finanza: chiedi a un amministratore di abilitartelo.</div>`}
    </div>

    <div class="section-label">Dati personali</div>
    <div class="card">
      <div class="hint" style="margin-top:0;">Cosa l'app conserva su questa persona, e come cancellarlo. Servono a rispondere a una richiesta di accesso o di cancellazione entro i trenta giorni previsti.</div>
      <button class="btn btn-secondary" id="gdprShow" style="width:100%;margin-bottom:8px;">Vedi tutto quello che conserviamo</button>
      ${isAdmin(state.currentUser) ? '<button class="btn btn-ghost" id="gdprErase" style="width:100%;">Cancella i dati di questa persona</button>' : ''}
    </div>
  `;

  wirePersonalData(playerId, player);

  // Raccoglitore: un riquadro per tipo, con lo stato di quello caricato
  const docHolder = document.getElementById('dossierDocs');
  docHolder.innerHTML = DOC_TYPES.map(dt => {
    const d = docs.filter(x => x.doc_type === dt.key)
      .sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
    if (!d) {
      return `<div class="list-row"><div class="main"><div class="nm">${esc(dt.label)}</div>
        <div class="sub">Non ancora caricato</div></div>
        <span class="status-badge missing">Mancante</span></div>`;
    }
    const expired = d.expires_at && d.expires_at < today;
    const cls = d.status === 'approved' ? (expired ? 'rejected' : 'ok') : (d.status === 'rejected' ? 'rejected' : 'pending');
    const label = expired ? 'Scaduto' : (d.status === 'approved' ? 'Valido' : (d.status === 'rejected' ? 'Rifiutato' : 'In verifica'));
    return `<div class="list-row"><div class="main"><div class="nm">${esc(dt.label)}</div>
      <div class="sub">Caricato il ${new Date(d.uploaded_at).toLocaleDateString('it-IT')}${d.expires_at ? ' · valido fino al ' + new Date(d.expires_at).toLocaleDateString('it-IT') : ''}</div></div>
      <span class="status-badge ${cls}">${label}</span>
      <button class="icon-btn" data-view="${esc(d.file_path)}" title="Apri">↗</button></div>`;
  }).join('');

  docHolder.querySelectorAll('[data-view]').forEach(btn => btn.onclick = async () => {
    try {
      window.open(await getDocumentSignedUrl(btn.getAttribute('data-view')), '_blank');
    } catch (e) {
      toast(e.message || 'Impossibile aprire il documento');
    }
  });

  document.getElementById('enrollBtn').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    await generateEnrollmentForm({ team: state.teamProfile, player, sectorName: sectorName() });
  });

  const taxBtn = document.getElementById('taxBtn');
  if (taxBtn) taxBtn.onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const year = parseInt(document.getElementById('taxYear').value, 10);
    try {
      const payments = await fetchPlayerPaymentsForYear(playerId, year);
      if (payments.length === 0) toast(`Nessun versamento registrato nel ${year}: il documento uscirà senza importi`);
      await generateTaxDeclaration({
        team: state.teamProfile, player, payments, year,
        guardianName: guardians.length ? guardians.map(g => g.display_name).join(', ') : null
      });
    } catch (err) {
      toast(err.message || 'Impossibile generare la dichiarazione');
    }
  });
}

// Ogni export è un pulsante con la sua spiegazione: chi lo preme deve sapere
// che cosa si troverà nel file prima di aprirlo.
function drawExports() {
  const holder = document.getElementById('exportList');
  if (!holder) return;
  holder.innerHTML = EXPORTS.map(x => `
    <div class="list-row">
      <div class="main"><div class="nm">${esc(x.label)}</div><div class="sub">${esc(x.hint)}</div></div>
      <button class="btn btn-secondary" data-export="${x.key}" style="width:auto;padding:6px 12px;font-size:12px;">Scarica</button>
    </div>`).join('');
  holder.querySelectorAll('[data-export]').forEach(btn => {
    btn.onclick = (e) => withButtonLoading(e.currentTarget, async () => {
      const item = EXPORTS.find(x => x.key === btn.dataset.export);
      if (item) await item.run();
    });
  });
}

// Diritto di accesso e diritto alla cancellazione, art. 15 e 17.
//
// L'elenco arriva da una sola funzione lato database invece che da otto query
// separate: e' il modo in cui non si dimentica una tabella. La cancellazione
// anonimizza ovunque ed elimina i documenti sanitari, ma lascia i movimenti
// contabili, che la legge obbliga a conservare dieci anni — privati del nome.
function wirePersonalData(playerId, player) {
  const show = document.getElementById('gdprShow');
  if (show) show.onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    let data;
    try { data = await fetchPlayerPersonalData(playerId); }
    catch (err) { toast(err.message || 'Impossibile leggere i dati'); return; }
    openPersonalData(player, data);
  });

  const erase = document.getElementById('gdprErase');
  if (erase) erase.onclick = () => confirmModal(
    `Cancellare i dati di ${player.name}?`,
    'Nome, data di nascita, codice fiscale, contatti e fotografia vengono rimossi; i documenti caricati eliminati; le rose e le presenze scollegate. I movimenti contabili restano senza nome, perché la legge impone di conservarli dieci anni. Non è reversibile.',
    async () => {
      await erasePlayer(playerId, "richiesta dell'interessato");
      toast('Dati cancellati');
      const { loadSectorData } = await import('../../router.js');
      await loadSectorData(state.activeSectorId);
      const { renderApp } = await import('../layout.js');
      renderApp();
    }, 'Cancella definitivamente');
}

function openPersonalData(player, data) {
  const root = document.getElementById('modalRoot');
  const sezioni = [
    ['Anagrafica', data.anagrafica],
    ['Categorie', data.categorie],
    ['Documenti', data.documenti],
    ['Presenze', data.presenze],
    ['Convocazioni', data.convocazioni],
    ['Quote', data.quote],
    ['Scheda tecnica', data.scheda_tecnica]
  ];
  const conta = (v) => Array.isArray(v) ? v.length : (v ? 1 : 0);

  root.innerHTML = `<div class="modal-overlay" id="pdOverlay"><div class="modal-box wide">
    <h3>Dati conservati su ${esc(player.name)}</h3>
    <div class="hint" style="margin-top:0;">Tutto ciò che l'applicazione tiene su questa persona, tabella per tabella.</div>
    ${sezioni.map(([nome, v]) => `
      <div class="section-label">${esc(nome)} <span class="hint" style="margin:0;">${conta(v)} voc${conta(v) === 1 ? 'e' : 'i'}</span></div>
      <div class="boxscore-wrap"><pre class="gdpr-dump">${esc(JSON.stringify(v ?? null, null, 2))}</pre></div>
    `).join('')}
    <div class="modal-actions" style="flex-direction:column;gap:8px;">
      <button class="btn btn-secondary" id="pdCsv" style="width:100%;">Scarica in CSV</button>
      <button class="btn btn-primary" id="pdClose" style="width:100%;">Chiudi</button>
    </div>
  </div></div>`;

  document.getElementById('pdClose').onclick = () => { root.innerHTML = ''; };
  document.getElementById('pdOverlay').onclick = (e) => { if (e.target.id === 'pdOverlay') root.innerHTML = ''; };
  document.getElementById('pdCsv').onclick = () => {
    const righe = [];
    sezioni.forEach(([nome, v]) => {
      if (Array.isArray(v)) v.forEach(x => righe.push([nome, JSON.stringify(x)]));
      else if (v) Object.entries(v).forEach(([k, val]) => righe.push([nome, k + ': ' + val]));
    });
    downloadCsv(`dati_${safeName(player.name)}.csv`, ['Sezione', 'Dato'], righe);
    toast('Dati scaricati');
  };
}

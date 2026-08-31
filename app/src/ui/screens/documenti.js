import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { DOC_TYPES } from '../../utils/permissions.js';
import { toast, showLoadError, withButtonLoading } from '../modal.js';
import { fetchPlayer, fetchPlayerDocuments, getDocumentSignedUrl } from '../../api/roster.js';
import { fetchPlayerPaymentsForYear } from '../../api/financeEntries.js';
import { fetchLinkedProfilesForPlayer } from '../../api/family.js';
import { generateTaxDeclaration, generateEnrollmentForm } from '../documents.js';

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
  `;

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

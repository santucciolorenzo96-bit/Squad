import { state } from '../state.js';
import { esc } from '../utils/format.js';
import { toast } from './modal.js';
import { closeSeasonAndOpen } from '../api/seasons.js';
import { fetchRosterBySector } from '../api/roster.js';

// Chiusura di stagione.
//
// Non è un flag: è il momento in cui si decide chi passa di categoria. Quanti
// ragazzi salgano dall'Under 15 all'Under 17 non lo sa nessuno in anticipo —
// dipende dalle date di nascita, da chi smette, da chi arriva — quindi qui non
// c'è nessuna regola automatica. C'è un elenco, e per ognuno si sceglie.
//
// Chi viene lasciato fuori non viene cancellato da niente: resta in anagrafica,
// nello storico delle partite e nelle statistiche della stagione appena chiusa.
// Semplicemente non fa parte di nessuna rosa della stagione nuova.

const OUT = '__fuori__';

function nextSeasonName(name) {
  const m = (name || '').match(/(\d{4})\s*\/\s*(\d{4})/);
  if (m) return `${parseInt(m[1], 10) + 1}/${parseInt(m[2], 10) + 1}`;
  const y = new Date().getFullYear();
  return `${y}/${y + 1}`;
}

export async function openSeasonClose(season, onDone) {
  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="scOverlay"><div class="modal-box wide">
      <h3>Chiudi la stagione ${esc(season.name)}</h3>
      <div id="scBody"><div class="skeleton skeleton-row" style="height:140px;"></div></div>
    </div></div>`;

  // Le rose di tutte le categorie della stagione che si chiude: è da lì che
  // si parte per comporre quelle nuove.
  const sectors = state.sectors;
  let rosters = [];
  try {
    rosters = await Promise.all(sectors.map(s => fetchRosterBySector(s.id, season.id)));
  } catch (e) {
    document.getElementById('scBody').innerHTML =
      '<div class="placeholder-card">Impossibile leggere le rose della stagione.</div>';
    return;
  }
  const body = document.getElementById('scBody');
  if (!body) return;

  // Destinazione proposta: la stessa categoria. Non indovino le promozioni —
  // sbagliarle in massa costerebbe più tempo di quanto ne farebbe risparmiare.
  const choice = {};
  sectors.forEach((s, i) => {
    (rosters[i] || []).forEach(p => { choice[p.id] = s.id; });
  });

  const nuova = nextSeasonName(season.name);
  const startYear = new Date(season.end_date).getFullYear();

  body.innerHTML = `
    <div class="card">
      <h2 style="margin-top:0;">La nuova stagione</h2>
      <div class="field"><label>Nome</label><input type="text" id="scName" value="${esc(nuova)}"></div>
      <div class="row2">
        <div class="field"><label>Inizio</label><input type="date" id="scStart" value="${startYear}-07-01"></div>
        <div class="field"><label>Fine</label><input type="date" id="scEnd" value="${startYear + 1}-06-30"></div>
      </div>
      <div class="hint" style="margin-bottom:0;">La stagione sportiva va da luglio a giugno: i playoff di maggio e giugno restano dentro quella che si chiude.</div>
    </div>

    <div class="section-label">Chi continua, e dove</div>
    <div class="hint" style="margin-top:0;">Per ogni giocatore scegli la categoria della prossima stagione, oppure "Non continua". Chi resta fuori non viene cancellato: resta in anagrafica e nello storico.</div>
    ${sectors.map((s, i) => {
      const roster = rosters[i] || [];
      if (roster.length === 0) return '';
      return `
        <div class="section-label" style="margin-top:14px;">${esc(s.name)} · ${roster.length}</div>
        <div class="card">
          ${roster.map(p => `
            <div class="sc-row">
              <div class="sc-name">#${esc(p.number)} ${esc(p.name)}</div>
              <select data-player="${p.id}">
                ${sectors.map(d => `<option value="${d.id}"${d.id === s.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}
                <option value="${OUT}">Non continua</option>
              </select>
            </div>`).join('')}
        </div>`;
    }).join('')}

    <div class="error-msg" id="scError"></div>
    <div class="modal-actions" style="flex-direction:column;gap:8px;">
      <button class="btn btn-primary" id="scConfirm" style="width:100%;">Chiudi la stagione e apri la nuova</button>
      <button class="btn btn-ghost" id="scCancel" style="width:100%;">Annulla</button>
    </div>
  `;

  body.querySelectorAll('[data-player]').forEach(sel => {
    sel.onchange = () => { choice[sel.dataset.player] = sel.value; };
  });

  const close = () => { root.innerHTML = ''; };
  document.getElementById('scCancel').onclick = close;
  document.getElementById('scOverlay').onclick = (e) => { if (e.target.id === 'scOverlay') close(); };

  document.getElementById('scConfirm').onclick = async (e) => {
    const errEl = document.getElementById('scError');
    const name = document.getElementById('scName').value.trim();
    const start_date = document.getElementById('scStart').value;
    const end_date = document.getElementById('scEnd').value;
    if (!name) { errEl.textContent = 'Dai un nome alla nuova stagione.'; return; }
    if (!start_date || !end_date) { errEl.textContent = 'Servono le date di inizio e fine.'; return; }
    if (end_date <= start_date) { errEl.textContent = 'La fine deve venire dopo l\'inizio.'; return; }

    const assignments = Object.entries(choice)
      .filter(([, sectorId]) => sectorId !== OUT)
      .map(([player_id, sector_id]) => ({ player_id, sector_id }));

    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Chiudo la stagione…';
    try {
      await closeSeasonAndOpen(season.id, { name, start_date, end_date }, assignments);
      close();
      toast(`Stagione ${name} aperta con ${assignments.length} giocator${assignments.length === 1 ? 'e' : 'i'}`);
      if (onDone) await onDone();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Chiudi la stagione e apri la nuova';
      errEl.textContent = err.message || 'Non è stato possibile chiudere la stagione.';
    }
  };
}

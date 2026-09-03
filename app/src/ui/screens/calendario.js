import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast } from '../modal.js';
import { canEditHome } from '../../utils/permissions.js';
import { bulkInsertMatches, updateCalendarMatch, removeCalendarMatch } from '../../api/calendar.js';
import { venueIcon, ballIcon } from '../icons.js';

function emptyRow() {
  return { giornata: null, date: '', time: '', opponent: '', home: true, location: '', include: true };
}

function fmtDate(d) {
  if (!d) return 'Data da definire';
  return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function renderCalendarioTab(c) {
  const canEdit = canEditHome(state.currentUser);
  let reviewRows = null;
  let parsing = false;

  function draw() {
    if (reviewRows) drawReview();
    else drawList();
  }

  function drawList() {
    const sorted = [...state.calendar].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));
    c.innerHTML = `
      ${canEdit ? `
      <div class="card">
        <h2>Carica calendario</h2>
        <div class="hint">Carica il PDF del calendario federale: proveremo a riconoscere automaticamente le partite, ma potrai sempre correggerle prima di salvarle.</div>
        <div class="dropzone" id="calDropzone" style="cursor:pointer;margin-top:10px;">
          <span style="font-size:22px;">📄</span>
          <span>${parsing ? 'Lettura del PDF in corso…' : 'Clicca per scegliere un PDF'}</span>
        </div>
        <input type="file" id="calFileInput" accept="application/pdf" class="hidden">
        <button class="btn btn-ghost" id="addManualBtn" style="width:100%;margin-top:10px;">+ Aggiungi partita manualmente</button>
      </div>` : ''}
      <div class="section-label">Calendario (${sorted.length})</div>
      <div id="calList"></div>
    `;
    const holder = document.getElementById('calList');
    if (sorted.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessuna partita in calendario.</div>'; }
    else {
      holder.innerHTML = '';
      sorted.forEach(m => {
        const row = document.createElement('div');
        row.className = 'card';
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '14px';
        row.innerHTML = `
          <div style="width:44px;height:44px;border-radius:11px;background:var(--tint);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--font-mono);flex-shrink:0;">
            ${m.giornata ? `<span style="font-size:9px;color:var(--dim);">GG</span><span style="font-size:15px;font-weight:700;">${m.giornata}</span>` : ballIcon(18)}
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:14px;">${venueIcon(m.home !== false)} vs ${esc(m.opponent)}</div>
            <div class="hint">${fmtDate(m.date)}${m.time ? ' · ' + esc(m.time) : ''}${m.location ? ' · ' + esc(m.location) : ''}</div>
          </div>
          ${m.played
            ? `<span class="status-badge ok">${m.team_score ?? '?'} - ${m.opp_score ?? '?'}</span>`
            : (canEdit ? `<button class="btn btn-secondary" data-result="${m.id}" style="width:auto;">Segna risultato</button>` : '')}
          ${canEdit ? `<button class="icon-btn" data-edit="${m.id}">✎</button><button class="icon-btn danger" data-rm="${m.id}">✕</button>` : ''}
        `;
        holder.appendChild(row);
      });
      if (canEdit) {
        holder.querySelectorAll('[data-result]').forEach(btn => btn.onclick = () => openResultModal(state.calendar.find(m => m.id === btn.getAttribute('data-result'))));
        holder.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => openEditModal(state.calendar.find(m => m.id === btn.getAttribute('data-edit'))));
        holder.querySelectorAll('[data-rm]').forEach(btn => btn.onclick = () => {
          confirmModal('Rimuovere partita?', 'La partita verrà tolta dal calendario.', async () => {
            await removeCalendarMatch(btn.getAttribute('data-rm'));
            state.calendar = state.calendar.filter(m => m.id !== btn.getAttribute('data-rm'));
            draw();
          }, 'Rimuovi');
        });
      }
    }
    if (!canEdit) return;
    document.getElementById('calDropzone').onclick = () => { if (!parsing) document.getElementById('calFileInput').click(); };
    document.getElementById('calFileInput').onchange = (e) => { const f = e.target.files[0]; if (f) handleFile(f); };
    document.getElementById('addManualBtn').onclick = () => { reviewRows = [emptyRow()]; draw(); };
  }

  async function handleFile(file) {
    parsing = true; draw();
    try {
      const buf = await file.arrayBuffer();
      const { extractTextLines, parseMatchesFromLines } = await import('../../utils/pdfParser.js');
      const lines = await extractTextLines(buf);
      const parsed = parseMatchesFromLines(lines, state.teamProfile.name);
      parsing = false;
      if (parsed.length === 0) {
        toast('Nessuna partita riconosciuta automaticamente: aggiungile a mano qui sotto.');
        reviewRows = [emptyRow()];
      } else {
        reviewRows = parsed.map(m => ({ ...m, home: m.home == null ? true : m.home, include: true }));
      }
      draw();
    } catch (e) {
      parsing = false;
      toast('Impossibile leggere il PDF: ' + (e.message || 'formato non riconosciuto') + '. Puoi aggiungere le partite a mano.');
      draw();
    }
  }

  function drawReview() {
    c.innerHTML = `
      <div class="card">
        <h2>Verifica prima di salvare</h2>
        <div class="hint">Il riconoscimento automatico può sbagliare: controlla data, avversario e casa/trasferta di ogni riga. Deseleziona le righe che non vuoi salvare.</div>
      </div>
      <div id="reviewList"></div>
      <div class="card"><button class="btn btn-ghost" id="addRowBtn" style="width:100%;">+ Aggiungi riga</button></div>
      <div class="error-msg" id="reviewError"></div>
      <div class="row2">
        <button class="btn btn-ghost" id="reviewCancel">Annulla</button>
        <button class="btn btn-primary" id="reviewConfirm">Conferma e salva</button>
      </div>
    `;
    const holder = document.getElementById('reviewList');
    function drawRows() {
      holder.innerHTML = '';
      reviewRows.forEach((r, i) => {
        const row = document.createElement('div');
        row.className = 'card';
        row.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <input type="checkbox" data-i="${i}" data-f="include" ${r.include ? 'checked' : ''} style="width:auto;">
            <div class="hint" style="flex:1;">${r.sourceLine ? esc(r.sourceLine) : 'Riga aggiunta manualmente'}</div>
            <button class="icon-btn danger" data-rmrow="${i}">✕</button>
          </div>
          <div class="row2">
            <div class="field"><label>Giornata</label><input type="number" min="1" data-i="${i}" data-f="giornata" value="${r.giornata ?? ''}"></div>
            <div class="field"><label>Data</label><input type="date" data-i="${i}" data-f="date" value="${r.date || ''}"></div>
          </div>
          <div class="row2">
            <div class="field"><label>Ora</label><input type="text" placeholder="18:30" data-i="${i}" data-f="time" value="${esc(r.time || '')}"></div>
            <div class="field"><label>Casa o trasferta</label>
              <select data-i="${i}" data-f="home">
                <option value="1" ${r.home ? 'selected' : ''}>Casa</option>
                <option value="0" ${!r.home ? 'selected' : ''}>Trasferta</option>
              </select>
            </div>
          </div>
          <div class="field"><label>Avversario</label><input type="text" data-i="${i}" data-f="opponent" value="${esc(r.opponent || '')}"></div>
          <div class="field"><label>Luogo</label><input type="text" data-i="${i}" data-f="location" value="${esc(r.location || '')}"></div>
        `;
        holder.appendChild(row);
      });
      holder.querySelectorAll('input[type=checkbox]').forEach(el => el.onchange = () => { reviewRows[+el.getAttribute('data-i')].include = el.checked; });
      holder.querySelectorAll('input[type=text],input[type=date],input[type=number]').forEach(el => el.oninput = () => {
        const i = +el.getAttribute('data-i'), f = el.getAttribute('data-f');
        reviewRows[i][f] = f === 'giornata' ? (el.value ? parseInt(el.value, 10) : null) : el.value;
      });
      holder.querySelectorAll('select').forEach(el => el.onchange = () => { reviewRows[+el.getAttribute('data-i')].home = el.value === '1'; });
      holder.querySelectorAll('[data-rmrow]').forEach(btn => btn.onclick = () => {
        reviewRows.splice(+btn.getAttribute('data-rmrow'), 1);
        if (reviewRows.length === 0) reviewRows.push(emptyRow());
        drawRows();
      });
    }
    drawRows();
    document.getElementById('addRowBtn').onclick = () => { reviewRows.push(emptyRow()); drawRows(); };
    document.getElementById('reviewCancel').onclick = () => { reviewRows = null; draw(); };
    document.getElementById('reviewConfirm').onclick = async () => {
      const errEl = document.getElementById('reviewError');
      const rows = reviewRows.filter(r => r.include && r.opponent && r.opponent.trim() && r.date);
      if (rows.length === 0) { errEl.textContent = 'Seleziona almeno una riga valida con avversario e data.'; return; }
      try {
        const inserted = await bulkInsertMatches(state.teamProfile.id, state.activeSectorId, rows, state.activeSeasonId);
        state.calendar = state.calendar.concat(inserted);
        const skipped = rows.length - inserted.length;
        toast(`Salvate ${inserted.length} partite` + (skipped > 0 ? ` (${skipped} già presenti, saltate)` : ''));
        reviewRows = null;
        draw();
      } catch (e) {
        errEl.textContent = e.message || 'Errore nel salvataggio.';
      }
    };
  }

  function openResultModal(m) {
    formModal('Risultato partita', `
      <div class="hint">vs ${esc(m.opponent)} · ${fmtDate(m.date)}</div>
      <div class="row2" style="margin-top:10px;">
        <div class="field"><label>Punti ${esc(state.teamProfile.name)}</label><input type="number" id="rsUs" value="${m.team_score ?? ''}"></div>
        <div class="field"><label>Punti ${esc(m.opponent)}</label><input type="number" id="rsThem" value="${m.opp_score ?? ''}"></div>
      </div>
    `, async () => {
      const us = document.getElementById('rsUs').value;
      const them = document.getElementById('rsThem').value;
      if (us === '' || them === '') return 'Inserisci entrambi i punteggi.';
      const updated = await updateCalendarMatch(m.id, { played: true, team_score: parseInt(us, 10), opp_score: parseInt(them, 10) });
      Object.assign(m, updated);
      draw();
      toast('Risultato salvato');
    });
  }

  function openEditModal(existing) {
    const m = existing || { giornata: '', date: '', time: '', opponent: '', home: true, location: '' };
    formModal(existing ? 'Modifica partita' : 'Nuova partita', `
      <div class="row2">
        <div class="field"><label>Giornata</label><input type="number" min="1" id="emGio" value="${m.giornata ?? ''}"></div>
        <div class="field"><label>Data</label><input type="date" id="emDate" value="${m.date || ''}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Ora</label><input type="text" id="emTime" placeholder="18:30" value="${esc(m.time || '')}"></div>
        <div class="field"><label>Casa o trasferta</label>
          <select id="emHome"><option value="1" ${m.home ? 'selected' : ''}>Casa</option><option value="0" ${!m.home ? 'selected' : ''}>Trasferta</option></select>
        </div>
      </div>
      <div class="field"><label>Avversario</label><input type="text" id="emOpp" value="${esc(m.opponent || '')}"></div>
      <div class="field"><label>Luogo</label><input type="text" id="emLoc" value="${esc(m.location || '')}"></div>
    `, async () => {
      const opponent = document.getElementById('emOpp').value.trim();
      const date = document.getElementById('emDate').value;
      if (!opponent) return "Inserisci l'avversario.";
      const patch = {
        giornata: document.getElementById('emGio').value ? parseInt(document.getElementById('emGio').value, 10) : null,
        date: date || null,
        time: document.getElementById('emTime').value.trim() || null,
        home: document.getElementById('emHome').value === '1',
        opponent,
        location: document.getElementById('emLoc').value.trim() || null
      };
      if (existing) {
        const updated = await updateCalendarMatch(existing.id, patch);
        Object.assign(existing, updated);
      } else {
        const [inserted] = await bulkInsertMatches(state.teamProfile.id, state.activeSectorId, [{ ...patch, include: true }], state.activeSeasonId);
        if (inserted) state.calendar.push(inserted);
      }
      draw();
      toast('Partita salvata');
    });
  }

  draw();
}

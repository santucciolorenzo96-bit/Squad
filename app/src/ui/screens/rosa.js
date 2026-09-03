import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { confirmModal, toast, withButtonLoading } from '../modal.js';
import { addPlayer, removePlayerFromSector, fetchPlayerPhotoUrls } from '../../api/roster.js';
import { canEditRoster, canEditHome, isLinkedUser } from '../../utils/permissions.js';
import { avatarHtml, wireAvatarClicks } from '../playerAvatar.js';
import { computeSeasonStats, findSeasonRow } from '../../utils/stats.js';
import { currentSport } from '../../utils/sports/index.js';

function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// Le tre medie mostrate sul campo: quali siano lo decide lo sport.
function avgLine(seasonRow, sport) {
  if (!seasonRow || !seasonRow.games) return null;
  return sport.headline.map(h => ({
    short: h.short,
    value: ((seasonRow[h.key] || 0) / seasonRow.games).toFixed(1)
  }));
}

// Lo staff vede la scheda evolutiva di tutta la rosa; un genitore o un atleta
// solo quella dei giocatori a cui il suo account è collegato.
function canSeeDevelopment(p) {
  if (isLinkedUser(state.currentUser)) return state.linkedPlayers.some(lp => lp.id === p.id);
  return canEditHome(state.currentUser);
}

// Formazione di default: titolari/panchinari dell'ultima partita giocata,
// mappati sulla rosa attuale per id (o per numero se l'id non è più presente).
// Fallback: i primi della rosa se non c'è ancora nessuna partita in storico.
function computeDefaultCourtIds(onField) {
  const last = state.history[state.history.length - 1];
  const ids = [];
  if (last) {
    last.players.filter(p => p.onCourt).forEach(snap => {
      let match = state.roster.find(p => p.id === snap.id);
      if (!match) match = state.roster.find(p => p.number === snap.number);
      if (match && !ids.includes(match.id)) ids.push(match.id);
    });
  }
  for (const p of state.roster) {
    if (ids.length >= onField) break;
    if (!ids.includes(p.id)) ids.push(p.id);
  }
  return ids.slice(0, onField);
}

export async function renderRosaTab(c) {
  const canEdit = canEditRoster(state.currentUser);
  state.selectedCourtId = null;
  state.pendingBenchId = null;
  const sport = currentSport();
  const onField = sport.match.minOnField;
  let courtIds = computeDefaultCourtIds(onField);
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
  const season = computeSeasonStats(state.history, sport);

  c.innerHTML = `
    <div class="settings-col">
    ${state.roster.length === 0 ? '<div class="placeholder-card">Nessun giocatore in rosa.</div>' : `
    <div class="court-half" id="courtHalf"></div>
    <div class="section-label">${sport.field.benchLabel}</div>
    <div class="bench-row-scroll" id="benchRow"></div>
    <div class="hint" style="text-align:center;margin-top:6px;">Tocca ⇄ su un giocatore per prepararlo alla sostituzione, poi tocca ⇄ sull'altro per scambiarli. Tocca un giocatore per vedere le sue statistiche.</div>
    `}

    ${canEdit ? `
    <div class="card" style="margin-top:22px;">
      <h2>Aggiungi giocatore</h2>
      <div class="player-add-row">
        <input type="text" id="rNum" placeholder="N°" inputmode="numeric">
        <input type="text" id="rName" placeholder="Nome giocatore">
        <button class="btn btn-secondary" id="rAdd">+ Aggiungi</button>
      </div>
      <div class="hint">Per dati anagrafici e certificato medico vai su Anagrafica.</div>
    </div>` : ''}
    <div class="section-label" id="rosaCountLabel">Rosa (${state.roster.length})</div>
    <div id="rosterList"></div>
    <div id="rosaHint">${canEdit && state.roster.length < onField ? `<div class="hint">Servono almeno ${onField} giocatori in rosa per comporre la formazione.</div>` : ''}</div>
    </div>
  `;

  function playerToken(p, style) {
    const url = photoUrls[p.id];
    const onCourt = courtIds.includes(p.id);
    const armed = onCourt ? state.selectedCourtId === p.id : state.pendingBenchId === p.id;
    const avg = avgLine(findSeasonRow(season, p), sport);
    return `
      <div class="court-token" data-token="${p.id}" style="${style || ''}">
        <div class="court-token-top">
          <div class="court-token-stats">
            ${(avg || sport.headline.map(h => ({ short: h.short, value: '—' })))
              .map(a => `<span><i>${a.short}</i><b>${a.value}</b></span>`).join('')}
          </div>
          <div class="court-token-avatar">${url ? `<img src="${esc(url)}">` : esc(initials(p.name))}</div>
          <button class="court-token-swap${armed ? ' armed' : ''}" data-swap="${p.id}" title="Sostituisci" aria-label="Sostituisci ${esc(p.name)}">⇄</button>
        </div>
        <div class="court-token-name">${esc(p.name)}</div>
        <div class="court-token-num">#${esc(p.number)}</div>
      </div>`;
  }

  function drawCourt() {
    const courtEl = document.getElementById('courtHalf');
    const benchEl = document.getElementById('benchRow');
    if (!courtEl || !benchEl) return;
    const courtPlayers = courtIds.map(id => state.roster.find(p => p.id === id)).filter(Boolean);
    const benchPlayers = state.roster.filter(p => !courtIds.includes(p.id));

    courtEl.innerHTML = sport.field.svg + courtPlayers
      .map((p, i) => playerToken(p, sport.field.slots[i] ? `top:${sport.field.slots[i].top};left:${sport.field.slots[i].left};` : ''))
      .join('');
    benchEl.innerHTML = benchPlayers.length
      ? benchPlayers.map(p => playerToken(p)).join('')
      : '<div class="hint" style="padding:8px 4px;">Nessun giocatore in panchina.</div>';

    [courtEl, benchEl].forEach(container => {
      container.querySelectorAll('[data-token]').forEach(el => {
        el.onclick = (e) => {
          if (e.target.closest('[data-swap]')) return;
          openSpotlight(el.getAttribute('data-token'));
        };
      });
      container.querySelectorAll('[data-swap]').forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          onSwapTap(btn.getAttribute('data-swap'));
        };
      });
    });
  }

  function onSwapTap(playerId) {
    const onCourt = courtIds.includes(playerId);
    if (onCourt) {
      if (state.pendingBenchId) {
        courtIds[courtIds.indexOf(playerId)] = state.pendingBenchId;
        state.pendingBenchId = null;
        state.selectedCourtId = null;
      } else {
        state.selectedCourtId = (state.selectedCourtId === playerId) ? null : playerId;
      }
    } else {
      if (state.selectedCourtId) {
        courtIds[courtIds.indexOf(state.selectedCourtId)] = playerId;
        state.selectedCourtId = null;
        state.pendingBenchId = null;
      } else {
        state.pendingBenchId = (state.pendingBenchId === playerId) ? null : playerId;
      }
    }
    drawCourt();
  }

  function openSpotlight(playerId) {
    const p = state.roster.find(x => x.id === playerId);
    if (!p) return;
    const s = findSeasonRow(season, p);
    const url = photoUrls[p.id];
    const root = document.getElementById('modalRoot');
    root.innerHTML = `
      <div class="player-spotlight-overlay" id="spotlightOverlay">
        <div class="player-spotlight-card">
          <div class="spotlight-avatar">${url ? `<img src="${esc(url)}">` : esc(initials(p.name))}</div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:19px;margin-top:12px;">${esc(p.name)}</div>
          <div class="hint">#${esc(p.number)}${p.role_position ? ' · ' + esc(p.role_position) : ''}${p.height_cm ? ' · ' + p.height_cm + ' cm' : ''}</div>
          ${s ? `
          <div class="stat-row" style="margin-top:18px;">
            ${sport.headline.map(h => `<div class="mini-card"><div class="lbl">${h.label}</div><div class="val">${((s[h.key] || 0) / s.games).toFixed(1)}</div></div>`).join('')}
          </div>
          <div class="hint" style="margin-top:10px;">${s.games} partite giocate in stagione</div>
          ` : `<div class="hint" style="margin-top:18px;">Nessuna statistica disponibile ancora.</div>`}
          ${canSeeDevelopment(p) ? `<button class="btn btn-primary" id="spotlightDev" style="width:100%;margin-top:18px;">Scheda evolutiva</button>` : ''}
          <button class="btn btn-secondary" id="spotlightClose" style="width:100%;margin-top:${canSeeDevelopment(p) ? '8' : '18'}px;">Chiudi</button>
        </div>
      </div>`;
    document.getElementById('spotlightOverlay').onclick = (e) => { if (e.target.id === 'spotlightOverlay') root.innerHTML = ''; };
    document.getElementById('spotlightClose').onclick = () => { root.innerHTML = ''; };
    const devBtn = document.getElementById('spotlightDev');
    if (devBtn) devBtn.onclick = async () => {
      const { openPlayerDevelopment } = await import('../playerDevelopment.js');
      openPlayerDevelopment(p.id, { readOnly: isLinkedUser(state.currentUser) });
    };
  }

  if (state.roster.length > 0) drawCourt();

  function drawList() {
    document.getElementById('rosaCountLabel').textContent = `Rosa (${state.roster.length})`;
    const hintEl = document.getElementById('rosaHint');
    if (hintEl) hintEl.innerHTML = canEdit && state.roster.length < onField ? `<div class="hint">Servono almeno ${onField} giocatori in rosa per comporre la formazione.</div>` : '';
    const holder = document.getElementById('rosterList');
    holder.innerHTML = '';
    if (state.roster.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun giocatore in rosa.</div>'; return; }
    state.roster.forEach(p => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 36)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div>${canEdit ? `<button class="icon-btn danger" data-rm="${p.id}">✕</button>` : ''}`;
      holder.appendChild(row);
    });
    wireAvatarClicks(holder, photoUrls);
    if (!canEdit) return;
    holder.querySelectorAll('[data-rm]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute('data-rm');
        const pl = state.roster.find(x => x.id === id);
        confirmModal('Rimuovere giocatore dal settore?', `#${pl.number} ${pl.name} verrà rimosso dalla rosa di questo settore (resta nell'anagrafica e negli altri settori in cui è eventualmente rosterizzato).`, async () => {
          await removePlayerFromSector(id, state.activeSectorId, state.activeSeasonId);
          state.roster = state.roster.filter(x => x.id !== id);
          courtIds = courtIds.filter(x => x !== id);
          for (const p of state.roster) {
            if (courtIds.length >= onField) break;
            if (!courtIds.includes(p.id)) courtIds.push(p.id);
          }
          drawList();
          if (document.getElementById('courtHalf')) drawCourt();
        }, 'Rimuovi');
      };
    });
  }
  drawList();
  if (!canEdit) return;
  document.getElementById('rAdd').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const numIn = document.getElementById('rNum'), nameIn = document.getElementById('rName');
    const num = numIn.value.trim(), name = nameIn.value.trim();
    if (!name) { toast('Inserisci il nome del giocatore'); return; }
    const created = await addPlayer(state.teamProfile.id, state.activeSectorId, num || '-', name, state.activeSeasonId);
    state.roster.push(created);
    numIn.value = ''; nameIn.value = ''; numIn.focus();
    drawList();
    if (document.getElementById('courtHalf')) drawCourt();
  });
  document.getElementById('rName').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('rAdd').click(); });
}

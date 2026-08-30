import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { confirmModal, toast, withButtonLoading } from '../modal.js';
import { addPlayer, removePlayerFromSector, fetchPlayerPhotoUrls } from '../../api/roster.js';
import { canEditRoster } from '../../utils/permissions.js';
import { avatarHtml, wireAvatarClicks } from '../playerAvatar.js';
import { computeSeasonStats } from '../../utils/stats.js';

// Posizioni fisse dei 5 slot sul mezzo campo: il canestro è in alto, quindi
// playmaker arretrato in basso, ali a metà, lunghi vicino all'area. Non
// dipendono dal ruolo testuale del giocatore, spesso libero o mancante.
const SLOTS = [
  { top: '84%', left: '50%' },
  { top: '58%', left: '16%' },
  { top: '58%', left: '84%' },
  { top: '30%', left: '27%' },
  { top: '30%', left: '73%' }
];

// Mezzo campo FIBA in scala (15m × 14m → viewBox 150×140, canestro in alto).
// Volutamente sbiadito: deve leggersi come contesto, non competere coi giocatori.
const COURT_SVG = `
<svg class="court-lines" viewBox="0 0 150 140" preserveAspectRatio="none" fill="none"
     stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="0.6" y="0.6" width="148.8" height="138.8" rx="1"/>
  <rect x="50.5" y="0.6" width="49" height="57.4"/>
  <circle cx="75" cy="58" r="18"/>
  <path d="M9 0.6V29.9"/><path d="M141 0.6V29.9"/>
  <path d="M9 29.9A67.5 67.5 0 0 0 141 29.9"/>
  <path d="M62.5 15.75A12.5 12.5 0 0 0 87.5 15.75"/>
  <path d="M66 12h18"/><path d="M75 12v1.5"/>
  <circle cx="75" cy="15.75" r="2.25"/>
  <path d="M57 139.4A18 18 0 0 1 93 139.4"/>
</svg>`;

function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function avgLine(seasonRow) {
  if (!seasonRow || !seasonRow.games) return null;
  const g = seasonRow.games;
  return {
    pts: (seasonRow.pts / g).toFixed(1),
    ast: (seasonRow.ast / g).toFixed(1),
    reb: (seasonRow.reb / g).toFixed(1)
  };
}

// Formazione di default: titolari/panchinari dell'ultima partita giocata,
// mappati sulla rosa attuale per id (o per numero se l'id non è più presente).
// Fallback: primi 5 della rosa se non c'è ancora nessuna partita in storico.
function computeDefaultCourtIds() {
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
    if (ids.length >= 5) break;
    if (!ids.includes(p.id)) ids.push(p.id);
  }
  return ids.slice(0, 5);
}

export async function renderRosaTab(c) {
  const canEdit = canEditRoster(state.currentUser);
  state.selectedCourtId = null;
  state.pendingBenchId = null;
  let courtIds = computeDefaultCourtIds();
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
  const season = computeSeasonStats(state.history);

  c.innerHTML = `
    <div class="settings-col">
    ${state.roster.length === 0 ? '<div class="placeholder-card">Nessun giocatore in rosa.</div>' : `
    <div class="court-half" id="courtHalf"></div>
    <div class="section-label">Panchina</div>
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
    <div id="rosaHint">${canEdit && state.roster.length < 5 ? `<div class="hint">Servono almeno 5 giocatori in rosa per poter avviare una partita.</div>` : ''}</div>
    </div>
  `;

  function playerToken(p, style) {
    const url = photoUrls[p.id];
    const onCourt = courtIds.includes(p.id);
    const armed = onCourt ? state.selectedCourtId === p.id : state.pendingBenchId === p.id;
    const avg = avgLine(season.find(x => x.name === p.name));
    return `
      <div class="court-token" data-token="${p.id}" style="${style || ''}">
        <div class="court-token-top">
          <div class="court-token-avatar">${url ? `<img src="${esc(url)}">` : esc(initials(p.name))}</div>
          <button class="court-token-swap${armed ? ' armed' : ''}" data-swap="${p.id}" title="Sostituisci" aria-label="Sostituisci ${esc(p.name)}">⇄</button>
        </div>
        <div class="court-token-name">${esc(p.name)}</div>
        <div class="court-token-num">#${esc(p.number)}</div>
        ${avg
          ? `<div class="court-token-stats"><span><b>${avg.pts}</b>PT</span><span><b>${avg.ast}</b>AS</span><span><b>${avg.reb}</b>RB</span></div>`
          : '<div class="court-token-stats empty">nessuna media</div>'}
      </div>`;
  }

  function drawCourt() {
    const courtEl = document.getElementById('courtHalf');
    const benchEl = document.getElementById('benchRow');
    if (!courtEl || !benchEl) return;
    const courtPlayers = courtIds.map(id => state.roster.find(p => p.id === id)).filter(Boolean);
    const benchPlayers = state.roster.filter(p => !courtIds.includes(p.id));

    courtEl.innerHTML = COURT_SVG + courtPlayers.map((p, i) => playerToken(p, `top:${SLOTS[i].top};left:${SLOTS[i].left};`)).join('');
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
    const s = season.find(x => x.name === p.name);
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
            <div class="mini-card"><div class="lbl">PPG</div><div class="val">${(s.pts / s.games).toFixed(1)}</div></div>
            <div class="mini-card"><div class="lbl">RPG</div><div class="val">${(s.reb / s.games).toFixed(1)}</div></div>
            <div class="mini-card"><div class="lbl">APG</div><div class="val">${(s.ast / s.games).toFixed(1)}</div></div>
          </div>
          <div class="hint" style="margin-top:10px;">${s.games} partite giocate in stagione</div>
          ` : `<div class="hint" style="margin-top:18px;">Nessuna statistica disponibile ancora.</div>`}
          <button class="btn btn-secondary" id="spotlightClose" style="width:100%;margin-top:18px;">Chiudi</button>
        </div>
      </div>`;
    document.getElementById('spotlightOverlay').onclick = (e) => { if (e.target.id === 'spotlightOverlay') root.innerHTML = ''; };
    document.getElementById('spotlightClose').onclick = () => { root.innerHTML = ''; };
  }

  if (state.roster.length > 0) drawCourt();

  function drawList() {
    document.getElementById('rosaCountLabel').textContent = `Rosa (${state.roster.length})`;
    const hintEl = document.getElementById('rosaHint');
    if (hintEl) hintEl.innerHTML = canEdit && state.roster.length < 5 ? `<div class="hint">Servono almeno 5 giocatori in rosa per poter avviare una partita.</div>` : '';
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
          await removePlayerFromSector(id, state.activeSectorId);
          state.roster = state.roster.filter(x => x.id !== id);
          courtIds = courtIds.filter(x => x !== id);
          for (const p of state.roster) {
            if (courtIds.length >= 5) break;
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
    const created = await addPlayer(state.teamProfile.id, state.activeSectorId, num || '-', name);
    state.roster.push(created);
    numIn.value = ''; nameIn.value = ''; numIn.focus();
    drawList();
    if (document.getElementById('courtHalf')) drawCourt();
  });
  document.getElementById('rName').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('rAdd').click(); });
}

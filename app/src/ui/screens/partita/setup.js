import { state } from '../../../state.js';
import { esc, clamp } from '../../../utils/format.js';
import { currentSport } from '../../../utils/sports/index.js';
import { toast, withButtonLoading } from '../../modal.js';
import { startGame } from '../../../api/games.js';
import { fetchPlayerPhotoUrls } from '../../../api/roster.js';
import { avatarHtml, wireAvatarClicks } from '../../playerAvatar.js';
import { renderLiveMatch } from './tracker.js';

export function renderPartitaTab(c) {
  if (state.liveGame) { renderLiveMatch(c); }
  else { renderMatchSetup(c); }
}

async function renderMatchSetup(c) {
  const sport = currentSport();
  const conf = sport.scout;
  const onField = sport.match.minOnField;
  const startersLabel = sport.field.onFieldLabel.toLowerCase();

  if (state.roster.length < onField) {
    c.innerHTML = `<div class="placeholder-card">
      Servono almeno ${onField} giocatori in rosa per avviare una partita di ${esc(sport.label.toLowerCase())}.<br><br>
      Vai nella sezione <b>Rosa</b> per aggiungerli.
    </div>`;
    return;
  }

  let starters = {};
  c.innerHTML = `
    <div class="settings-col">
    <div class="card">
      <h2>Nuova partita</h2>
      <div class="field"><label>Avversario</label><input type="text" id="mOpp" placeholder="Nome squadra avversaria"></div>
      <div class="${conf.period.hasClock ? 'row2' : ''}">
        <div class="field"><label>Numero ${conf.period.label.toLowerCase()}</label>
          <input type="number" id="mNq" value="${conf.period.count}" min="1" max="9"></div>
        ${conf.period.hasClock ? `<div class="field"><label>Durata (min)</label>
          <input type="number" id="mQlen" value="${conf.period.minutes}" min="1" max="60"></div>` : ''}
      </div>
      ${conf.period.hasClock ? '' : `<div class="hint">Nella pallavolo non c'è cronometro: si passa al set successivo quando lo chiudi tu.</div>`}
    </div>
    <div class="card">
      <h2>Chi parte in campo (scegli ${onField})</h2>
      <div class="hint" style="margin-top:0;">Sono i giocatori a cui potrai assegnare le azioni fin dal primo minuto. I cambi si fanno durante la partita.</div>
      <div id="starterList"></div>
      <div class="error-msg" id="mError"></div>
    </div>
    <button class="btn btn-primary" id="mStart">Inizia partita</button>
    </div>
  `;

  const holder = document.getElementById('starterList');
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
  const countLabel = () => {
    const n = Object.keys(starters).length;
    document.getElementById('mStart').textContent = n === onField
      ? 'Inizia partita'
      : `Inizia partita (${n}/${onField})`;
  };

  state.roster.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 36)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div><span class="role-badge" id="tag_${p.id}" style="background:var(--panel2);color:var(--dim);">Panchina</span>`;
    row.onclick = () => {
      const count = Object.keys(starters).length;
      if (starters[p.id]) { delete starters[p.id]; }
      else {
        if (count >= onField) { toast(`Hai già scelto ${onField} giocatori`); return; }
        starters[p.id] = true;
      }
      const tag = document.getElementById('tag_' + p.id);
      tag.textContent = starters[p.id] ? 'In campo' : 'Panchina';
      tag.className = 'role-badge ' + (starters[p.id] ? 'role-admin' : '');
      if (!starters[p.id]) tag.style.cssText = 'background:var(--panel2);color:var(--dim);';
      else tag.style.cssText = '';
      countLabel();
    };
    holder.appendChild(row);
  });
  wireAvatarClicks(holder, photoUrls);
  countLabel();

  document.getElementById('mStart').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('mError');
    const oppName = document.getElementById('mOpp').value.trim() || 'Avversari';
    const lenEl = document.getElementById('mQlen');
    const qLen = conf.period.hasClock
      ? clamp(parseInt(lenEl.value) || conf.period.minutes, 1, 60) * 60
      : 0;
    const numQ = clamp(parseInt(document.getElementById('mNq').value) || conf.period.count, 1, 9);
    const starterIds = Object.keys(starters);
    if (starterIds.length !== onField) {
      errEl.textContent = `Scegli esattamente ${onField} giocatori per il ${startersLabel} (adesso ne hai ${starterIds.length}).`;
      return;
    }

    const players = state.roster.map(p => ({
      id: p.id, number: p.number, name: p.name,
      onCourt: !!starters[p.id], stats: sport.newStats()
    }));
    const draftGame = {
      oppName, quarterLength: qLen, numQuarters: numQ, quarter: 1,
      clock: conf.period.direction === 'up' ? 0 : qLen, clockRunning: false,
      teamScore: 0, oppScore: 0, players,
      quarterFouls: conf.teamFouls ? { 1: 0 } : {},
      periodScores: []
    };
    state.undoStack = []; state.selectedCourtId = null; state.pendingBenchId = null;
    state.liveGame = await startGame(state.teamProfile.id, state.activeSectorId, draftGame, state.currentUser.id);
    const { renderApp } = await import('../../layout.js');
    renderApp();
  });
}

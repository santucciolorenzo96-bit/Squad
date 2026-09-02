import { state } from '../../../state.js';
import { esc } from '../../../utils/format.js';
import { clamp } from '../../../utils/format.js';
import { newPlayerStats } from '../../../utils/stats.js';
import { toast, withButtonLoading } from '../../modal.js';
import { startGame } from '../../../api/games.js';
import { fetchPlayerPhotoUrls } from '../../../api/roster.js';
import { avatarHtml, wireAvatarClicks } from '../../playerAvatar.js';
import { renderLiveMatch } from './tracker.js';
import { currentSport } from '../../../utils/sports/index.js';

export function renderPartitaTab(c) {
  // Il cronometro dal vivo è costruito sulla pallacanestro: periodi, falli di
  // squadra, quintetto. Negli altri sport la partita si registra a fine gara,
  // che è anche come lavorano davvero le società dilettantistiche.
  const sport = currentSport();
  if (!sport.match.liveTracker) {
    c.innerHTML = `<div class="placeholder-card">
      <span class="tag">${esc(sport.label)}</span>
      Il tabellino dal vivo non è ancora disponibile per questo sport.<br><br>
      Le partite si registrano a fine gara dal <b>Calendario</b>: segna il risultato
      e la partita entra in archivio, in classifica e nelle statistiche.
    </div>`;
    return;
  }
  if (state.liveGame) { renderLiveMatch(c); }
  else { renderMatchSetup(c); }
}

async function renderMatchSetup(c) {
  if (state.roster.length < 5) {
    c.innerHTML = `<div class="placeholder-card">Servono almeno 5 giocatori in rosa per avviare una partita.<br><br>Vai nella sezione <b>Rosa</b> per aggiungerli.</div>`;
    return;
  }
  let starters = {};
  c.innerHTML = `
    <div class="settings-col">
    <div class="card">
      <h2>Nuova partita</h2>
      <div class="field"><label>Avversario</label><input type="text" id="mOpp" placeholder="Nome squadra avversaria"></div>
      <div class="row2">
        <div class="field"><label>Durata periodo (min)</label><input type="number" id="mQlen" value="10" min="1" max="60"></div>
        <div class="field"><label>Numero periodi</label><input type="number" id="mNq" value="4" min="1" max="8"></div>
      </div>
    </div>
    <div class="card">
      <h2>Quintetto titolare (scegli 5)</h2>
      <div id="starterList"></div>
      <div class="error-msg" id="mError"></div>
    </div>
    <button class="btn btn-primary" id="mStart">Inizia partita</button>
    </div>
  `;
  const holder = document.getElementById('starterList');
  const photoUrls = await fetchPlayerPhotoUrls(state.roster).catch(() => ({}));
  state.roster.forEach(p => {
    const row = document.createElement('div');
    row.className = 'list-row';
    row.style.cursor = 'pointer';
    row.innerHTML = `${avatarHtml(p, photoUrls[p.id], 36)}<div class="main"><div class="nm">${esc(p.name)} <span class="hint" style="display:inline;">#${esc(p.number)}</span></div></div><span class="role-badge" id="tag_${p.id}" style="background:var(--panel2);color:var(--dim);">Panchina</span>`;
    row.onclick = () => {
      const count = Object.keys(starters).length;
      if (starters[p.id]) { delete starters[p.id]; }
      else { if (count >= 5) { toast('Hai già selezionato 5 titolari'); return; } starters[p.id] = true; }
      document.getElementById('tag_' + p.id).textContent = starters[p.id] ? 'Titolare' : 'Panchina';
      document.getElementById('tag_' + p.id).className = 'role-badge ' + (starters[p.id] ? 'role-admin' : '');
      if (!starters[p.id]) document.getElementById('tag_' + p.id).style.cssText = 'background:var(--panel2);color:var(--dim);';
    };
    holder.appendChild(row);
  });
  wireAvatarClicks(holder, photoUrls);

  document.getElementById('mStart').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('mError');
    const oppName = document.getElementById('mOpp').value.trim() || 'Avversari';
    const qLen = clamp(parseInt(document.getElementById('mQlen').value) || 10, 1, 60) * 60;
    const numQ = clamp(parseInt(document.getElementById('mNq').value) || 4, 1, 8);
    const starterIds = Object.keys(starters);
    if (starterIds.length !== 5) { errEl.textContent = 'Seleziona esattamente 5 titolari (attualmente ' + starterIds.length + ').'; return; }

    const players = state.roster.map(p => ({ id: p.id, number: p.number, name: p.name, onCourt: !!starters[p.id], stats: newPlayerStats() }));
    const draftGame = {
      oppName, quarterLength: qLen, numQuarters: numQ, quarter: 1, clock: qLen, clockRunning: false,
      teamScore: 0, oppScore: 0, players, quarterFouls: { 1: 0 }
    };
    state.undoStack = []; state.selectedCourtId = null; state.pendingBenchId = null;
    state.liveGame = await startGame(state.teamProfile.id, state.activeSectorId, draftGame, state.currentUser.id);
    const { renderApp } = await import('../../layout.js');
    renderApp();
  });
}

import { state } from '../../../state.js';
import { esc, fmtClock, fmtMin } from '../../../utils/format.js';
import { TOV_TYPES } from '../../../utils/permissions.js';
import { playerPts } from '../../../utils/stats.js';
import { confirmModal, toast } from '../../modal.js';
import { saveLiveGame as apiSaveLiveGame, endGame as apiEndGame } from '../../../api/games.js';
import { openBoxScoreModal } from './boxscore.js';

let clockIntervalHandle = null;
function stopClockInterval() { if (clockIntervalHandle) { clearInterval(clockIntervalHandle); clockIntervalHandle = null; } }
function startClockInterval() {
  stopClockInterval();
  clockIntervalHandle = setInterval(() => {
    if (!state.liveGame || !state.liveGame.clockRunning) return;
    state.liveGame.clock = Math.max(0, state.liveGame.clock - 1);
    state.liveGame.players.forEach(p => { if (p.onCourt) p.stats.seconds += 1; });
    if (state.liveGame.clock === 0) {
      state.liveGame.clockRunning = false;
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
      toast('Fine periodo');
    }
    updateScoreboardOnly();
    if (state.liveGame.clock % 5 === 0) persistLiveGame();
  }, 1000);
}

function persistLiveGame() { apiSaveLiveGame(state.liveGame.id, state.liveGame); }

export function renderLiveMatch(c) {
  c.innerHTML = `
    <div class="scoreboard">
      <div class="sb-top">
        <div class="sb-team"><div class="sb-label">${esc(state.teamProfile.name).toUpperCase()}</div><div class="sb-score us" id="sbUsScore">0</div></div>
        <div class="sb-mid">
          <div class="sb-quarter" id="sbQuarterLabel"></div>
          <div class="sb-clock stopped" id="sbClock"></div>
          <div class="sb-fouls" id="sbFouls"></div>
        </div>
        <div class="sb-team"><div class="sb-label" id="sbOppLabel"></div><div class="sb-score" id="sbOppScore">0</div></div>
      </div>
      <div class="clock-controls">
        <button class="btn btn-secondary" id="clockToggleBtn">▶ Avvia</button>
        <button class="btn btn-secondary" id="clockResetBtn">↺ Correggi</button>
        <button class="btn btn-secondary" id="nextQuarterBtn">Periodo →</button>
      </div>
      <div class="opp-controls">
        <span class="lbl">Punti avversari:</span>
        <button class="btn" id="opp1Btn">+1</button><button class="btn" id="opp2Btn">+2</button><button class="btn" id="opp3Btn">+3</button>
      </div>
    </div>
    <div class="section-label"><span>In campo</span><span id="ptsLive" style="font-family:var(--font-mono);"></span></div>
    <div class="court-row" id="courtRow"></div>
    <div id="instructionBar" class="instruction-bar"></div>
    <div class="section-label">Panchina</div>
    <div class="bench-list" id="benchList"></div>
    <div class="stat-panel" id="statPanel"></div>
    <div class="footer-actions">
      <button class="btn btn-secondary" id="undoBtn">↩ Annulla ultima</button>
      <button class="btn btn-ghost" id="boxScoreBtn">Box Score</button>
      <button class="btn btn-danger" id="endGameBtn">Fine Partita</button>
    </div>
  `;

  document.getElementById('clockToggleBtn').onclick = () => {
    if (state.liveGame.clock <= 0) { toast('Il periodo è terminato: passa al periodo successivo'); return; }
    state.liveGame.clockRunning = !state.liveGame.clockRunning;
    if (state.liveGame.clockRunning) startClockInterval(); else stopClockInterval();
    persistLiveGame();
    updateScoreboardOnly();
  };
  document.getElementById('clockResetBtn').onclick = () => {
    confirmModal('Correggere il cronometro?', 'Il tempo del periodo corrente verrà riportato a ' + fmtClock(state.liveGame.quarterLength) + '.', () => {
      pushUndo();
      state.liveGame.clock = state.liveGame.quarterLength; state.liveGame.clockRunning = false; stopClockInterval();
      persistLiveGame(); updateScoreboardOnly();
    });
  };
  document.getElementById('nextQuarterBtn').onclick = () => {
    const advance = (extraOT) => {
      pushUndo();
      if (extraOT) { state.liveGame.numQuarters += 1; state.liveGame.quarterLength = 5 * 60; }
      state.liveGame.quarter += 1; state.liveGame.clock = state.liveGame.quarterLength; state.liveGame.clockRunning = false;
      state.liveGame.quarterFouls[state.liveGame.quarter] = 0;
      stopClockInterval(); persistLiveGame(); renderLiveMatch(document.getElementById('tabContent'));
    };
    if (state.liveGame.quarter >= state.liveGame.numQuarters) {
      confirmModal('Aggiungere un supplementare?', 'Verrà aggiunto un periodo extra di 5 minuti.', () => advance(true));
    } else { advance(false); }
  };
  document.getElementById('opp1Btn').onclick = () => addOpponentScore(1);
  document.getElementById('opp2Btn').onclick = () => addOpponentScore(2);
  document.getElementById('opp3Btn').onclick = () => addOpponentScore(3);
  document.getElementById('undoBtn').onclick = performUndo;
  document.getElementById('boxScoreBtn').onclick = () => openBoxScoreModal(state.liveGame);
  document.getElementById('endGameBtn').onclick = () => {
    confirmModal('Terminare la partita?', 'La partita verrà salvata nello storico e potrà essere consultata da tutto lo staff.', async () => {
      stopClockInterval();
      const finished = state.liveGame;
      await apiEndGame(finished.id, finished);
      state.history.push({ ...finished, date: new Date().toISOString() });
      state.liveGame = null;
      toast('Partita salvata nello storico');
      const { renderApp } = await import('../../layout.js');
      renderApp();
    }, 'Termina e salva');
  };

  updateScoreboardOnly();
  renderCourtAndBench();
  if (state.liveGame.clockRunning) startClockInterval();
}

function updateScoreboardOnly() {
  if (!document.getElementById('sbUsScore')) return;
  document.getElementById('sbUsScore').textContent = state.liveGame.teamScore;
  document.getElementById('sbOppScore').textContent = state.liveGame.oppScore;
  document.getElementById('sbOppLabel').textContent = (state.liveGame.oppName || 'AVVERSARI').toUpperCase();
  document.getElementById('sbQuarterLabel').textContent = state.liveGame.quarter + '° PERIODO';
  const clockEl = document.getElementById('sbClock');
  clockEl.textContent = fmtClock(state.liveGame.clock);
  clockEl.className = 'sb-clock ' + (state.liveGame.clock === 0 ? 'zero' : (state.liveGame.clockRunning ? 'running' : 'stopped'));
  const fouls = state.liveGame.quarterFouls[state.liveGame.quarter] || 0;
  const foulsEl = document.getElementById('sbFouls');
  foulsEl.textContent = 'Falli: ' + fouls + (fouls >= 5 ? ' (BONUS)' : '');
  foulsEl.className = 'sb-fouls' + (fouls >= 5 ? ' bonus' : '');
  document.getElementById('clockToggleBtn').textContent = state.liveGame.clockRunning ? '⏸ Pausa' : '▶ Avvia';
  document.getElementById('nextQuarterBtn').textContent = state.liveGame.quarter >= state.liveGame.numQuarters ? 'Suppl. →' : 'Periodo →';
}

function pushUndo() { state.undoStack.push(JSON.stringify(state.liveGame)); if (state.undoStack.length > 60) state.undoStack.shift(); }
function performUndo() {
  if (state.undoStack.length === 0) { toast('Niente da annullare'); return; }
  state.liveGame = JSON.parse(state.undoStack.pop());
  persistLiveGame();
  updateScoreboardOnly();
  renderCourtAndBench();
  toast('Azione annullata');
}
function addOpponentScore(pts) {
  pushUndo();
  state.liveGame.oppScore += pts;
  state.liveGame.players.forEach(p => { if (p.onCourt) p.stats.plusMinus -= pts; });
  persistLiveGame(); updateScoreboardOnly(); renderCourtAndBench();
}

function renderCourtAndBench() {
  const courtRow = document.getElementById('courtRow');
  courtRow.innerHTML = '';
  state.liveGame.players.filter(p => p.onCourt).forEach(p => {
    const tile = document.createElement('div');
    tile.className = 'player-tile' + (state.selectedCourtId === p.id ? ' selected' : '') + (state.pendingBenchId ? ' pending-out' : '');
    tile.innerHTML = `${p.stats.pf >= 5 ? '<div class="foul-badge">' + p.stats.pf + '</div>' : ''}<div class="num">#${esc(p.number)}</div><div class="nm">${esc(p.name)}</div><div class="pts">${playerPts(p)} PT</div>`;
    tile.onclick = () => onCourtTileClick(p.id);
    courtRow.appendChild(tile);
  });
  const benchList = document.getElementById('benchList');
  benchList.innerHTML = '';
  const bench = state.liveGame.players.filter(p => !p.onCourt);
  if (bench.length === 0) { benchList.innerHTML = '<div class="hint">Nessun giocatore in panchina.</div>'; }
  bench.forEach(p => {
    const row = document.createElement('div');
    row.className = 'bench-row' + (state.pendingBenchId === p.id ? ' pending-in' : '');
    row.innerHTML = `<div class="num">#${esc(p.number)}</div><div class="nm">${esc(p.name)}</div><div class="mini-stat">${playerPts(p)} PT · ${fmtMin(p.stats.seconds)}</div>`;
    row.onclick = () => benchRowClick(p.id);
    benchList.appendChild(row);
  });
  updateInstructionBar();
  document.getElementById('ptsLive').textContent = state.liveGame.teamScore + ' PT SQUADRA';
  renderStatPanel(state.liveGame.players.find(p => p.id === state.selectedCourtId) || null);
}
function updateInstructionBar() {
  const bar = document.getElementById('instructionBar');
  if (state.pendingBenchId) {
    const p = state.liveGame.players.find(x => x.id === state.pendingBenchId);
    bar.textContent = `Tocca il giocatore in campo da sostituire con #${p.number} ${p.name}`;
    bar.classList.add('active-mode');
  } else if (state.selectedCourtId) {
    bar.textContent = 'Assegna una statistica qui sotto, oppure tocca un altro giocatore.';
    bar.classList.remove('active-mode');
  } else {
    bar.textContent = 'Tocca un giocatore in campo per assegnargli una statistica, o uno in panchina per un cambio.';
    bar.classList.remove('active-mode');
  }
}
function onCourtTileClick(playerId) {
  if (state.pendingBenchId) {
    pushUndo();
    const outP = state.liveGame.players.find(p => p.id === playerId);
    const inP = state.liveGame.players.find(p => p.id === state.pendingBenchId);
    outP.onCourt = false; inP.onCourt = true; state.pendingBenchId = null;
    if (state.selectedCourtId === outP.id) state.selectedCourtId = inP.id;
    persistLiveGame();
    toast(`#${inP.number} ${inP.name} entra per #${outP.number} ${outP.name}`);
    renderCourtAndBench();
    return;
  }
  state.selectedCourtId = playerId; state.showTovSubtypes = false;
  renderCourtAndBench();
}
function benchRowClick(playerId) {
  state.pendingBenchId = (state.pendingBenchId === playerId) ? null : playerId;
  renderCourtAndBench();
}

function renderStatPanel(p) {
  const panel = document.getElementById('statPanel');
  if (!p) { panel.innerHTML = '<div class="no-selection">Nessun giocatore selezionato</div>'; return; }
  panel.innerHTML = `
    <div class="stat-group"><div class="stat-group-label">Tiro da 2</div>
      <div class="stat-grid two"><button class="stat-btn made" data-act="fg2_made">✓ Canestro</button><button class="stat-btn miss" data-act="fg2_miss">✗ Errore</button></div></div>
    <div class="stat-group"><div class="stat-group-label">Tiro da 3</div>
      <div class="stat-grid two"><button class="stat-btn made" data-act="fg3_made">✓ Canestro</button><button class="stat-btn miss" data-act="fg3_miss">✗ Errore</button></div></div>
    <div class="stat-group"><div class="stat-group-label">Tiro libero</div>
      <div class="stat-grid two"><button class="stat-btn made" data-act="ft_made">✓ Canestro</button><button class="stat-btn miss" data-act="ft_miss">✗ Errore</button></div></div>
    <div class="stat-group"><div class="stat-group-label">Rimbalzi</div>
      <div class="stat-grid two"><button class="stat-btn neutral" data-act="orb">Offensivo</button><button class="stat-btn neutral" data-act="drb">Difensivo</button></div></div>
    <div class="stat-group"><div class="stat-group-label">Playmaking &amp; difesa</div>
      <div class="stat-grid"><button class="stat-btn neutral" data-act="ast">Assist</button><button class="stat-btn neutral" data-act="stl">Palla rubata</button><button class="stat-btn neutral" data-act="blk">Stoppata fatta</button></div></div>
    <div class="stat-group"><div class="stat-group-label">Palla persa</div>
      <div class="stat-grid two"><button class="stat-btn warn" data-act="tov_quick">Palla persa</button><button class="subtype-toggle" id="tovDetailToggle" style="grid-column:span 2;justify-self:start;">${state.showTovSubtypes ? 'Nascondi dettaglio ▲' : 'Specifica tipo ▾'}</button></div>
      <div class="subtype-row ${state.showTovSubtypes ? '' : 'hidden'}" id="tovSubtypeRow">${TOV_TYPES.map(t => `<button class="stat-btn warn" data-act="tov_${t.key}">${t.label}</button>`).join('')}</div></div>
    <div class="stat-group"><div class="stat-group-label">Falli e stoppate subite</div>
      <div class="stat-grid"><button class="stat-btn warn" data-act="pf">Fallo commesso</button><button class="stat-btn neutral" data-act="pfDrawn">Fallo subito</button><button class="stat-btn warn" data-act="blkAgainst">Stoppata subita</button></div></div>
  `;
  panel.querySelectorAll('[data-act]').forEach(btn => btn.onclick = () => applyStatAction(p.id, btn.getAttribute('data-act')));
  const toggleBtn = document.getElementById('tovDetailToggle');
  if (toggleBtn) toggleBtn.onclick = () => { state.showTovSubtypes = !state.showTovSubtypes; renderStatPanel(state.liveGame.players.find(x => x.id === p.id)); };
}

function applyStatAction(playerId, act) {
  const p = state.liveGame.players.find(x => x.id === playerId); if (!p) return;
  pushUndo();
  const s = p.stats; let scoreDelta = 0;
  switch (act) {
    case 'fg2_made': s.fgm2++; s.fga2++; scoreDelta = 2; break;
    case 'fg2_miss': s.fga2++; break;
    case 'fg3_made': s.fgm3++; s.fga3++; scoreDelta = 3; break;
    case 'fg3_miss': s.fga3++; break;
    case 'ft_made': s.ftm++; s.fta++; scoreDelta = 1; break;
    case 'ft_miss': s.fta++; break;
    case 'orb': s.orb++; break;
    case 'drb': s.drb++; break;
    case 'ast': s.ast++; break;
    case 'stl': s.stl++; break;
    case 'blk': s.blk++; break;
    case 'blkAgainst': s.blkAgainst++; break;
    case 'pf': s.pf++; state.liveGame.quarterFouls[state.liveGame.quarter] = (state.liveGame.quarterFouls[state.liveGame.quarter] || 0) + 1; break;
    case 'pfDrawn': s.pfDrawn++; break;
    case 'tov_quick': s.tov++; s.tovTypes.generica++; break;
    default:
      if (act.startsWith('tov_')) { const type = act.slice(4); if (TOV_TYPES.find(t => t.key === type)) { s.tov++; s.tovTypes[type]++; } }
  }
  if (scoreDelta > 0) { state.liveGame.teamScore += scoreDelta; state.liveGame.players.forEach(pl => { if (pl.onCourt) pl.stats.plusMinus += scoreDelta; }); }
  persistLiveGame();
  updateScoreboardOnly();
  renderCourtAndBench();
  if (navigator.vibrate) navigator.vibrate(15);
}

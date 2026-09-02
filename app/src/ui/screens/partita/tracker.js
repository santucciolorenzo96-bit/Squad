import { state } from '../../../state.js';
import { esc, fmtClock, fmtMin } from '../../../utils/format.js';
import { currentSport } from '../../../utils/sports/index.js';
import { confirmModal, formModal, toast } from '../../modal.js';
import { saveLiveGame as apiSaveLiveGame, endGame as apiEndGame } from '../../../api/games.js';
import { openBoxScoreModal } from './boxscore.js';

// Scout dal vivo. Non conosce nessuno sport: legge da `sport.scout` quali
// comandi mostrare, se c'è un cronometro e in che verso corre, e come si
// compone il punteggio.
//
// Due regole guidano l'interazione, e vengono dal campo:
//
// 1. Due tocchi per ogni evento — giocatore, poi azione — e mai uno scroll in
//    mezzo. I comandi si aprono in un pannello ancorato in basso, sotto il
//    pollice, invece di stare in fondo alla pagina come prima. Nel basket si
//    segna un evento ogni pochi secondi: ogni gesto in più si paga.
// 2. Il punteggio avversario si scrive a fine periodo, non colpo su colpo.
//    Inseguire i canestri altrui mentre si segue la propria squadra è la
//    prima causa di tabellini sbagliati.

let clockIntervalHandle = null;
function stopClockInterval() { if (clockIntervalHandle) { clearInterval(clockIntervalHandle); clockIntervalHandle = null; } }

function sc() { return currentSport().scout; }

function startClockInterval() {
  stopClockInterval();
  const conf = sc();
  clockIntervalHandle = setInterval(() => {
    const g = state.liveGame;
    if (!g || !g.clockRunning) return;
    if (conf.period.direction === 'up') {
      g.clock = Math.min(g.quarterLength, g.clock + 1);
    } else {
      g.clock = Math.max(0, g.clock - 1);
    }
    if (conf.trackSeconds) g.players.forEach(p => { if (p.onCourt) p.stats.seconds += 1; });
    const atEnd = conf.period.direction === 'up' ? g.clock >= g.quarterLength : g.clock === 0;
    if (atEnd) {
      g.clockRunning = false;
      if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
      toast('Fine ' + conf.period.label.toLowerCase());
    }
    updateScoreboardOnly();
    if (g.clock % 5 === 0) persistLiveGame();
  }, 1000);
}

function persistLiveGame() { apiSaveLiveGame(state.liveGame.id, state.liveGame); }

// Il punteggio mostrato non è mai "quello che ho digitato": si ricava sempre
// dai dati, così un annullamento non lascia mai due numeri incoerenti.
function recomputeScores() {
  const g = state.liveGame;
  const sport = currentSport();
  const conf = sport.scout;
  const periods = g.periodScores || [];
  if (conf.scoreDisplay === 'setsWon') {
    g.teamScore = periods.filter(x => x && x.us > x.them).length;
    g.oppScore = periods.filter(x => x && x.them > x.us).length;
    return;
  }
  if (conf.ourScore === 'fromActions') {
    g.teamScore = g.players.reduce((n, p) => n + sport.score(p.stats || {}), 0);
  } else {
    g.teamScore = periods.reduce((n, x) => n + ((x && x.us) || 0), 0);
  }
  g.oppScore = periods.reduce((n, x) => n + ((x && x.them) || 0), 0);
}

export function renderLiveMatch(c) {
  const sport = currentSport();
  const conf = sport.scout;
  const g = state.liveGame;
  if (!g.periodScores) g.periodScores = [];
  recomputeScores();

  c.innerHTML = `
    <div class="scoreboard">
      <div class="sb-top">
        <div class="sb-team"><div class="sb-label">${esc(state.teamProfile.name).toUpperCase()}</div><div class="sb-score us" id="sbUsScore">0</div></div>
        <div class="sb-mid">
          <div class="sb-quarter" id="sbQuarterLabel"></div>
          ${conf.period.hasClock ? '<div class="sb-clock stopped" id="sbClock"></div>' : '<div class="sb-setline" id="sbSetLine"></div>'}
          ${conf.teamFouls ? '<div class="sb-fouls" id="sbFouls"></div>' : ''}
        </div>
        <div class="sb-team"><div class="sb-label" id="sbOppLabel"></div><div class="sb-score" id="sbOppScore">0</div></div>
      </div>
      <div class="clock-controls">
        ${conf.period.hasClock ? `
          <button class="btn btn-secondary" id="clockToggleBtn">▶ Avvia</button>
          <button class="btn btn-secondary" id="clockResetBtn">↺ Correggi</button>` : ''}
        <button class="btn btn-secondary" id="nextQuarterBtn">Chiudi ${conf.period.label.toLowerCase()} →</button>
      </div>
      <div class="period-strip" id="periodStrip"></div>
    </div>

    <div class="section-label"><span>${esc(currentSport().field.onFieldLabel)}</span><span id="ptsLive" style="font-family:var(--font-mono);"></span></div>
    <div class="court-row" id="courtRow"></div>
    <div id="instructionBar" class="instruction-bar"></div>
    <div class="section-label">${esc(currentSport().field.benchLabel)}</div>
    <div class="bench-list" id="benchList"></div>

    <div class="footer-actions">
      <button class="btn btn-secondary" id="undoBtn">↩ Annulla ultima</button>
      <button class="btn btn-ghost" id="boxScoreBtn">Tabellino</button>
      <button class="btn btn-danger" id="endGameBtn">Fine partita</button>
    </div>
    <div id="scoutSheetRoot"></div>
  `;

  if (conf.period.hasClock) {
    document.getElementById('clockToggleBtn').onclick = () => {
      const atEnd = conf.period.direction === 'up'
        ? state.liveGame.clock >= state.liveGame.quarterLength
        : state.liveGame.clock <= 0;
      if (atEnd) { toast(conf.period.label + ' terminato: chiudilo per passare al successivo'); return; }
      state.liveGame.clockRunning = !state.liveGame.clockRunning;
      if (state.liveGame.clockRunning) startClockInterval(); else stopClockInterval();
      persistLiveGame();
      updateScoreboardOnly();
    };
    document.getElementById('clockResetBtn').onclick = () => {
      const target = conf.period.direction === 'up' ? 0 : state.liveGame.quarterLength;
      confirmModal('Correggere il cronometro?', 'Il tempo tornerà a ' + fmtClock(target) + '.', () => {
        pushUndo();
        state.liveGame.clock = target; state.liveGame.clockRunning = false; stopClockInterval();
        persistLiveGame(); updateScoreboardOnly();
      });
    };
  }

  document.getElementById('nextQuarterBtn').onclick = () => askPeriodScore({ thenAdvance: true });
  document.getElementById('undoBtn').onclick = performUndo;
  document.getElementById('boxScoreBtn').onclick = () => openBoxScoreModal(state.liveGame);
  document.getElementById('endGameBtn').onclick = onEndGame;

  updateScoreboardOnly();
  renderCourtAndBench();
  if (state.liveGame.clockRunning && conf.period.hasClock) startClockInterval();
}

function periodIndex() { return state.liveGame.quarter - 1; }

// ---------------------------------------------------------------- punteggio
// del periodo. È il momento in cui si guarda il tabellone del palazzetto e si
// riporta il dato: una volta ogni dieci minuti, non trenta volte a partita.
function askPeriodScore({ thenAdvance }) {
  const sport = currentSport();
  const conf = sport.scout;
  const g = state.liveGame;
  const idx = periodIndex();
  const existing = (g.periodScores && g.periodScores[idx]) || null;
  const ourFromActions = conf.ourScore === 'fromActions';
  const ourNow = ourFromActions
    ? g.players.reduce((n, p) => n + sport.score(p.stats || {}), 0)
      - (g.periodScores || []).slice(0, idx).reduce((n, x) => n + ((x && x.us) || 0), 0)
    : (existing ? existing.us : 0);

  formModal(`${conf.period.label} ${g.quarter}`, `
    <div class="hint" style="margin-top:0;">${esc(conf.periodPrompt)}</div>
    <div class="row2">
      <div class="field"><label>${esc(state.teamProfile.name)}</label>
        <input type="number" id="psUs" min="0" inputmode="numeric" value="${Math.max(0, ourNow)}" ${ourFromActions ? 'readonly' : ''}>
        ${ourFromActions ? '<div class="hint" style="margin:4px 0 0;">Calcolato dalle azioni assegnate.</div>' : ''}
      </div>
      <div class="field"><label>${esc(g.oppName || 'Avversari')}</label>
        <input type="number" id="psThem" min="0" inputmode="numeric" value="${existing ? existing.them : 0}">
      </div>
    </div>
  `, async () => {
    const us = Math.max(0, parseInt(document.getElementById('psUs').value) || 0);
    const them = Math.max(0, parseInt(document.getElementById('psThem').value) || 0);
    pushUndo();
    if (!g.periodScores) g.periodScores = [];
    while (g.periodScores.length <= idx) g.periodScores.push(null);
    g.periodScores[idx] = { us, them };
    if (thenAdvance) advancePeriod();
    else { recomputeScores(); persistLiveGame(); updateScoreboardOnly(); renderCourtAndBench(); }
  }, { confirmLabel: thenAdvance ? 'Salva e vai avanti' : 'Salva' });
}

function advancePeriod() {
  const conf = sc();
  const g = state.liveGame;
  const isLast = g.quarter >= g.numQuarters;
  const finish = (extra) => {
    if (extra) {
      g.numQuarters += 1;
      if (conf.period.extraMinutes) g.quarterLength = conf.period.extraMinutes * 60;
    }
    g.quarter += 1;
    g.clock = conf.period.direction === 'up' ? 0 : g.quarterLength;
    g.clockRunning = false;
    if (conf.teamFouls) g.quarterFouls[g.quarter] = 0;
    stopClockInterval();
    recomputeScores();
    persistLiveGame();
    renderLiveMatch(document.getElementById('tabContent'));
  };
  if (isLast && conf.period.allowExtra) {
    confirmModal(`Aggiungere un ${conf.period.extraLabel.toLowerCase()}?`,
      `Verrà aggiunto un ${conf.period.label.toLowerCase()} extra${conf.period.extraMinutes ? ' di ' + conf.period.extraMinutes + ' minuti' : ''}.`,
      () => finish(true), 'Aggiungi');
    return;
  }
  if (isLast) { toast('Ultimo ' + conf.period.label.toLowerCase() + ': chiudi la partita quando hai finito'); recomputeScores(); persistLiveGame(); updateScoreboardOnly(); return; }
  finish(false);
}

function onEndGame() {
  const conf = sc();
  const g = state.liveGame;
  const idx = periodIndex();
  const missing = !(g.periodScores && g.periodScores[idx]);
  const close = () => confirmModal('Terminare la partita?', 'La partita verrà salvata nello storico e potrà essere consultata da tutto lo staff.', async () => {
    stopClockInterval();
    recomputeScores();
    const finished = state.liveGame;
    await apiEndGame(finished.id, finished);
    state.history.push({ ...finished, date: new Date().toISOString() });
    state.liveGame = null;
    toast('Partita salvata nello storico');
    const { renderApp } = await import('../../layout.js');
    renderApp();
  }, 'Termina e salva');

  // Chiudere senza il punteggio dell'ultimo periodo lascerebbe il risultato
  // finale sbagliato: si chiede prima, non dopo.
  if (missing) {
    toast(`Manca il punteggio del ${conf.period.label.toLowerCase()} ${g.quarter}`);
    askPeriodScore({ thenAdvance: false });
    return;
  }
  close();
}

function updateScoreboardOnly() {
  if (!document.getElementById('sbUsScore')) return;
  const conf = sc();
  const g = state.liveGame;
  recomputeScores();
  document.getElementById('sbUsScore').textContent = g.teamScore;
  document.getElementById('sbOppScore').textContent = g.oppScore;
  document.getElementById('sbOppLabel').textContent = (g.oppName || 'AVVERSARI').toUpperCase();
  document.getElementById('sbQuarterLabel').textContent = `${conf.period.label} ${g.quarter}`.toUpperCase();

  const clockEl = document.getElementById('sbClock');
  if (clockEl) {
    clockEl.textContent = fmtClock(g.clock);
    const atEnd = conf.period.direction === 'up' ? g.clock >= g.quarterLength : g.clock === 0;
    clockEl.className = 'sb-clock ' + (atEnd ? 'zero' : (g.clockRunning ? 'running' : 'stopped'));
    const toggle = document.getElementById('clockToggleBtn');
    if (toggle) toggle.textContent = g.clockRunning ? '⏸ Pausa' : '▶ Avvia';
  }
  const setLine = document.getElementById('sbSetLine');
  if (setLine) {
    const cur = (g.periodScores || [])[periodIndex()];
    setLine.textContent = cur ? `${cur.us} – ${cur.them}` : 'in corso';
  }

  const foulsEl = document.getElementById('sbFouls');
  if (foulsEl) {
    const fouls = g.quarterFouls[g.quarter] || 0;
    const bonus = conf.teamFoulBonus || 5;
    foulsEl.textContent = 'Falli: ' + fouls + (fouls >= bonus ? ' (BONUS)' : '');
    foulsEl.className = 'sb-fouls' + (fouls >= bonus ? ' bonus' : '');
  }

  // Striscia dei periodi già chiusi: è il controllo che il segnapunti fa a
  // colpo d'occhio per capire se ha saltato un inserimento.
  const strip = document.getElementById('periodStrip');
  if (strip) {
    const total = Math.max(g.numQuarters, g.quarter);
    let html = '';
    for (let i = 0; i < total; i++) {
      const s = (g.periodScores || [])[i];
      const isCurrent = i === periodIndex();
      html += `<button class="period-chip${isCurrent ? ' current' : ''}${s ? ' done' : ''}" data-period="${i}">
        <i>${conf.period.short}${i + 1}</i><b>${s ? s.us + '–' + s.them : '—'}</b></button>`;
    }
    strip.innerHTML = html;
    strip.querySelectorAll('[data-period]').forEach(btn => {
      btn.onclick = () => editPeriodScore(parseInt(btn.dataset.period, 10));
    });
  }
}

// Correggere un periodo già chiuso: capita di sbagliare a digitare, e senza
// questa strada l'unico rimedio sarebbe rifare la partita.
function editPeriodScore(idx) {
  const conf = sc();
  const g = state.liveGame;
  const existing = (g.periodScores || [])[idx] || { us: 0, them: 0 };
  formModal(`Correggi ${conf.period.label.toLowerCase()} ${idx + 1}`, `
    <div class="row2">
      <div class="field"><label>${esc(state.teamProfile.name)}</label><input type="number" id="epUs" min="0" inputmode="numeric" value="${existing.us}"></div>
      <div class="field"><label>${esc(g.oppName || 'Avversari')}</label><input type="number" id="epThem" min="0" inputmode="numeric" value="${existing.them}"></div>
    </div>
    ${conf.ourScore === 'fromActions' ? '<div class="hint">Il nostro punteggio complessivo resta quello calcolato dalle azioni: questo valore serve solo alla striscia dei periodi.</div>' : ''}
  `, async () => {
    pushUndo();
    if (!g.periodScores) g.periodScores = [];
    while (g.periodScores.length <= idx) g.periodScores.push(null);
    g.periodScores[idx] = {
      us: Math.max(0, parseInt(document.getElementById('epUs').value) || 0),
      them: Math.max(0, parseInt(document.getElementById('epThem').value) || 0)
    };
    recomputeScores(); persistLiveGame(); updateScoreboardOnly(); renderCourtAndBench();
  }, { confirmLabel: 'Salva' });
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

function tileValue(p) {
  const sport = currentSport();
  const t = sport.scout.tileStat;
  return (sport.aggregate[t.key] ? sport.aggregate[t.key](p) : 0) + ' ' + t.short;
}

function renderCourtAndBench() {
  const conf = sc();
  const g = state.liveGame;
  const courtRow = document.getElementById('courtRow');
  if (!courtRow) return;
  // Con undici in campo la fila non basta: si passa a griglia che va a capo.
  courtRow.className = 'court-row' + (g.players.filter(p => p.onCourt).length > 6 ? ' wrap' : '');
  courtRow.innerHTML = '';
  g.players.filter(p => p.onCourt).forEach(p => {
    const tile = document.createElement('div');
    const fouled = conf.teamFouls && p.stats.pf >= 5;
    tile.className = 'player-tile' + (state.selectedCourtId === p.id ? ' selected' : '') + (state.pendingBenchId ? ' pending-out' : '');
    tile.innerHTML = `${fouled ? '<div class="foul-badge">' + p.stats.pf + '</div>' : ''}<div class="num">#${esc(p.number)}</div><div class="nm">${esc(p.name)}</div><div class="pts">${tileValue(p)}</div>`;
    tile.onclick = () => onCourtTileClick(p.id);
    courtRow.appendChild(tile);
  });

  const benchList = document.getElementById('benchList');
  benchList.innerHTML = '';
  const bench = g.players.filter(p => !p.onCourt);
  if (bench.length === 0) benchList.innerHTML = '<div class="hint">Nessun giocatore in panchina.</div>';
  bench.forEach(p => {
    const row = document.createElement('div');
    row.className = 'bench-row' + (state.pendingBenchId === p.id ? ' pending-in' : '');
    row.innerHTML = `<div class="num">#${esc(p.number)}</div><div class="nm">${esc(p.name)}</div>`
      + `<div class="mini-stat">${tileValue(p)}${conf.trackSeconds ? ' · ' + fmtMin(p.stats.seconds) : ''}</div>`;
    row.onclick = () => benchRowClick(p.id);
    benchList.appendChild(row);
  });

  updateInstructionBar();
  const live = document.getElementById('ptsLive');
  if (live) live.textContent = g.teamScore + ' ' + currentSport().match.scoreLabel.toUpperCase();
}

function updateInstructionBar() {
  const bar = document.getElementById('instructionBar');
  if (!bar) return;
  if (state.pendingBenchId) {
    const p = state.liveGame.players.find(x => x.id === state.pendingBenchId);
    bar.textContent = `Tocca chi esce per far entrare #${p.number} ${p.name}`;
    bar.classList.add('active-mode');
  } else {
    bar.textContent = 'Tocca un giocatore in campo per assegnargli un\'azione, o uno in panchina per un cambio.';
    bar.classList.remove('active-mode');
  }
}

function onCourtTileClick(playerId) {
  if (state.pendingBenchId) {
    pushUndo();
    const outP = state.liveGame.players.find(p => p.id === playerId);
    const inP = state.liveGame.players.find(p => p.id === state.pendingBenchId);
    outP.onCourt = false; inP.onCourt = true; state.pendingBenchId = null;
    persistLiveGame();
    toast(`#${inP.number} ${inP.name} entra per #${outP.number} ${outP.name}`);
    renderCourtAndBench();
    return;
  }
  state.selectedCourtId = playerId;
  openScoutSheet(playerId);
  renderCourtAndBench();
}

function benchRowClick(playerId) {
  state.pendingBenchId = (state.pendingBenchId === playerId) ? null : playerId;
  renderCourtAndBench();
}

// ------------------------------------------------------------------- pannello
// Si apre ancorato in basso: i comandi finiscono sotto il pollice senza che
// serva scorrere, che è la ragione per cui il vecchio pannello era lento.
// "Blocca" lo tiene aperto per assegnare più azioni allo stesso giocatore.
let sheetLocked = false;

function openScoutSheet(playerId) {
  const conf = sc();
  const p = state.liveGame.players.find(x => x.id === playerId);
  const root = document.getElementById('scoutSheetRoot');
  if (!p || !root) return;

  root.innerHTML = `
    <div class="scout-overlay" id="scoutOverlay">
      <div class="scout-sheet">
        <div class="scout-head">
          <div>
            <b>#${esc(p.number)} ${esc(p.name)}</b>
            <span id="scoutHeadStat">${tileValue(p)}</span>
          </div>
          <button class="scout-lock${sheetLocked ? ' on' : ''}" id="scoutLock">${sheetLocked ? '🔒 Bloccato' : 'Blocca'}</button>
          <button class="scout-close" id="scoutClose" aria-label="Chiudi">✕</button>
        </div>
        <div class="scout-body">
          ${conf.groups.map(gr => `
            <div class="stat-group">
              <div class="stat-group-label">${esc(gr.label)}</div>
              <div class="stat-grid${gr.layout === 'pair' ? ' two' : ''}">
                ${gr.actions.map(a => `<button class="stat-btn ${a.tone}" data-act="${esc(a.act)}">${esc(a.label)}</button>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; state.selectedCourtId = null; renderCourtAndBench(); };
  document.getElementById('scoutOverlay').onclick = (e) => { if (e.target.id === 'scoutOverlay') close(); };
  document.getElementById('scoutClose').onclick = close;
  document.getElementById('scoutLock').onclick = (e) => {
    sheetLocked = !sheetLocked;
    e.currentTarget.classList.toggle('on', sheetLocked);
    e.currentTarget.textContent = sheetLocked ? '🔒 Bloccato' : 'Blocca';
  };

  root.querySelectorAll('[data-act]').forEach(btn => {
    btn.onclick = () => {
      applyStatAction(playerId, btn.dataset.act);
      if (sheetLocked) {
        const cur = state.liveGame.players.find(x => x.id === playerId);
        const head = document.getElementById('scoutHeadStat');
        if (head && cur) head.textContent = tileValue(cur);
        btn.classList.add('just-hit');
        setTimeout(() => btn.classList.remove('just-hit'), 220);
      } else {
        close();
      }
    };
  });
}

function findAction(act) {
  for (const gr of sc().groups) {
    const found = gr.actions.find(a => a.act === act);
    if (found) return found;
  }
  return null;
}

function applyStatAction(playerId, act) {
  const g = state.liveGame;
  const conf = sc();
  const p = g.players.find(x => x.id === playerId);
  const action = findAction(act);
  if (!p || !action) return;

  pushUndo();
  const s = p.stats;
  Object.entries(action.apply || {}).forEach(([key, delta]) => { s[key] = (s[key] || 0) + delta; });
  Object.entries(action.nested || {}).forEach(([bucket, key]) => {
    if (!s[bucket]) s[bucket] = {};
    s[bucket][key] = (s[bucket][key] || 0) + 1;
  });
  if (action.teamFoul && conf.teamFouls) {
    g.quarterFouls[g.quarter] = (g.quarterFouls[g.quarter] || 0) + 1;
  }
  // Il più/meno ha senso solo dove il punteggio nasce dalle azioni.
  if (action.score && conf.ourScore === 'fromActions') {
    g.players.forEach(pl => { if (pl.onCourt) pl.stats.plusMinus = (pl.stats.plusMinus || 0) + action.score; });
  }

  recomputeScores();
  persistLiveGame();
  updateScoreboardOnly();
  renderCourtAndBench();
  if (navigator.vibrate) navigator.vibrate(15);
}

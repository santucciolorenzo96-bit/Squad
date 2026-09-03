import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { formModal, confirmModal, toast, showLoadError } from '../modal.js';
import { upsertStanding, removeStanding, fetchStandings } from '../../api/standings.js';
import { fetchLeagueMatches, saveLeagueMatch, removeLeagueMatch } from '../../api/leagueMatches.js';
import { updateCalendarMatch } from '../../api/calendar.js';
import { computeStandings, latestGiornata } from '../../utils/standingsCalc.js';
import { canEditHome } from '../../utils/permissions.js';
import { currentSport } from '../../utils/sports/index.js';
import { openBoxScoreModal } from './partita/boxscore.js';

// Tre viste sullo stesso campionato: la classifica, i risultati da cui nasce,
// e lo storico delle nostre partite.
const SECTIONS = [
  { key: 'classifica', label: 'Classifica' },
  { key: 'risultati', label: 'Risultati' },
  { key: 'storico', label: 'Storico' }
];

let leagueMatches = [];
let loaded = false;

// Una serie di playoff non assegna punti di classifica: la tabella si calcola
// sulla sola stagione regolare, i playoff si leggono a parte.
function regularOnly(matches) {
  return matches.filter(m => (m.phase || 'regular') === 'regular');
}

export function renderClassificaTab(c) {
  const canEdit = canEditHome(state.currentUser);
  const sport = currentSport();
  const st = sport.standings;
  if (!state.classificaSection) state.classificaSection = 'classifica';

  c.innerHTML = `
    <div class="sector-switcher" id="clsSections" style="margin-bottom:16px;"></div>
    <div id="clsBody"><div class="skeleton skeleton-row" style="height:180px;"></div></div>
  `;

  const sections = document.getElementById('clsSections');
  SECTIONS.forEach(s => {
    const b = document.createElement('button');
    b.className = 'sector-pill' + (state.classificaSection === s.key ? ' active' : '');
    b.textContent = s.label;
    b.onclick = () => { state.classificaSection = s.key; renderClassificaTab(c); };
    sections.appendChild(b);
  });

  loadAndDraw(c, canEdit, sport, st);
}

async function loadAndDraw(c, canEdit, sport, st) {
  const body = document.getElementById('clsBody');
  if (!loaded || leagueMatches._sector !== state.activeSectorId) {
    try {
      leagueMatches = await fetchLeagueMatches(state.activeSectorId, state.activeSeasonId);
      leagueMatches._sector = state.activeSectorId;
      loaded = true;
    } catch (e) {
      // La tabella dei risultati può non esistere ancora: la classifica manuale
      // resta consultabile, non si blocca tutto.
      leagueMatches = [];
      leagueMatches._sector = state.activeSectorId;
      loaded = true;
      if (state.classificaSection === 'risultati') { showLoadError(body, e, 'i risultati del campionato'); return; }
    }
  }
  if (!document.getElementById('clsBody')) return;

  if (state.classificaSection === 'risultati') return drawRisultati(c, canEdit, sport);
  if (state.classificaSection === 'storico') return drawStorico();
  drawClassifica(c, canEdit, sport, st);
}

// ------------------------------------------------------------------ CLASSIFICA
function drawClassifica(c, canEdit, sport, st) {
  const body = document.getElementById('clsBody');
  const played = regularOnly(leagueMatches).filter(m => m.home_score != null);
  const auto = played.length > 0;

  // Finché non c'è nessun risultato la classifica resta quella inserita a mano:
  // chi ha già compilato la sua non se la vede sparire.
  const rows = auto
    ? computeStandings(regularOnly(leagueMatches), sport, state.teamProfile.name, state.standings.map(r => r.team_name))
    : [...state.standings].sort((a, b) => b.points - a.points);

  if (rows.length === 0) {
    body.innerHTML = `<div class="placeholder-card">Nessuna classifica ancora.${canEdit ? ' Inserisci i risultati di giornata: la classifica si calcola da sola.' : ''}</div>
      ${canEdit ? '<button class="btn btn-secondary" id="goRisultati" style="width:100%;margin-top:12px;">Inserisci i risultati</button>' : ''}`;
    const go = document.getElementById('goRisultati');
    if (go) go.onclick = () => { state.classificaSection = 'risultati'; renderClassificaTab(c); };
    return;
  }

  const head = `<th>#</th><th>Squadra</th><th>G</th><th>${st.winLabel}</th>`
    + (st.hasDraws ? `<th>${st.drawLabel}</th>` : '') + `<th>${st.lossLabel}</th>`
    + st.extras.map(e => `<th>${e.short}</th>`).join('') + '<th>PT</th>';

  const bodyRows = rows.map((r, i) => {
    const extras = st.extras.map(e => `<td>${(r.stats && r.stats[e.key]) != null ? r.stats[e.key] : 0}</td>`).join('');
    return `<tr class="${r.is_us ? 'on-court' : ''}"><td>${i + 1}</td>
      <td class="name-cell">${r.is_us ? '<b>' : ''}${esc(r.team_name)}${r.is_us ? '</b>' : ''}</td>
      <td>${r.played}</td><td>${r.wins}</td>${st.hasDraws ? `<td>${r.draws || 0}</td>` : ''}<td>${r.losses}</td>
      ${extras}<td><b>${r.points}</b></td>
      ${(!auto && canEdit) ? `<td><button class="icon-btn" data-edit="${r.id}">✎</button><button class="icon-btn danger" data-rm="${r.id}">✕</button></td>` : ''}</tr>`;
  }).join('');

  body.innerHTML = `
    <div class="boxscore-wrap"><table class="boxscore">
      <thead><tr>${head}${(!auto && canEdit) ? '<th></th>' : ''}</tr></thead>
      <tbody>${bodyRows}</tbody></table></div>
    <div class="hint">${st.pointsHint} ${auto
      ? `Calcolata da ${played.length} risultat${played.length === 1 ? 'o' : 'i'} inseriti. A pari punti conta la differenza fra fatti e subiti, non la classifica avulsa.`
      : 'Inserita a mano. Appena inserisci il primo risultato di giornata si calcola da sola.'}</div>
    ${canEdit ? `<button class="btn btn-secondary" id="goRisultati" style="width:100%;margin-top:12px;">${auto ? 'Aggiorna i risultati' : 'Passa ai risultati di giornata'}</button>` : ''}
    ${(!auto && canEdit) ? '<button class="btn btn-ghost" id="addStandingBtn" style="width:100%;margin-top:8px;">+ Aggiungi squadra</button>' : ''}
  `;

  const go = document.getElementById('goRisultati');
  if (go) go.onclick = () => { state.classificaSection = 'risultati'; renderClassificaTab(c); };
  const addBtn = document.getElementById('addStandingBtn');
  if (addBtn) addBtn.onclick = () => openStandingModal(null, c, sport, st);
  body.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => openStandingModal(state.standings.find(r => r.id === btn.dataset.edit), c, sport, st);
  });
  body.querySelectorAll('[data-rm]').forEach(btn => {
    btn.onclick = () => confirmModal('Rimuovere squadra dalla classifica?', '', async () => {
      await removeStanding(btn.dataset.rm);
      state.standings = state.standings.filter(r => r.id !== btn.dataset.rm);
      renderClassificaTab(c);
    }, 'Rimuovi');
  });
}

// ------------------------------------------------------------------- RISULTATI
function drawRisultati(c, canEdit, sport) {
  const body = document.getElementById('clsBody');
  const ourName = state.teamProfile.name;
  const playoff = leagueMatches.filter(m => m.phase === 'playoff');
  const rounds = {};
  regularOnly(leagueMatches).forEach(m => {
    const k = m.giornata == null ? 'altro' : String(m.giornata);
    if (!rounds[k]) rounds[k] = [];
    rounds[k].push(m);
  });
  const keys = Object.keys(rounds).sort((a, b) => {
    if (a === 'altro') return 1;
    if (b === 'altro') return -1;
    return parseInt(b, 10) - parseInt(a, 10);
  });

  body.innerHTML = `
    ${canEdit ? `<button class="btn btn-primary" id="addResultBtn" style="width:100%;margin-bottom:14px;">+ Inserisci un risultato</button>` : ''}
    ${keys.length === 0
      ? `<div class="placeholder-card">Nessun risultato inserito.<br><br>Inserisci qui i punteggi del turno — anche quelli delle altre squadre — e la classifica si aggiorna da sola.</div>`
      : keys.map(k => `
        <div class="section-label">${k === 'altro' ? 'Senza giornata' : 'Giornata ' + k}</div>
        <div class="card">${rounds[k].map(m => resultRow(m, ourName, canEdit)).join('')}</div>
      `).join('')}
    ${playoff.length ? `
      <div class="section-label" style="margin-top:20px;">Playoff</div>
      <div class="hint" style="margin-top:0;">Non entrano in classifica: la stagione regolare e i playoff sono due cose diverse.</div>
      ${groupPlayoff(playoff).map(g => `
        <div class="section-label">${esc(g.label)}</div>
        <div class="card">${g.matches.map(m => resultRow(m, ourName, canEdit)).join('')}</div>
      `).join('')}` : ''}
  `;

  const add = document.getElementById('addResultBtn');
  if (add) add.onclick = () => openResultModal(null, c, sport);
  body.querySelectorAll('[data-lm-edit]').forEach(btn => {
    btn.onclick = () => openResultModal(leagueMatches.find(m => m.id === btn.dataset.lmEdit), c, sport);
  });
}

// I playoff si raggruppano per turno, non per giornata: "Quarti", "Semifinale",
// "Finale". Chi non mette il nome del turno finisce in un gruppo unico.
function groupPlayoff(matches) {
  const by = {};
  matches.forEach(m => {
    const k = (m.round_label || '').trim() || 'Playoff';
    if (!by[k]) by[k] = [];
    by[k].push(m);
  });
  return Object.entries(by).map(([label, ms]) => ({ label, matches: ms }));
}

function resultRow(m, ourName, canEdit) {
  const ours = [m.home_team, m.away_team].some(n => (n || '').trim().toLowerCase() === ourName.trim().toLowerCase());
  const done = m.home_score != null && m.away_score != null;
  const homeWon = done && m.home_score > m.away_score;
  const awayWon = done && m.away_score > m.home_score;
  return `<div class="result-row${ours ? ' ours' : ''}">
    <div class="rr-team${homeWon ? ' won' : ''}">${esc(m.home_team)}</div>
    <div class="rr-score">${done ? `${m.home_score}<span>–</span>${m.away_score}` : '<i>da giocare</i>'}</div>
    <div class="rr-team away${awayWon ? ' won' : ''}">${esc(m.away_team)}</div>
    ${canEdit ? `<button class="icon-btn" data-lm-edit="${m.id}">✎</button>` : ''}
  </div>`;
}

function openResultModal(existing, c, sport) {
  const teams = [...new Set([
    state.teamProfile.name,
    ...state.standings.map(r => r.team_name),
    ...leagueMatches.flatMap(m => [m.home_team, m.away_team])
  ].filter(Boolean))].sort();

  const m = existing || { giornata: latestGiornata(regularOnly(leagueMatches)) || 1, phase: 'regular', date: '', home_team: '', away_team: '', home_score: '', away_score: '' };

  formModal(existing ? 'Correggi risultato' : 'Risultato di giornata', `
    <div class="row2">
      <div class="field"><label>Fase</label>
        <select id="lmPhase">
          <option value="regular"${(m.phase || 'regular') === 'regular' ? ' selected' : ''}>Stagione regolare</option>
          <option value="playoff"${m.phase === 'playoff' ? ' selected' : ''}>Playoff</option>
        </select>
      </div>
      <div class="field"><label>Data</label><input type="date" id="lmDate" value="${m.date || ''}"></div>
    </div>
    <div class="row2">
      <div class="field"><label>Giornata</label><input type="number" min="1" id="lmGio" value="${m.giornata ?? ''}"></div>
      <div class="field"><label>Turno (playoff)</label><input type="text" id="lmRound" value="${esc(m.round_label || '')}" placeholder="Es. Semifinale"></div>
    </div>
    <div class="field"><label>Squadra in casa</label>
      <input type="text" id="lmHome" list="lmTeams" value="${esc(m.home_team || '')}" placeholder="Nome squadra"></div>
    <div class="field"><label>Squadra in trasferta</label>
      <input type="text" id="lmAway" list="lmTeams" value="${esc(m.away_team || '')}" placeholder="Nome squadra"></div>
    <datalist id="lmTeams">${teams.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <div class="row2">
      <div class="field"><label>${esc(sport.match.scoreLabel)} in casa</label><input type="number" min="0" id="lmHs" inputmode="numeric" value="${m.home_score ?? ''}"></div>
      <div class="field"><label>${esc(sport.match.scoreLabel)} in trasferta</label><input type="number" min="0" id="lmAs" inputmode="numeric" value="${m.away_score ?? ''}"></div>
    </div>
    ${existing ? '<button class="btn btn-ghost" id="lmDelete" style="width:100%;margin-top:4px;">Elimina risultato</button>' : ''}
  `, async () => {
    const home_team = document.getElementById('lmHome').value.trim();
    const away_team = document.getElementById('lmAway').value.trim();
    if (!home_team || !away_team) return 'Inserisci il nome di entrambe le squadre.';
    if (home_team.toLowerCase() === away_team.toLowerCase()) return 'Le due squadre devono essere diverse.';
    const hsRaw = document.getElementById('lmHs').value;
    const asRaw = document.getElementById('lmAs').value;
    const saved = await saveLeagueMatch(state.teamProfile.id, state.activeSectorId, {
      id: existing ? existing.id : null,
      giornata: document.getElementById('lmGio').value ? parseInt(document.getElementById('lmGio').value, 10) : null,
      date: document.getElementById('lmDate').value || null,
      phase: document.getElementById('lmPhase').value,
      round_label: document.getElementById('lmRound').value.trim() || null,
      home_team, away_team,
      home_score: hsRaw === '' ? null : parseInt(hsRaw, 10),
      away_score: asRaw === '' ? null : parseInt(asRaw, 10)
    }, state.activeSeasonId);
    await syncOwnCalendar(saved);
    loaded = false;
    toast('Risultato salvato');
    renderClassificaTab(c);
  }, { confirmLabel: 'Salva' });

  const del = document.getElementById('lmDelete');
  if (del) del.onclick = async () => {
    await removeLeagueMatch(existing.id);
    document.getElementById('modalRoot').innerHTML = '';
    loaded = false;
    toast('Risultato eliminato');
    renderClassificaTab(c);
  };
}

// Se il risultato inserito è il nostro, la partita corrispondente nel calendario
// smette di risultare "da giocare": due schermate che si contraddicono sullo
// stesso evento sono peggio di una sola incompleta.
async function syncOwnCalendar(m) {
  if (m.home_score == null || m.away_score == null) return;
  const ourName = state.teamProfile.name.trim().toLowerCase();
  const isHome = (m.home_team || '').trim().toLowerCase() === ourName;
  const isAway = (m.away_team || '').trim().toLowerCase() === ourName;
  if (!isHome && !isAway) return;

  const opponent = (isHome ? m.away_team : m.home_team).trim().toLowerCase();
  const match = state.calendar.find(x =>
    (m.giornata != null && x.giornata === m.giornata && (x.opponent || '').trim().toLowerCase() === opponent)
    || (m.date && x.date === m.date && (x.opponent || '').trim().toLowerCase() === opponent));
  if (!match) return;

  const team_score = isHome ? m.home_score : m.away_score;
  const opp_score = isHome ? m.away_score : m.home_score;
  try {
    const updated = await updateCalendarMatch(match.id, { played: true, team_score, opp_score });
    Object.assign(match, updated);
  } catch (e) {
    // Il risultato è già salvato: un calendario non allineato non deve far
    // fallire l'inserimento, si dice e basta.
    toast('Risultato salvato, ma il calendario non si è aggiornato.');
  }
}

// -------------------------------------------------------------------- STORICO
function drawStorico() {
  const body = document.getElementById('clsBody');
  if (state.history.length === 0) {
    body.innerHTML = '<div class="placeholder-card">Nessuna partita in archivio.</div>';
    return;
  }
  body.innerHTML = '';
  [...state.history].reverse().forEach(g => {
    const row = document.createElement('div');
    row.className = 'history-row';
    const win = g.teamScore > g.oppScore;
    const draw = g.teamScore === g.oppScore;
    row.innerHTML = `<div class="top"><span>${esc(state.teamProfile.name)} vs ${esc(g.oppName)}</span>
      <span class="history-score" style="color:${draw ? 'var(--amber)' : (win ? 'var(--green)' : 'var(--red)')}">${g.teamScore}–${g.oppScore}</span></div>
      <div class="date">${new Date(g.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>`;
    row.onclick = () => openBoxScoreModal(g);
    body.appendChild(row);
  });
}

// --------------------------------------------------- classifica inserita a mano
function openStandingModal(existing, c, sport, st) {
  formModal(existing ? 'Modifica squadra' : 'Aggiungi squadra', `
    <div class="field"><label>Nome squadra</label><input type="text" id="stTeam" value="${existing ? esc(existing.team_name) : esc(state.teamProfile.name)}"></div>
    <div class="row2">
      <div class="field"><label>Giocate</label><input type="number" id="stPlayed" value="${existing ? existing.played : 0}" min="0"></div>
      <div class="field"><label>Punti</label><input type="number" id="stPoints" value="${existing ? existing.points : 0}" min="0"></div>
    </div>
    <div class="${st.hasDraws ? 'row3' : 'row2'}">
      <div class="field"><label>Vittorie</label><input type="number" id="stWins" value="${existing ? existing.wins : 0}" min="0"></div>
      ${st.hasDraws ? `<div class="field"><label>Pareggi</label><input type="number" id="stDraws" value="${existing ? (existing.draws || 0) : 0}" min="0"></div>` : ''}
      <div class="field"><label>Sconfitte</label><input type="number" id="stLosses" value="${existing ? existing.losses : 0}" min="0"></div>
    </div>
    <div class="field"><label style="display:flex;align-items:center;gap:8px;"><input type="checkbox" id="stIsUs" ${existing && existing.is_us ? 'checked' : ''} style="width:auto;"> È la nostra squadra</label></div>
  `, async () => {
    const team_name = document.getElementById('stTeam').value.trim();
    if (!team_name) return 'Inserisci il nome della squadra.';
    const is_us = document.getElementById('stIsUs').checked;
    const drawsEl = document.getElementById('stDraws');
    const data = {
      team_name, played: parseInt(document.getElementById('stPlayed').value) || 0,
      wins: parseInt(document.getElementById('stWins').value) || 0,
      draws: drawsEl ? (parseInt(drawsEl.value) || 0) : 0,
      losses: parseInt(document.getElementById('stLosses').value) || 0,
      points: parseInt(document.getElementById('stPoints').value) || 0, is_us
    };
    if (is_us) state.standings.forEach(r => { r.is_us = false; });
    if (existing) {
      await upsertStanding(state.teamProfile.id, state.activeSectorId, { id: existing.id, ...data }, state.activeSeasonId);
      Object.assign(existing, data);
    } else {
      await upsertStanding(state.teamProfile.id, state.activeSectorId, data, state.activeSeasonId);
      state.standings = await fetchStandings(state.activeSectorId, state.activeSeasonId);
    }
    toast('Classifica aggiornata');
    renderClassificaTab(c);
  }, { confirmLabel: 'Salva' });
}

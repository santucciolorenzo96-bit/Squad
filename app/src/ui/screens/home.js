import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { canEditHome } from '../../utils/permissions.js';
import { teamInitials } from '../../utils/theme.js';
import {
  standingsPosition, computeRecord, computeStreak, computeTeamPPG,
  computeSeasonStats, computeLastGameMVP, daysUntil
} from '../../utils/stats.js';
import { formModal } from '../modal.js';
import { saveNextMatch, clearNextMatch } from '../../api/nextMatch.js';
import { openMatchDetail } from '../matchDetail.js';
import { animateCount } from '../../utils/anim.js';

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

// Rende un pannello navigabile: click, tastiera (Invio/Spazio) e semantica
// da pulsante, così non resta un <div> raggiungibile solo col mouse.
function makePanelLink(el, onActivate) {
  if (!el) return;
  el.classList.add('panel-link');
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.onclick = onActivate;
  el.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
  };
}

async function goToTab(tab) {
  state.currentTab = tab;
  const { renderApp } = await import('../layout.js');
  renderApp();
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 6) return 'Buonanotte';
  if (h < 13) return 'Buongiorno';
  if (h < 18) return 'Buon pomeriggio';
  return 'Buonasera';
}

export function renderHomeTab(c) {
  const lastGame = state.history.length ? state.history[state.history.length - 1] : null;
  const ourPos = standingsPosition(state.standings, state.teamProfile.name);
  const record = computeRecord(state.history);
  const streak = computeStreak(state.history);
  const ppg = computeTeamPPG(state.history);
  const seasonScorer = [...computeSeasonStats(state.history)].sort((a, b) => b.pts - a.pts)[0] || null;
  const mvp = computeLastGameMVP(lastGame);
  const fromCalendar = state.calendar.length > 0;
  const nextMatch = fromCalendar
    ? [...state.calendar].filter(m => !m.played).sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))[0] || null
    : state.nextMatch;
  const oppPos = nextMatch ? standingsPosition(state.standings, nextMatch.opponent) : null;
  const days = nextMatch ? daysUntil(nextMatch.date) : null;
  const canEdit = canEditHome(state.currentUser);
  const hasFinance = !!state.currentUser.finance_role;
  const today = new Date().toISOString().slice(0, 10);
  const nextTraining = [...state.trainings].filter(t => t.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];
  const financeTotal = hasFinance ? state.financeAccounts.reduce((sum, a) => sum + (state.financeAccountBalances[a.id] ?? 0), 0) : 0;
  let countdownTxt = '—';
  if (days != null) { countdownTxt = days === 0 ? 'Oggi' : (days === 1 ? 'Domani' : (days > 1 ? `Tra ${days} giorni` : 'Giocata')); }
  const firstName = (state.currentUser.display_name || '').trim().split(/\s+/)[0] || '';
  const todayLabel = new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });

  c.innerHTML = `
    <div class="greeting-line">
      <div class="hello">${greetingWord()}${firstName ? ', ' + esc(firstName) : ''}</div>
      <div class="date">${todayLabel}</div>
    </div>

    <div class="home-grid">
      <div class="home-main">
        <div class="xl-card" id="homeNextMatchCard">
          <div class="xl-card-label"><span>Prossima partita</span>${fromCalendar ? '<span class="hint" style="margin:0;">Dal calendario</span>' : (canEdit ? '<button class="icon-btn" id="editNextMatchBtn" style="color:var(--gold);">✎</button>' : '')}</div>
          ${nextMatch ? `
            <div class="match-row">
              <div class="match-side">
                <div class="match-avatar${state.teamProfile.logo_url ? ' has-logo' : ''}">${state.teamProfile.logo_url ? `<img src="${esc(state.teamProfile.logo_url)}">` : esc(teamInitials(state.teamProfile.name))}</div>
                <div class="match-team-nm">${esc(state.teamProfile.name)}</div>
                <div class="match-pos-tag">${ourPos ? ourPos + '°' : '—'}</div>
              </div>
              <div class="match-mid">
                <div class="match-time">${nextMatch.time || '—'}</div>
                <div class="match-meta">${nextMatch.date ? new Date(nextMatch.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Data da definire'}${nextMatch.location ? '<br>' + esc(nextMatch.location) : ''}</div>
                <div class="match-countdown">${nextMatch.home ? '🏠 Casa' : '🚌 Trasferta'} · ${countdownTxt}</div>
              </div>
              <div class="match-side">
                <div class="match-avatar">${teamInitials(nextMatch.opponent)}</div>
                <div class="match-team-nm">${esc(nextMatch.opponent)}</div>
                <div class="match-pos-tag">${oppPos ? oppPos + '°' : '—'}</div>
              </div>
            </div>
          ` : `<div class="hint" style="text-align:center;padding:14px 0;">${fromCalendar ? 'Nessuna partita in programma nel calendario.' : `Nessuna prossima partita impostata.${canEdit ? '<br><button class="btn btn-secondary" id="setNextMatchBtn" style="margin-top:10px;">+ Imposta</button>' : ''}`}</div>`}
        </div>

        <div class="xl-card" id="homeMvpCard">
          <div class="xl-card-label"><span>Miglior giocatore ultima partita</span></div>
          ${mvp ? `
            <div class="mvp-card">
              <div class="mvp-avatar">#${esc(mvp.number)}</div>
              <div class="mvp-info">
                <div class="nm">${esc(mvp.name)}</div>
                <div class="line">${mvp.pts} pt · ${mvp.stats.orb + mvp.stats.drb} reb · ${mvp.stats.ast} ast vs ${esc(lastGame.oppName)}</div>
              </div>
              <div class="mvp-index"><div class="val">${mvp.ind}</div><div class="lbl">Valutazione</div></div>
            </div>
          ` : `<div class="hint">Disponibile dopo la prima partita registrata.</div>`}
        </div>

        <div class="stat-row">
          <div class="mini-card" id="homeRecordCard">
            <div class="lbl">Andamento stagione</div>
            <div class="val">${state.history.length ? `${record.w}V - ${record.l}S` : '—'}</div>
            <div class="sub">${state.history.length ? streak : 'Nessuna partita giocata'}</div>
          </div>
          <div class="mini-card" id="homePpgCard">
            <div class="lbl">Media punti</div>
            <div class="val" data-count="${ppg != null ? ppg.toFixed(1) : ''}">${ppg != null ? ppg.toFixed(1) : '—'}</div>
            <div class="sub">${state.history.length ? `su ${state.history.length} partite` : 'Nessun dato'}</div>
          </div>
          <div class="mini-card" id="homeScorerCard">
            <div class="lbl">Miglior marcatore</div>
            <div class="val small">${seasonScorer ? `#${esc(seasonScorer.number)} ${esc(seasonScorer.name)}` : '—'}</div>
            <div class="sub">${seasonScorer ? `${(seasonScorer.pts / seasonScorer.games).toFixed(1)} pt/partita` : 'Nessun dato'}</div>
          </div>
        </div>

        ${canEdit ? `
        <div class="section-label" style="margin-top:6px;">Amministrazione</div>
        <div class="stat-row">
          <div class="mini-card" id="homeDocsCard">
            <div class="lbl">Certificati da approvare</div>
            <div class="val small" style="color:${state.pendingDocsCount > 0 ? 'var(--amber)' : 'var(--text)'};">${state.pendingDocsCount}</div>
            <div class="sub">${state.pendingDocsCount > 0 ? 'In Anagrafica' : 'Tutto in regola'}</div>
          </div>
          ${hasFinance ? `
          <div class="mini-card" id="homeFinanceCard">
            <div class="lbl">Finanza · saldo conti</div>
            <div class="val small">${fmtMoney(financeTotal)}</div>
            <div class="sub">${state.financeAccounts.length} cont${state.financeAccounts.length === 1 ? 'o' : 'i'}</div>
          </div>` : ''}
        </div>` : ''}
      </div>

      <div class="home-side">
        <div class="mini-card" id="homeTrainingCard">
          <div class="lbl">Prossimo allenamento</div>
          <div class="val small">${nextTraining ? new Date(nextTraining.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' }) : '—'}</div>
          <div class="sub">${nextTraining ? (nextTraining.start_time ? nextTraining.start_time + (nextTraining.end_time ? '–' + nextTraining.end_time : '') + ' · ' : '') + esc(nextTraining.title) : 'Nessuno in programma'}</div>
          ${nextTraining && nextTraining.location ? `<div class="sub" style="font-size:12.5px;font-weight:600;color:var(--text);margin-top:3px;">📍 ${esc(nextTraining.location)}</div>` : ''}
        </div>
        <div class="mini-card" id="homeStandingsCard">
          <div class="lbl">Posizione in classifica</div>
          <div class="val small">${ourPos ? `${ourPos}°` : (canEdit ? 'Imposta →' : '—')}</div>
          <div class="sub">${ourPos ? esc(state.teamProfile.name) : 'Classifica non ancora impostata'}</div>
        </div>
      </div>
    </div>
  `;

  const editBtn = document.getElementById('editNextMatchBtn') || document.getElementById('setNextMatchBtn');
  if (editBtn) editBtn.onclick = (e) => { e.stopPropagation(); openNextMatchModal(); };

  // Ogni pannello porta a un approfondimento coerente con ciò che mostra.
  if (nextMatch) makePanelLink(document.getElementById('homeNextMatchCard'), () => openMatchDetail(nextMatch));
  if (mvp) makePanelLink(document.getElementById('homeMvpCard'), () => goToTab('statistiche'));
  if (state.history.length) {
    makePanelLink(document.getElementById('homeRecordCard'), () => goToTab('classifica'));
    makePanelLink(document.getElementById('homePpgCard'), () => goToTab('statistiche'));
  }
  if (seasonScorer) makePanelLink(document.getElementById('homeScorerCard'), () => goToTab('statistiche'));
  makePanelLink(document.getElementById('homeTrainingCard'), () => goToTab('allenamenti'));
  makePanelLink(document.getElementById('homeStandingsCard'), () => goToTab('classifica'));
  if (canEdit) makePanelLink(document.getElementById('homeDocsCard'), () => goToTab('anagrafica'));
  if (hasFinance) makePanelLink(document.getElementById('homeFinanceCard'), () => goToTab('finanza'));

  // I numeri salgono fino al valore invece di comparire di colpo.
  const ppgEl = c.querySelector('#homePpgCard .val[data-count]');
  if (ppgEl && ppgEl.dataset.count) animateCount(ppgEl, parseFloat(ppgEl.dataset.count), { format: v => v.toFixed(1) });
  if (hasFinance) {
    const finEl = c.querySelector('#homeFinanceCard .val');
    if (finEl) animateCount(finEl, financeTotal, { format: v => fmtMoney(v) });
  }
}

function openNextMatchModal() {
  const nm = state.nextMatch || { opponent: '', date: '', time: '', location: '', home: true };
  formModal('Prossima partita', `
    <div class="field"><label>Avversario</label><input type="text" id="nmOpp" value="${esc(nm.opponent)}"></div>
    <div class="row2">
      <div class="field"><label>Data</label><input type="text" id="nmDate" placeholder="AAAA-MM-GG" value="${esc(nm.date)}"></div>
      <div class="field"><label>Ora</label><input type="text" id="nmTime" placeholder="18:30" value="${esc(nm.time)}"></div>
    </div>
    <div class="field"><label>Luogo</label><input type="text" id="nmLoc" value="${esc(nm.location || '')}"></div>
    <div class="field"><label>Casa o trasferta</label>
      <select id="nmHome"><option value="1" ${nm.home ? 'selected' : ''}>Casa</option><option value="0" ${!nm.home ? 'selected' : ''}>Trasferta</option></select>
    </div>
    ${state.nextMatch ? '<button class="btn btn-ghost" id="nmClear" style="width:100%;margin-top:4px;">Rimuovi prossima partita</button>' : ''}
  `, async () => {
    const opponent = document.getElementById('nmOpp').value.trim();
    if (!opponent) return "Inserisci l'avversario.";
    state.nextMatch = {
      opponent,
      date: document.getElementById('nmDate').value.trim(),
      time: document.getElementById('nmTime').value.trim(),
      location: document.getElementById('nmLoc').value.trim(),
      home: document.getElementById('nmHome').value === '1'
    };
    await saveNextMatch(state.teamProfile.id, state.activeSectorId, state.nextMatch);
    const { renderApp } = await import('../layout.js');
    renderApp();
  });
  const clearBtn = document.getElementById('nmClear');
  if (clearBtn) clearBtn.onclick = async () => {
    await clearNextMatch(state.activeSectorId);
    state.nextMatch = null;
    document.getElementById('modalRoot').innerHTML = '';
    const { renderApp } = await import('../layout.js');
    renderApp();
  };
}

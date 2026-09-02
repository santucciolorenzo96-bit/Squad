import { state } from '../state.js';
import { esc } from '../utils/format.js';
import { teamInitials } from '../utils/theme.js';
import { standingsPosition, daysUntil } from '../utils/stats.js';
import { openBoxScoreModal } from './screens/partita/boxscore.js';
import { venueIcon, venueLabel } from './icons.js';
import { currentSport } from '../utils/sports/index.js';

function fmtLongDate(d) {
  if (!d) return 'Data da definire';
  return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtShortDate(d) {
  if (!d) return '—';
  return new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function countdownLabel(match) {
  const days = match.date ? daysUntil(match.date) : null;
  if (days == null) return null;
  if (days === 0) return 'Oggi';
  if (days === 1) return 'Domani';
  return days > 1 ? `Tra ${days} giorni` : 'Giocata';
}

function standingRow(teamName) {
  if (!teamName) return null;
  return state.standings.find(r => r.team_name.trim().toLowerCase() === teamName.trim().toLowerCase()) || null;
}

// Loghi: quello della società solo per la propria squadra (mai il logo SQUAD),
// iniziali come fallback e per l'avversaria, di cui non abbiamo un logo.
function teamBadge(name, { own }) {
  if (own && state.teamProfile.logo_url) {
    return `<div class="md-badge has-logo"><img src="${esc(state.teamProfile.logo_url)}" alt=""></div>`;
  }
  return `<div class="md-badge">${esc(teamInitials(name))}</div>`;
}

export function openMatchDetail(match) {
  const st = currentSport().standings;
  const root = document.getElementById('modalRoot');
  const usName = state.teamProfile.name;
  const oppName = match.opponent;
  const usRow = standingRow(usName);
  const oppRow = standingRow(oppName);
  const usPos = standingsPosition(state.standings, usName);
  const oppPos = standingsPosition(state.standings, oppName);
  const countdown = countdownLabel(match);

  const previous = state.history
    .filter(g => (g.oppName || '').trim().toLowerCase() === (oppName || '').trim().toLowerCase())
    .slice()
    .reverse();

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = [...state.calendar]
    .filter(m => !m.played && m.id !== match.id && (!m.date || m.date >= today))
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
    .slice(0, 4);

  const compareRow = (label, a, b) => `
    <tr><td class="md-cmp-a">${a}</td><td class="md-cmp-l">${label}</td><td class="md-cmp-b">${b}</td></tr>`;

  root.innerHTML = `
    <div class="modal-overlay" id="mdOverlay">
      <div class="modal-box wide" role="dialog" aria-label="Dettaglio partita">
        <div class="md-head">
          <div class="md-team">
            ${teamBadge(usName, { own: true })}
            <div class="md-team-nm">${esc(usName)}</div>
            <div class="md-team-pos">${usPos ? usPos + '° in classifica' : '—'}</div>
          </div>
          <div class="md-vs">
            <div class="md-vs-lbl">VS</div>
            ${countdown ? `<div class="match-countdown">${countdown}</div>` : ''}
          </div>
          <div class="md-team">
            ${teamBadge(oppName, { own: false })}
            <div class="md-team-nm">${esc(oppName)}</div>
            <div class="md-team-pos">${oppPos ? oppPos + '° in classifica' : '—'}</div>
          </div>
        </div>

        <div class="md-when">
          <div class="md-when-date">${fmtLongDate(match.date)}${match.time ? ' · ' + esc(match.time) : ''}</div>
          <div class="hint" style="margin-top:4px;">${venueLabel(match.home !== false)}${match.location ? ' · ' + esc(match.location) : ''}${match.giornata ? ' · Giornata ' + esc(String(match.giornata)) : ''}</div>
        </div>

        ${usRow || oppRow ? `
        <div class="section-label">Confronto in classifica</div>
        <table class="md-compare">
          ${compareRow('Punti', usRow ? `<b>${usRow.points}</b>` : '—', oppRow ? `<b>${oppRow.points}</b>` : '—')}
          ${compareRow('Giocate', usRow ? usRow.played : '—', oppRow ? oppRow.played : '—')}
          ${compareRow('Vittorie', usRow ? usRow.wins : '—', oppRow ? oppRow.wins : '—')}
          ${st.hasDraws ? compareRow('Pareggi', usRow ? (usRow.draws || 0) : '—', oppRow ? (oppRow.draws || 0) : '—') : ''}
          ${compareRow('Sconfitte', usRow ? usRow.losses : '—', oppRow ? oppRow.losses : '—')}
        </table>
        ` : '<div class="hint">Classifica non ancora inserita: nessun confronto disponibile.</div>'}

        <div class="section-label">Precedenti${previous.length ? ` (${previous.length})` : ''}</div>
        ${previous.length ? `<div id="mdPrev"></div>` : `<div class="hint">Nessun precedente registrato contro ${esc(oppName)}.</div>`}

        <div class="section-label">Prossime partite</div>
        ${upcoming.length ? `<div id="mdNext"></div>` : '<div class="hint">Nessun altro impegno in calendario.</div>'}

        <div class="modal-actions">
          <button class="btn btn-secondary" id="mdCalendar" style="flex:1;">Vedi calendario completo</button>
          <button class="btn btn-ghost" id="mdClose" style="flex:1;">Chiudi</button>
        </div>
      </div>
    </div>`;

  const close = () => { root.innerHTML = ''; };
  document.getElementById('mdOverlay').onclick = (e) => { if (e.target.id === 'mdOverlay') close(); };
  document.getElementById('mdClose').onclick = close;
  document.getElementById('mdCalendar').onclick = async () => {
    close();
    state.currentTab = 'calendario';
    const { renderApp } = await import('./layout.js');
    renderApp();
  };

  const prevHolder = document.getElementById('mdPrev');
  if (prevHolder) {
    previous.forEach(g => {
      const win = g.teamScore > g.oppScore;
      const row = document.createElement('div');
      row.className = 'history-row';
      row.innerHTML = `<div class="top"><span>${esc(usName)} vs ${esc(g.oppName)}</span><span class="history-score" style="color:${win ? 'var(--green)' : 'var(--red)'}">${g.teamScore}–${g.oppScore}</span></div>
        <div class="date">${new Date(g.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}</div>`;
      row.onclick = () => openBoxScoreModal(g);
      prevHolder.appendChild(row);
    });
  }

  const nextHolder = document.getElementById('mdNext');
  if (nextHolder) {
    upcoming.forEach(m => {
      const row = document.createElement('div');
      row.className = 'list-row';
      row.innerHTML = `<div class="main"><div class="nm">${venueIcon(m.home !== false)} ${esc(m.opponent)}</div><div class="sub">${fmtShortDate(m.date)}${m.time ? ' · ' + esc(m.time) : ''}${m.location ? ' · ' + esc(m.location) : ''}</div></div>`;
      nextHolder.appendChild(row);
    });
  }
}

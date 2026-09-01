import { state } from '../state.js';
import { esc } from '../utils/format.js';
import { toast, withButtonLoading } from './modal.js';
import { computeGameIndex, playerPtsOf } from '../utils/stats.js';
import { canEditHome } from '../utils/permissions.js';
import { fetchAttendanceForTrainings } from '../api/attendance.js';
import { fetchDevelopment, saveDevelopment } from '../api/development.js';

// Scheda evolutiva dell'atleta.
//
// È uno strumento TECNICO SPORTIVO: costanza agli allenamenti, resa in partita
// e l'obiettivo su cui si sta lavorando. Volutamente non contiene nulla di
// medico o sanitario — né infortuni, né idoneità, né valutazioni cliniche.
//
// Tutto quello che si vede qui è calcolato nel browser dai dati già presenti:
// presenze registrate in Allenamenti e tabellini delle partite giocate.

const RECENT_GAMES = 8;

function initials(name) {
  return (name || '?').split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function todayISO() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function pctColor(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

// Le partite del giocatore in questo settore, dalla più recente. I tabellini
// sono salvati per nome: è la stessa chiave usata dalle statistiche stagionali.
function playerGames(playerName) {
  return state.history
    .map(g => {
      const row = (g.players || []).find(p => p.name === playerName);
      if (!row) return null;
      return {
        date: g.date,
        opponent: g.oppName,
        won: g.teamScore > g.oppScore,
        index: computeGameIndex(row),
        pts: playerPtsOf(row),
        reb: (row.stats.orb || 0) + (row.stats.drb || 0),
        ast: row.stats.ast || 0,
        stl: row.stats.stl || 0,
        tov: row.stats.tov || 0,
        seconds: row.stats.seconds || 0
      };
    })
    .filter(Boolean)
    .reverse();
}

function avg(rows, key) {
  if (rows.length === 0) return null;
  return rows.reduce((s, r) => s + r[key], 0) / rows.length;
}

export function openPlayerDevelopment(playerId, opts = {}) {
  const p = (state.roster.find(x => x.id === playerId)) || opts.player;
  if (!p) return;
  const canEdit = opts.readOnly ? false : canEditHome(state.currentUser);

  const root = document.getElementById('modalRoot');
  root.innerHTML = `
    <div class="modal-overlay" id="devOverlay"><div class="modal-box wide">
      <div class="dev-head">
        <div class="dev-avatar">${esc(initials(p.name))}</div>
        <div>
          <h3 style="margin:0;">${esc(p.name)}</h3>
          <div class="hint" style="margin:2px 0 0;">#${esc(p.number)}${p.role_position ? ' · ' + esc(p.role_position) : ''}${p.height_cm ? ' · ' + p.height_cm + ' cm' : ''}</div>
        </div>
      </div>
      <div class="section-label" style="margin-top:14px;">Scheda evolutiva</div>
      <div id="devBody">
        <div class="skeleton skeleton-row" style="height:82px;"></div>
        <div class="skeleton skeleton-row" style="height:140px;"></div>
      </div>
      <div class="modal-actions"><button class="btn btn-secondary" id="devClose" style="width:100%;">Chiudi</button></div>
    </div></div>`;
  document.getElementById('devOverlay').onclick = (e) => { if (e.target.id === 'devOverlay') root.innerHTML = ''; };
  document.getElementById('devClose').onclick = () => { root.innerHTML = ''; };

  loadBody(p, canEdit);
}

async function loadBody(p, canEdit) {
  const today = todayISO();
  const done = state.trainings.filter(t => t.date && t.date <= today);

  let attendance = [], dev = null;
  try {
    [attendance, dev] = await Promise.all([
      fetchAttendanceForTrainings(done.map(t => t.id)),
      fetchDevelopment(p.id)
    ]);
  } catch (e) {
    const holder = document.getElementById('devBody');
    if (holder) holder.innerHTML = '<div class="placeholder-card">Impossibile caricare la scheda al momento.</div>';
    return;
  }
  const body = document.getElementById('devBody');
  if (!body) return; // scheda chiusa durante il caricamento

  const mine = attendance.filter(a => a.player_id === p.id);
  const present = mine.filter(a => a.status === 'present').length;
  const excused = mine.filter(a => a.status === 'excused').length;
  const absent = mine.filter(a => a.status === 'absent').length;
  const attPct = mine.length ? Math.round((present / mine.length) * 100) : null;

  const games = playerGames(p.name);
  const recent = games.slice(0, RECENT_GAMES);
  const avgIndex = avg(games, 'index');
  const avgMin = avg(games, 'seconds');
  const maxIndex = Math.max(1, ...recent.map(g => Math.abs(g.index)));

  // Confronto fra le ultime partite e quelle precedenti: dice se sta salendo
  // o scendendo, che è l'informazione che serve davvero all'allenatore.
  let trendTxt = 'Servono più partite per un confronto.';
  if (games.length >= 4) {
    const half = Math.min(3, Math.floor(games.length / 2));
    const last = avg(games.slice(0, half), 'index');
    const before = avg(games.slice(half), 'index');
    const delta = last - before;
    trendTxt = Math.abs(delta) < 0.8
      ? 'Rendimento stabile rispetto alle partite precedenti.'
      : (delta > 0
        ? `In crescita: +${delta.toFixed(1)} di valutazione sulle ultime ${half} partite.`
        : `In calo: ${delta.toFixed(1)} di valutazione sulle ultime ${half} partite.`);
  }

  body.innerHTML = `
    <div class="stat-row">
      <div class="mini-card">
        <div class="lbl">Presenza allenamenti</div>
        <div class="val" style="color:${attPct != null ? pctColor(attPct) : 'var(--text)'};">${attPct != null ? attPct + '%' : '—'}</div>
        <div class="sub">${mine.length ? `${present} presenze · ${absent} assenze · ${excused} giustificate` : 'Nessuna rilevazione'}</div>
      </div>
      <div class="mini-card">
        <div class="lbl">Valutazione media</div>
        <div class="val">${avgIndex != null ? avgIndex.toFixed(1) : '—'}</div>
        <div class="sub">${games.length ? `su ${games.length} partite giocate` : 'Nessuna partita giocata'}</div>
      </div>
      <div class="mini-card">
        <div class="lbl">Minuti medi</div>
        <div class="val">${avgMin != null ? Math.round(avgMin / 60) + "'" : '—'}</div>
        <div class="sub">${games.length ? `${avg(games, 'pts').toFixed(1)} pt · ${avg(games, 'reb').toFixed(1)} rmb · ${avg(games, 'ast').toFixed(1)} ast` : 'Nessun dato'}</div>
      </div>
    </div>

    <div class="section-label">Andamento in partita</div>
    ${recent.length ? `<div class="card">
      <div class="hint" style="margin:0 0 10px;">${esc(trendTxt)}</div>
      ${recent.map(g => `
        <div class="trend-row">
          <div class="trend-lbl">${esc(g.opponent)}<span class="hint" style="display:block;margin:0;">${g.date ? new Date(g.date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }) : ''} · ${g.pts} pt${g.won ? ' · V' : ' · S'}</span></div>
          <div class="trend-bar"><span style="width:${Math.round((Math.max(0, g.index) / maxIndex) * 100)}%;background:${g.index >= 0 ? 'var(--orange)' : 'var(--red)'};"></span></div>
          <div class="trend-val">${g.index}</div>
        </div>`).join('')}
    </div>` : '<div class="placeholder-card">Nessuna partita giocata in questo settore.</div>'}

    <div class="section-label">Prossimo obiettivo</div>
    <div class="card" id="devObjectiveCard">
      ${canEdit ? `
        <div class="field"><label>Su cosa sta lavorando</label>
          <input type="text" id="devObjective" maxlength="140" placeholder="Es. tiro in sospensione dal palleggio" value="${esc(dev && dev.objective ? dev.objective : '')}">
        </div>
        <div class="field" style="margin-bottom:0;"><label>Nota dell'allenatore</label>
          <textarea id="devNote" rows="3" maxlength="600" placeholder="Come sta andando, cosa serve nelle prossime settimane">${esc(dev && dev.coach_note ? dev.coach_note : '')}</textarea>
        </div>
        <button class="btn btn-primary" id="devSave" style="width:100%;margin-top:12px;">Salva scheda</button>
      ` : `
        <div class="dev-read"><span>Obiettivo</span><b>${dev && dev.objective ? esc(dev.objective) : 'Non ancora impostato'}</b></div>
        <div class="dev-read"><span>Nota dell'allenatore</span><b>${dev && dev.coach_note ? esc(dev.coach_note) : 'Nessuna nota'}</b></div>
      `}
      ${dev && dev.objective_set_at ? `<div class="hint">Obiettivo fissato il ${new Date(dev.objective_set_at + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}.</div>` : ''}
    </div>

    <div class="hint">Scheda tecnico-sportiva: presenze agli allenamenti e resa in partita. Non contiene valutazioni mediche o sanitarie.</div>
  `;

  const saveBtn = document.getElementById('devSave');
  if (saveBtn) {
    const originalObjective = (dev && dev.objective) || '';
    saveBtn.onclick = () => withButtonLoading(saveBtn, async () => {
      const objective = document.getElementById('devObjective').value.trim();
      const note = document.getElementById('devNote').value.trim();
      try {
        await saveDevelopment(state.teamProfile.id, p.id, {
          objective, coach_note: note,
          objective_changed: objective !== originalObjective,
          updated_by: state.currentUser.id
        });
        toast('Scheda aggiornata.');
        loadBody(p, canEdit);
      } catch (e) {
        toast('Salvataggio non riuscito: ' + (e.message || 'errore imprevisto'));
      }
    });
  }
}

import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { fetchAttendanceForTrainings } from '../../api/attendance.js';

const PERIODS = [
  { key: 'week', label: 'Settimana' },
  { key: 'month', label: 'Mese' },
  { key: 'season', label: 'Stagione' }
];

const STATUS_LABELS = { present: 'Presente', absent: 'Assente', excused: 'Giustificato' };

function iso(d) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

// Lunedì della settimana che contiene `d` (in Italia la settimana inizia di lunedì).
function startOfWeek(d) {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodStart(key) {
  const now = new Date();
  if (key === 'week') return iso(startOfWeek(now));
  if (key === 'month') return iso(new Date(now.getFullYear(), now.getMonth(), 1));
  return null; // stagione: tutto lo storico disponibile
}

function pctClass(pct) {
  if (pct >= 80) return 'var(--green)';
  if (pct >= 60) return 'var(--amber)';
  return 'var(--red)';
}

export async function renderPresenzeTab(c) {
  if (!state.presenzePeriod) state.presenzePeriod = 'month';

  c.innerHTML = `
    <div class="section-label">Presenze agli allenamenti</div>
    <div class="sector-switcher presenze-periods" id="presPeriods" style="margin-bottom:16px;"></div>
    <div id="presBody">
      <div class="stat-row" style="margin-bottom:14px;">
        <div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div><div class="skeleton skeleton-row"></div>
      </div>
      <div class="skeleton skeleton-row" style="height:180px;"></div>
    </div>
  `;

  const periodsEl = document.getElementById('presPeriods');
  PERIODS.forEach(p => {
    const b = document.createElement('button');
    b.className = 'sector-pill' + (state.presenzePeriod === p.key ? ' active' : '');
    b.textContent = p.label;
    b.onclick = () => {
      if (state.presenzePeriod === p.key) return;
      state.presenzePeriod = p.key;
      renderPresenzeTab(c);
    };
    periodsEl.appendChild(b);
  });

  // Solo allenamenti già svolti: quelli futuri non hanno ancora presenze.
  const today = iso(new Date());
  const done = state.trainings.filter(t => t.date && t.date <= today);

  let attendance;
  try {
    attendance = await fetchAttendanceForTrainings(done.map(t => t.id));
  } catch (e) {
    document.getElementById('presBody').innerHTML =
      '<div class="placeholder-card">Impossibile caricare le presenze al momento.</div>';
    return;
  }

  const body = document.getElementById('presBody');
  if (!body) return; // tab cambiata durante il caricamento

  const from = periodStart(state.presenzePeriod);
  const inPeriod = from ? done.filter(t => t.date >= from) : done;
  const periodIds = new Set(inPeriod.map(t => t.id));
  const periodAtt = attendance.filter(a => periodIds.has(a.training_id));

  if (inPeriod.length === 0) {
    body.innerHTML = `<div class="placeholder-card">Nessun allenamento svolto in questo periodo.</div>`;
    return;
  }

  // Statistiche per giocatore sulla rosa attuale del settore.
  const byPlayer = {};
  state.roster.forEach(p => { byPlayer[p.id] = { player: p, present: 0, absent: 0, excused: 0, tracked: 0 }; });
  periodAtt.forEach(a => {
    const row = byPlayer[a.player_id];
    if (!row) return; // giocatore non più in rosa in questo settore
    if (a.status === 'present') row.present++;
    else if (a.status === 'absent') row.absent++;
    else if (a.status === 'excused') row.excused++;
    row.tracked++;
  });

  const rows = Object.values(byPlayer)
    .map(r => ({ ...r, pct: r.tracked ? Math.round((r.present / r.tracked) * 100) : null }))
    .sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));

  const totalPresent = rows.reduce((s, r) => s + r.present, 0);
  const totalTracked = rows.reduce((s, r) => s + r.tracked, 0);
  const avgPct = totalTracked ? Math.round((totalPresent / totalTracked) * 100) : null;
  const best = rows.find(r => r.pct != null) || null;

  // Andamento: per settimana nelle viste brevi, per mese sulla stagione.
  const buckets = {};
  inPeriod.forEach(t => {
    const key = state.presenzePeriod === 'season'
      ? t.date.slice(0, 7)
      : iso(startOfWeek(new Date(t.date + 'T00:00:00')));
    if (!buckets[key]) buckets[key] = { present: 0, tracked: 0, sessions: 0 };
    buckets[key].sessions++;
  });
  periodAtt.forEach(a => {
    const t = inPeriod.find(x => x.id === a.training_id);
    if (!t || !byPlayer[a.player_id]) return;
    const key = state.presenzePeriod === 'season'
      ? t.date.slice(0, 7)
      : iso(startOfWeek(new Date(t.date + 'T00:00:00')));
    buckets[key].tracked++;
    if (a.status === 'present') buckets[key].present++;
  });
  const trend = Object.entries(buckets)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .slice(0, 8)
    .map(([key, v]) => ({
      key,
      label: state.presenzePeriod === 'season'
        ? new Date(key + '-01T00:00:00').toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
        : 'Sett. ' + new Date(key + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
      sessions: v.sessions,
      pct: v.tracked ? Math.round((v.present / v.tracked) * 100) : null
    }));

  body.innerHTML = `
    <div class="stat-row" style="margin-bottom:18px;">
      <div class="mini-card">
        <div class="lbl">Presenza media</div>
        <div class="val">${avgPct != null ? avgPct + '%' : '—'}</div>
        <div class="sub">${totalTracked ? `${totalPresent} su ${totalTracked} rilevazioni` : 'Nessuna presenza registrata'}</div>
      </div>
      <div class="mini-card">
        <div class="lbl">Allenamenti svolti</div>
        <div class="val">${inPeriod.length}</div>
        <div class="sub">${state.presenzePeriod === 'week' ? 'Questa settimana' : (state.presenzePeriod === 'month' ? 'Questo mese' : 'In stagione')}</div>
      </div>
      <div class="mini-card">
        <div class="lbl">Più costante</div>
        <div class="val small">${best ? esc(best.player.name) : '—'}</div>
        <div class="sub">${best ? best.pct + '% di presenza' : 'Nessun dato'}</div>
      </div>
    </div>

    <div class="section-label">Andamento ${state.presenzePeriod === 'season' ? 'mensile' : 'settimanale'}</div>
    ${trend.length ? `<div class="card">${trend.map(t => `
      <div class="trend-row">
        <div class="trend-lbl">${esc(t.label)}<span class="hint" style="display:block;margin:0;">${t.sessions} allenament${t.sessions === 1 ? 'o' : 'i'}</span></div>
        <div class="trend-bar"><span style="width:${t.pct ?? 0}%;background:${pctClass(t.pct ?? 0)};"></span></div>
        <div class="trend-val">${t.pct != null ? t.pct + '%' : '—'}</div>
      </div>`).join('')}</div>` : '<div class="hint">Nessun dato nel periodo.</div>'}

    <div class="section-label">Per giocatore (${rows.length})</div>
    <div class="boxscore-wrap">
      <table class="boxscore">
        <thead><tr><th>Giocatore</th><th>Rilev.</th><th>Pres.</th><th>Ass.</th><th>Giust.</th><th>%</th></tr></thead>
        <tbody>
          ${rows.map(r => `
            <tr data-player="${r.player.id}" style="cursor:pointer;">
              <td class="name-cell">#${esc(r.player.number)} ${esc(r.player.name)}</td>
              <td>${r.tracked}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.excused}</td>
              <td style="color:${r.pct != null ? pctClass(r.pct) : 'var(--dim)'};"><b>${r.pct != null ? r.pct + '%' : '—'}</b></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="hint">Tocca un giocatore per vedere allenamento per allenamento. Le presenze si registrano da Allenamenti.</div>
  `;

  body.querySelectorAll('[data-player]').forEach(tr => {
    tr.onclick = () => openPlayerDetail(tr.getAttribute('data-player'), byPlayer, inPeriod, periodAtt);
  });
}

function openPlayerDetail(playerId, byPlayer, inPeriod, periodAtt) {
  const row = byPlayer[playerId];
  if (!row) return;
  const statusByTraining = {};
  periodAtt.filter(a => a.player_id === playerId).forEach(a => { statusByTraining[a.training_id] = a.status; });
  const sorted = [...inPeriod].sort((a, b) => b.date.localeCompare(a.date));

  const root = document.getElementById('modalRoot');
  root.innerHTML = `<div class="modal-overlay" id="presOverlay"><div class="modal-box wide">
    <h3>${esc(row.player.name)}</h3>
    <p>#${esc(row.player.number)} · ${row.present} present${row.present === 1 ? 'e' : 'i'} su ${row.tracked} rilevazion${row.tracked === 1 ? 'e' : 'i'}</p>
    <div id="presDetailList"></div>
    <div class="modal-actions" style="flex-direction:column;gap:8px;">
      <button class="btn btn-primary" id="presDev" style="width:100%;">Scheda evolutiva</button>
      <button class="btn btn-secondary" id="presClose" style="width:100%;">Chiudi</button>
    </div>
  </div></div>`;
  document.getElementById('presOverlay').onclick = (e) => { if (e.target.id === 'presOverlay') root.innerHTML = ''; };
  document.getElementById('presClose').onclick = () => { root.innerHTML = ''; };
  document.getElementById('presDev').onclick = async () => {
    const { openPlayerDevelopment } = await import('../playerDevelopment.js');
    openPlayerDevelopment(playerId, { player: row.player });
  };

  const holder = document.getElementById('presDetailList');
  holder.innerHTML = sorted.map(t => {
    const st = statusByTraining[t.id];
    const cls = st === 'present' ? 'ok' : (st === 'absent' ? 'rejected' : (st === 'excused' ? 'pending' : 'missing'));
    return `<div class="list-row">
      <div class="main">
        <div class="nm">${new Date(t.date + 'T00:00:00').toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        <div class="sub">${esc(t.title)}${t.start_time ? ' · ' + esc(t.start_time) : ''}</div>
      </div>
      <span class="status-badge ${cls}">${st ? STATUS_LABELS[st] : 'Non rilevato'}</span>
    </div>`;
  }).join('');
}

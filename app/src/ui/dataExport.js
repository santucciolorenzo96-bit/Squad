import { state } from '../state.js';
import { toast } from './modal.js';
import { downloadCsv, safeName } from '../utils/csv.js';
import { currentSport } from '../utils/sports/index.js';
import { computeSeasonStats } from '../utils/stats.js';
import { fetchAttendanceForTrainings } from '../api/attendance.js';

// Esporta quello che la società ha nell'app, categoria per categoria e
// stagione per stagione. Tutto client-side sui dati già caricati, tranne le
// presenze che vanno chieste al momento.
//
// Non è un backup del database: è il modo di rispondere a "mandami i dati",
// che arriva da un commercialista, da un genitore o da una federazione.

function seasonLabel() {
  const s = state.seasons.find(x => x.id === state.activeSeasonId);
  return s ? s.name : 'stagione';
}

function fileFor(what) {
  return `squad_${safeName(state.teamProfile.name)}_${safeName(seasonLabel())}_${what}.csv`;
}

export async function exportRoster() {
  if (state.roster.length === 0) { toast('Nessun giocatore in rosa'); return; }
  downloadCsv(fileFor('rosa'),
    ['Numero', 'Nome', 'Ruolo', 'Data di nascita', 'Codice fiscale', 'Altezza cm', 'Email', 'Telefono tutore'],
    state.roster.map(p => [p.number, p.name, p.role_position, p.birth_date, p.fiscal_code, p.height_cm, p.email, p.guardian_phone]));
  toast('Rosa esportata');
}

export async function exportSeasonStats() {
  const sport = currentSport();
  const season = computeSeasonStats(state.history, sport);
  if (season.length === 0) { toast('Nessuna statistica da esportare'); return; }
  const cols = sport.seasonColumns;
  downloadCsv(fileFor('statistiche'),
    ['Numero', 'Giocatore', 'Partite'].concat(cols.map(col => col.label)),
    season.map(p => [p.number, p.name, p.games].concat(cols.map(col => p[col.key] || 0))));
  toast('Statistiche esportate');
}

export async function exportMatches() {
  if (state.history.length === 0) { toast('Nessuna partita in archivio'); return; }
  downloadCsv(fileFor('partite'),
    ['Data', 'Avversario', 'Nostro punteggio', 'Punteggio avversario', 'Esito'],
    state.history.map(g => [
      g.date ? new Date(g.date).toLocaleDateString('it-IT') : '',
      g.oppName, g.teamScore, g.oppScore,
      g.teamScore > g.oppScore ? 'Vittoria' : (g.teamScore < g.oppScore ? 'Sconfitta' : 'Pareggio')
    ]));
  toast('Partite esportate');
}

// Le presenze escono come griglia: una riga per giocatore, una colonna per
// allenamento. È la forma in cui un allenatore le guarda davvero.
export async function exportAttendance() {
  const today = new Date().toISOString().slice(0, 10);
  const done = state.trainings.filter(t => t.date && t.date <= today);
  if (done.length === 0) { toast('Nessun allenamento svolto'); return; }

  let attendance;
  try { attendance = await fetchAttendanceForTrainings(done.map(t => t.id)); }
  catch (e) { toast('Impossibile leggere le presenze'); return; }

  const byKey = {};
  attendance.forEach(a => { byKey[a.training_id + '|' + a.player_id] = a.status; });
  const labels = { present: 'P', absent: 'A', excused: 'G' };
  const sorted = [...done].sort((a, b) => a.date.localeCompare(b.date));

  downloadCsv(fileFor('presenze'),
    ['Numero', 'Giocatore'].concat(sorted.map(t => new Date(t.date).toLocaleDateString('it-IT'))).concat(['% presenza']),
    state.roster.map(p => {
      const cells = sorted.map(t => labels[byKey[t.id + '|' + p.id]] || '');
      const tracked = cells.filter(Boolean).length;
      const present = cells.filter(x => x === 'P').length;
      return [p.number, p.name].concat(cells).concat([tracked ? Math.round((present / tracked) * 100) + '%' : '']);
    }));
  toast('Presenze esportate · P presente, A assente, G giustificato');
}

export const EXPORTS = [
  { key: 'rosa', label: 'Rosa e anagrafica', hint: 'Numero, nome, ruolo, dati anagrafici e contatti dei giocatori della categoria.', run: exportRoster },
  { key: 'stats', label: 'Statistiche stagionali', hint: 'Totali per giocatore, con le voci del tuo sport.', run: exportSeasonStats },
  { key: 'partite', label: 'Partite giocate', hint: 'Data, avversario, punteggio ed esito di ogni partita in archivio.', run: exportMatches },
  { key: 'presenze', label: 'Presenze agli allenamenti', hint: 'Una riga per giocatore, una colonna per allenamento, con la percentuale.', run: exportAttendance }
];

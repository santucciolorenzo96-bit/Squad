import { supabase } from '../supabaseClient.js';

export const WEEKDAY_LABELS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
const WEEKS_AHEAD = 8;

export async function fetchRecurrences(sectorId) {
  const { data, error } = await supabase.from('training_recurrences').select('*').eq('sector_id', sectorId).order('weekday');
  if (error) throw error;
  return data;
}

export async function createRecurrence(teamId, sectorId, patch) {
  const { data, error } = await supabase.from('training_recurrences')
    .insert({ team_id: teamId, sector_id: sectorId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateRecurrence(id, patch) {
  const { data, error } = await supabase.from('training_recurrences').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeRecurrence(id) {
  const { error } = await supabase.from('training_recurrences').delete().eq('id', id);
  if (error) throw error;
}

function nextDateForWeekday(fromDate, weekday) {
  const d = new Date(fromDate);
  d.setHours(0, 0, 0, 0);
  const diff = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function occurrenceDates(weekday, weeksAhead = WEEKS_AHEAD) {
  const dates = [];
  let d = nextDateForWeekday(new Date(), weekday);
  for (let i = 0; i < weeksAhead; i++) {
    dates.push(d.toISOString().slice(0, 10));
    d = new Date(d);
    d.setDate(d.getDate() + 7);
  }
  return dates;
}

// Genera (se mancanti) le prossime occorrenze concrete in `trainings` per ogni
// programma ricorrente attivo, entro una finestra di WEEKS_AHEAD settimane.
// Idempotente: salta le date già generate per quella regola.
export async function ensureOccurrencesGenerated(teamId, sectorId, recurrences, existingTrainings) {
  const rows = [];
  recurrences.filter(r => r.active).forEach(r => {
    const already = new Set(existingTrainings.filter(t => t.recurrence_id === r.id).map(t => t.date));
    occurrenceDates(r.weekday).forEach(date => {
      if (already.has(date)) return;
      rows.push({
        team_id: teamId, sector_id: sectorId, recurrence_id: r.id,
        title: 'Allenamento', date, start_time: r.start_time, end_time: r.end_time, location: r.location
      });
    });
  });
  if (rows.length === 0) return [];
  const { data, error } = await supabase.from('trainings').insert(rows).select();
  if (error) throw error;
  return data;
}

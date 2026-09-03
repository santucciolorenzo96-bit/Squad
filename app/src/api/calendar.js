import { supabase } from '../supabaseClient.js';

export async function fetchCalendar(sectorId, seasonId) {
  let q = supabase.from('calendar').select('*').eq('sector_id', sectorId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q.order('date', { nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function bulkInsertMatches(teamId, sectorId, rows, seasonId) {
  const existing = await fetchCalendar(sectorId, seasonId);
  const existingKeys = new Set(existing.map(m => `${m.date}|${(m.opponent || '').trim().toLowerCase()}`));
  const toInsert = rows
    .filter(r => !existingKeys.has(`${r.date}|${(r.opponent || '').trim().toLowerCase()}`))
    .map(r => ({
      team_id: teamId,
      sector_id: sectorId,
      season_id: seasonId || null,
      giornata: r.giornata || null,
      opponent: r.opponent,
      date: r.date || null,
      time: r.time || null,
      location: r.location || null,
      home: r.home
    }));
  if (toInsert.length === 0) return [];
  const { data, error } = await supabase.from('calendar').insert(toInsert).select();
  if (error) throw error;
  return data;
}

export async function updateCalendarMatch(id, patch) {
  const { data, error } = await supabase.from('calendar').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeCalendarMatch(id) {
  const { error } = await supabase.from('calendar').delete().eq('id', id);
  if (error) throw error;
}

// Partite di TUTTA la società in una finestra di date, non del solo settore
// attivo: quando si apre lo scout serve sapere cosa si gioca oggi nel club,
// non nella categoria che si stava guardando. Le RLS filtrano già ai settori
// accessibili a chi guarda.
export async function fetchCalendarInRange(teamId, fromDate, toDate) {
  const { data, error } = await supabase.from('calendar')
    .select('*, sectors(name)')
    .eq('team_id', teamId).eq('played', false)
    .gte('date', fromDate).lte('date', toDate)
    .order('date', { nullsFirst: false }).order('time', { nullsFirst: false });
  if (error) throw error;
  return data;
}

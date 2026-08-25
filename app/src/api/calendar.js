import { supabase } from '../supabaseClient.js';

export async function fetchCalendar(sectorId) {
  const { data, error } = await supabase.from('calendar').select('*').eq('sector_id', sectorId).order('date', { nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function bulkInsertMatches(teamId, sectorId, rows) {
  const existing = await fetchCalendar(sectorId);
  const existingKeys = new Set(existing.map(m => `${m.date}|${(m.opponent || '').trim().toLowerCase()}`));
  const toInsert = rows
    .filter(r => !existingKeys.has(`${r.date}|${(r.opponent || '').trim().toLowerCase()}`))
    .map(r => ({
      team_id: teamId,
      sector_id: sectorId,
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

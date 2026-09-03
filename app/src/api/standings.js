import { supabase } from '../supabaseClient.js';

export async function fetchStandings(sectorId, seasonId) {
  let q = supabase.from('standings').select('*').eq('sector_id', sectorId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function upsertStanding(teamId, sectorId, row, seasonId) {
  if (row.is_us) {
    await supabase.from('standings').update({ is_us: false }).eq('sector_id', sectorId).eq('is_us', true);
  }
  if (row.id) {
    const { error } = await supabase.from('standings').update(row).eq('id', row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('standings')
      .insert({ ...row, team_id: teamId, sector_id: sectorId, season_id: seasonId || null });
    if (error) throw error;
  }
}

export async function removeStanding(id) {
  const { error } = await supabase.from('standings').delete().eq('id', id);
  if (error) throw error;
}

import { supabase } from '../supabaseClient.js';

export async function fetchNextMatch(sectorId) {
  const { data, error } = await supabase.from('next_match').select('*').eq('sector_id', sectorId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNextMatch(teamId, sectorId, match) {
  const { error } = await supabase.from('next_match').upsert({ team_id: teamId, sector_id: sectorId, ...match });
  if (error) throw error;
}

export async function clearNextMatch(sectorId) {
  const { error } = await supabase.from('next_match').delete().eq('sector_id', sectorId);
  if (error) throw error;
}

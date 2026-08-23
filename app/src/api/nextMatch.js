import { supabase } from '../supabaseClient.js';

export async function fetchNextMatch(teamId) {
  const { data, error } = await supabase.from('next_match').select('*').eq('team_id', teamId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveNextMatch(teamId, match) {
  const { error } = await supabase.from('next_match').upsert({ team_id: teamId, ...match });
  if (error) throw error;
}

export async function clearNextMatch(teamId) {
  const { error } = await supabase.from('next_match').delete().eq('team_id', teamId);
  if (error) throw error;
}

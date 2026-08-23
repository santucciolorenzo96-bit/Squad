import { supabase } from '../supabaseClient.js';

export async function fetchRoster(teamId) {
  const { data, error } = await supabase.from('players').select('*').eq('team_id', teamId).order('created_at');
  if (error) throw error;
  return data;
}

export async function addPlayer(teamId, number, name) {
  const { data, error } = await supabase.from('players')
    .insert({ team_id: teamId, number, name }).select().single();
  if (error) throw error;
  return data;
}

export async function removePlayer(id) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

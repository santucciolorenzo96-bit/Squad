import { supabase } from '../supabaseClient.js';

export async function fetchStandings(teamId) {
  const { data, error } = await supabase.from('standings').select('*').eq('team_id', teamId);
  if (error) throw error;
  return data;
}

export async function upsertStanding(teamId, row) {
  if (row.is_us) {
    await supabase.from('standings').update({ is_us: false }).eq('team_id', teamId).eq('is_us', true);
  }
  if (row.id) {
    const { error } = await supabase.from('standings').update(row).eq('id', row.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('standings').insert({ ...row, team_id: teamId });
    if (error) throw error;
  }
}

export async function removeStanding(id) {
  const { error } = await supabase.from('standings').delete().eq('id', id);
  if (error) throw error;
}

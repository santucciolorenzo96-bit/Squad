import { supabase } from '../supabaseClient.js';

export async function fetchSponsors(teamId) {
  const { data, error } = await supabase.from('finance_sponsors').select('*').eq('team_id', teamId).order('created_at');
  if (error) throw error;
  return data;
}

export async function createSponsor(teamId, patch) {
  const { data, error } = await supabase.from('finance_sponsors').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSponsor(id, patch) {
  const { data, error } = await supabase.from('finance_sponsors').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeSponsor(id) {
  const { error } = await supabase.from('finance_sponsors').delete().eq('id', id);
  if (error) throw error;
}

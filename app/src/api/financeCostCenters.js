import { supabase } from '../supabaseClient.js';

export async function fetchCostCenters(teamId) {
  const { data, error } = await supabase.from('cost_centers').select('*').eq('team_id', teamId).order('sort_order');
  if (error) throw error;
  return data;
}

export async function createCostCenter(teamId, patch) {
  const { data, error } = await supabase.from('cost_centers').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCostCenter(id, patch) {
  const { data, error } = await supabase.from('cost_centers').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeCostCenter(id) {
  const { error } = await supabase.from('cost_centers').delete().eq('id', id);
  if (error) throw error;
}

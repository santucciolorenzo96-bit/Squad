import { supabase } from '../supabaseClient.js';

export async function fetchSuppliers(teamId) {
  const { data, error } = await supabase.from('finance_suppliers').select('*').eq('team_id', teamId).order('created_at');
  if (error) throw error;
  return data;
}

export async function createSupplier(teamId, patch) {
  const { data, error } = await supabase.from('finance_suppliers').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateSupplier(id, patch) {
  const { data, error } = await supabase.from('finance_suppliers').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeSupplier(id) {
  const { error } = await supabase.from('finance_suppliers').delete().eq('id', id);
  if (error) throw error;
}

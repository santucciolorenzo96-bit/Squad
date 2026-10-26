import { supabase } from '../supabaseClient.js';
import { esigiRiga } from './scrittura.js';

export async function fetchCategories(teamId) {
  const { data, error } = await supabase.from('finance_categories').select('*').eq('team_id', teamId).order('sort_order');
  if (error) throw error;
  return data;
}

export async function createCategory(teamId, patch) {
  const { data, error } = await supabase.from('finance_categories').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id, patch) {
  const { data, error } = await supabase.from('finance_categories').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeCategory(id) {
  const { data, error } = await supabase.from('finance_categories').delete()
    .eq('id', id).select();
  if (error) throw error;
  esigiRiga(data, 'eliminare la categoria');
}

import { supabase } from '../supabaseClient.js';

export async function fetchFiscalYears(teamId) {
  const { data, error } = await supabase.from('fiscal_years').select('*').eq('team_id', teamId).order('start_date', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createFiscalYear(teamId, patch) {
  const { data, error } = await supabase.from('fiscal_years').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateFiscalYear(id, patch) {
  const { data, error } = await supabase.from('fiscal_years').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function closeFiscalYear(id, closedBy) {
  return updateFiscalYear(id, { closed: true, closed_at: new Date().toISOString(), closed_by: closedBy });
}

export async function reopenFiscalYear(id) {
  return updateFiscalYear(id, { closed: false, closed_at: null, closed_by: null });
}

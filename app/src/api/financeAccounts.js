import { supabase } from '../supabaseClient.js';

export async function fetchAccounts(teamId) {
  const { data, error } = await supabase.from('finance_accounts').select('*').eq('team_id', teamId).order('created_at');
  if (error) throw error;
  return data;
}

export async function fetchAccountBalances(teamId) {
  const { data, error } = await supabase.from('finance_account_balances').select('*').eq('team_id', teamId);
  if (error) throw error;
  const map = {};
  data.forEach(r => { map[r.account_id] = r.current_balance; });
  return map;
}

export async function createAccount(teamId, patch) {
  const { data, error } = await supabase.from('finance_accounts').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function updateAccount(id, patch) {
  const { data, error } = await supabase.from('finance_accounts').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeAccount(id) {
  const { error } = await supabase.from('finance_accounts').delete().eq('id', id);
  if (error) throw error;
}

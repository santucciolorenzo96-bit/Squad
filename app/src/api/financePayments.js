import { supabase } from '../supabaseClient.js';

export async function createPayment(teamId, patch) {
  const { data, error } = await supabase.from('finance_payments').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  return data;
}

export async function cancelPayment(id, reason) {
  const { data, error } = await supabase.from('finance_payments')
    .update({ cancelled_at: new Date().toISOString(), cancelled_reason: reason || null }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

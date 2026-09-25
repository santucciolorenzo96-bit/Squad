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

/* ============ «Ho pagato»: la dichiarazione della famiglia (045) ============
 *
 * Non e' un pagamento e non tocca la cassa: un pagamento dice anche su quale
 * conto e' entrato il denaro, e quello la famiglia non lo sa. La
 * dichiarazione e' una traccia con una data e un nome — che e' il modo in cui
 * si smette di discutere a maggio.
 *
 * Il tesoriere conferma scegliendo il conto, e in quel momento nasce il
 * pagamento vero. Se invece e' lui a registrarlo per primo, la dichiarazione
 * si chiude da sola: un trigger, cosi' nessuno deve ricordarsene.
 */

export async function fetchPaymentClaims(stato) {
  let q = supabase.from('payment_claims')
    .select('*, finance_entries(id, description, player_id, planned_amount, due_date)')
    .order('created_at', { ascending: false });
  if (stato) q = q.eq('stato', stato);
  const { data, error } = await q;
  if (error) throw descriviErroreDichiarazione(error);
  return data || [];
}

export async function declarePayment(teamId, entryId, patch, userId) {
  const { data, error } = await supabase.from('payment_claims').insert({
    team_id: teamId,
    entry_id: entryId,
    amount: patch.amount,
    paid_at: patch.paid_at,
    method: patch.method || 'contanti',
    note: (patch.note || '').trim() || null,
    created_by: userId
  }).select().single();
  if (error) throw descriviErroreDichiarazione(error);
  return data;
}

export async function withdrawPaymentClaim(id) {
  const { error } = await supabase.from('payment_claims').delete().eq('id', id);
  if (error) throw descriviErroreDichiarazione(error);
}

export async function confirmPaymentClaim(claimId, accountId) {
  const { data, error } = await supabase.rpc('conferma_dichiarazione', {
    p_claim: claimId, p_account: accountId
  });
  if (error) throw descriviErroreDichiarazione(error);
  return data;
}

export async function rejectPaymentClaim(id, motivo, userId) {
  const { data, error } = await supabase.from('payment_claims').update({
    stato: 'rifiutata',
    motivo_rifiuto: (motivo || '').trim() || null,
    decided_by: userId,
    decided_at: new Date().toISOString()
  }).eq('id', id).select().single();
  if (error) throw descriviErroreDichiarazione(error);
  return data;
}

function descriviErroreDichiarazione(error) {
  const msg = (error && error.message) || '';
  if (/payment_claims|conferma_dichiarazione/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Mancano le dichiarazioni di pagamento: esegui la migrazione 045 su Supabase, poi riprova.');
  }
  return error;
}

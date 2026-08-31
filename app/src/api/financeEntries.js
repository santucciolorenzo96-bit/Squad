import { supabase } from '../supabaseClient.js';

export async function fetchEntries(teamId, kind) {
  const { data, error } = await supabase.from('finance_entries')
    .select('*, finance_categories(name)')
    .eq('team_id', teamId).eq('kind', kind)
    .order('accrual_date', { ascending: false });
  if (error) throw error;
  if (data.length === 0) return [];
  const statusMap = await fetchStatusMap(data.map(e => e.id));
  return data.map(e => ({ ...e, _status: statusMap[e.id] }));
}

export async function fetchDeadlines(teamId) {
  const { data, error } = await supabase.from('finance_entries')
    .select('*, finance_categories(name)')
    .eq('team_id', teamId).not('due_date', 'is', null).is('cancelled_at', null)
    .order('due_date');
  if (error) throw error;
  if (data.length === 0) return [];
  const statusMap = await fetchStatusMap(data.map(e => e.id));
  return data
    .map(e => ({ ...e, _status: statusMap[e.id] }))
    .filter(e => e._status && !['pagato', 'incassato', 'annullato'].includes(e._status.status));
}

export async function fetchEntriesForPlayers(playerIds) {
  if (!playerIds || playerIds.length === 0) return [];
  const { data, error } = await supabase.from('finance_entries')
    .select('*, finance_categories(name)')
    .in('player_id', playerIds).eq('kind', 'income').is('cancelled_at', null)
    .order('due_date');
  if (error) throw error;
  if (data.length === 0) return [];
  const statusMap = await fetchStatusMap(data.map(e => e.id));
  return data
    .map(e => ({ ...e, _status: statusMap[e.id] }))
    .filter(e => e._status && !['incassato', 'annullato'].includes(e._status.status));
}

// Quote effettivamente incassate da un atleta in un anno solare: è quanto serve
// alla dichiarazione per la detrazione, che certifica il pagato, non il dovuto.
export async function fetchPlayerPaymentsForYear(playerId, year) {
  const { data, error } = await supabase.from('finance_payments')
    .select('id, amount, paid_at, method, finance_entries!inner(id, description, player_id, kind)')
    .eq('finance_entries.player_id', playerId)
    .eq('finance_entries.kind', 'income')
    .is('cancelled_at', null)
    .gte('paid_at', `${year}-01-01`)
    .lte('paid_at', `${year}-12-31`)
    .order('paid_at');
  if (error) throw error;
  return data;
}

async function fetchStatusMap(ids) {
  const { data, error } = await supabase.from('finance_entries_status').select('*').in('entry_id', ids);
  if (error) throw error;
  const map = {};
  data.forEach(s => { map[s.entry_id] = s; });
  return map;
}

export async function fetchEntryDetail(id) {
  const { data: entry, error } = await supabase.from('finance_entries').select('*, finance_categories(name)').eq('id', id).single();
  if (error) throw error;
  const [{ data: allocations, error: allocErr }, { data: payments, error: payErr }, { data: documents, error: docErr }, statusMap] = await Promise.all([
    supabase.from('finance_entry_allocations').select('*, cost_centers(name)').eq('entry_id', id),
    supabase.from('finance_payments').select('*, finance_accounts(name)').eq('entry_id', id).order('paid_at'),
    supabase.from('finance_documents').select('*').eq('entry_id', id).order('uploaded_at', { ascending: false }),
    fetchStatusMap([id])
  ]);
  if (allocErr) throw allocErr;
  if (payErr) throw payErr;
  if (docErr) throw docErr;
  return { entry, allocations, payments, documents, status: statusMap[id] };
}

export async function createEntry(teamId, patch, allocations) {
  const { data: entry, error } = await supabase.from('finance_entries').insert({ team_id: teamId, ...patch }).select().single();
  if (error) throw error;
  try {
    const { error: allocErr } = await supabase.from('finance_entry_allocations')
      .insert(allocations.map(a => ({ entry_id: entry.id, cost_center_id: a.cost_center_id, amount: a.amount })));
    if (allocErr) throw allocErr;
  } catch (e) {
    await supabase.from('finance_entries').update({ cancelled_at: new Date().toISOString(), cancelled_reason: 'Creazione fallita: ripartizione non valida' }).eq('id', entry.id);
    throw e;
  }
  return entry;
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase.from('finance_entries').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function cancelEntry(id, reason) {
  const { data, error } = await supabase.from('finance_entries')
    .update({ cancelled_at: new Date().toISOString(), cancelled_reason: reason || null }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

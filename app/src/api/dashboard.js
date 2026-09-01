import { supabase } from '../supabaseClient.js';

// Le query di questo file guardano TUTTA la società, non il settore attivo:
// la Situazione serve proprio a vedere insieme quello che le altre schermate
// mostrano una categoria alla volta. Le RLS restringono già ai settori a cui
// questo utente ha accesso, quindi non serve un filtro aggiuntivo qui.

export async function fetchAllPlayers(teamId) {
  const { data, error } = await supabase.from('players')
    .select('id, name, number, guardian_phone, email, player_sectors(sector_id)')
    .eq('team_id', teamId);
  if (error) throw error;
  return data;
}

export async function fetchAllPlayerDocuments(teamId) {
  const { data, error } = await supabase.from('player_documents')
    .select('id, player_id, doc_type, status, expires_at, uploaded_at')
    .eq('team_id', teamId);
  if (error) throw error;
  return data;
}

// Scadenze economiche aperte: entrate e uscite con una data di scadenza,
// non annullate, con lo stato calcolato dalla vista finance_entries_status.
export async function fetchOpenDeadlines(teamId) {
  const { data, error } = await supabase.from('finance_entries')
    .select('id, kind, description, due_date, planned_amount, player_id, party_name')
    .eq('team_id', teamId).not('due_date', 'is', null).is('cancelled_at', null);
  if (error) throw error;
  if (data.length === 0) return [];
  const { data: statuses, error: sErr } = await supabase.from('finance_entries_status')
    .select('entry_id, status, residual_amount').in('entry_id', data.map(e => e.id));
  if (sErr) throw sErr;
  const map = {};
  statuses.forEach(s => { map[s.entry_id] = s; });
  return data
    .map(e => ({ ...e, _status: map[e.id] }))
    .filter(e => e._status && !['pagato', 'incassato', 'annullato'].includes(e._status.status));
}

export async function fetchOpenCommunications(teamId) {
  const { data, error } = await supabase.from('communications')
    .select('id, sector_id, kind, title, event_date, respond_by, requires_response, communication_recipients(player_id, status)')
    .eq('team_id', teamId).is('closed_at', null)
    .order('event_date', { nullsFirst: false });
  if (error) throw error;
  return data;
}

// Allenamenti già svolti in una finestra recente, su tutti i settori: servono
// a capire dove le presenze non sono state rilevate.
export async function fetchTrainingsInRange(teamId, fromDate, toDate) {
  const { data, error } = await supabase.from('trainings')
    .select('id, sector_id, title, date, start_time, sectors(name)')
    .eq('team_id', teamId).gte('date', fromDate).lte('date', toDate)
    .order('date', { ascending: false });
  if (error) throw error;
  return data;
}

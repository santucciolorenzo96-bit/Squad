import { supabase } from '../supabaseClient.js';

// Le notifiche arrivano insieme al proprio stato di lettura: senza, "non
// letta" non vorrebbe dire niente quando lo stesso avviso di settore raggiunge
// dieci persone diverse.
export async function fetchNotifications(teamId) {
  const { data, error } = await supabase.from('notifications')
    .select('*, notification_reads(read_at)')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
    .limit(60);
  if (error) throw error;
  // La RLS su notification_reads restituisce solo le righe di chi guarda,
  // quindi la presenza dell'elemento è già la risposta.
  return data.map(n => ({ ...n, read: (n.notification_reads || []).length > 0 }));
}

export async function markNotificationsRead(ids) {
  const { error } = await supabase.rpc('mark_notifications_read', {
    p_ids: ids && ids.length ? ids : null
  });
  if (error) throw error;
}

// Novanta giorni: oltre, una notifica non serve più a nessuno. Riservata agli
// amministratori e volutamente esplicita — cancellare in automatico dei dati
// senza che nessuno l'abbia chiesto è il tipo di comportamento che poi non si
// riesce a spiegare.
export async function pruneNotifications(days = 90) {
  const { data, error } = await supabase.rpc('prune_notifications', { p_days: days });
  if (error) throw error;
  return data;
}

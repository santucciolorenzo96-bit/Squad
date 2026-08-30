import { supabase } from '../supabaseClient.js';

export async function fetchMyProfile() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
  if (error) throw error;
  return data ? { ...data, email: auth.user.email } : null;
}

export async function fetchTeamStaff(teamId) {
  const { data, error } = await supabase.from('profiles')
    .select('*').eq('team_id', teamId).eq('active', true).neq('role', 'famiglia').order('created_at');
  if (error) throw error;
  return data;
}

// Riservata agli amministratori: la policy di update diretta su profiles esiste
// solo per loro (vedi migrazione 009).
export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Percorso per l'utente su se stesso: scrive solo nome e telefono, così nessuno
// può assegnarsi ruolo, accesso alla finanza o permesso di caricare documenti.
export async function updateMyProfile({ display_name, phone }) {
  const { data, error } = await supabase.rpc('update_my_profile', {
    p_display_name: display_name,
    p_phone: phone || null
  });
  if (error) throw error;
  return data;
}

export async function markNotificationsSeen() {
  const { data, error } = await supabase.rpc('mark_notifications_seen');
  if (error) throw error;
  return data;
}

export async function deactivateProfile(id) {
  const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
  if (error) throw error;
}

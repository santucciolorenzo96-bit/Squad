import { supabase } from '../supabaseClient.js';

// Inviti nominativi. Il codice società resta quello che è — uno solo, uguale
// per tutti, permanente — e serve a far entrare chiunque. Un invito serve a
// far entrare una persona precisa già col suo ruolo, le sue categorie e, se è
// un genitore o un atleta, già collegata alla scheda giusta.

export async function fetchInvites() {
  const { data, error } = await supabase.from('invites')
    .select('*, players(name, number), profiles:used_by(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvite({ role, playerId, sectorIds, label, note, daysValid }) {
  const { data, error } = await supabase.rpc('create_invite', {
    p_role: role,
    p_player_id: playerId || null,
    p_sector_ids: sectorIds || [],
    p_label: label || null,
    p_note: note || null,
    p_days_valid: daysValid == null ? 14 : daysValid
  });
  if (error) throw error;
  return data;
}

export async function revokeInvite(inviteId) {
  const { error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId });
  if (error) throw error;
}

// Anteprima prima della registrazione: non c'è ancora nessuna sessione.
// Restituisce null se il codice non esiste, è scaduto, revocato o già usato —
// il server non distingue fra questi casi e non deve.
export async function fetchInvitePreview(code) {
  const clean = (code || '').trim();
  if (!clean) return null;
  const { data, error } = await supabase.rpc('invite_preview', { p_code: clean });
  if (error) throw error;
  return (data && data.length) ? data[0] : null;
}

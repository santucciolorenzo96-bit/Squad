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
    .select('*').eq('team_id', teamId).eq('active', true).not('role', 'in', '(genitore,atleta)').order('created_at');
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

export async function deactivateProfile(id) {
  const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
  if (error) throw error;
}

// ======================= Fotografia del profilo =======================
// Le iniziali restano il predefinito: funzionano sempre e non chiedono niente.
// Chi vuole mette la propria foto, e la inquadra a mano — il ritaglio
// automatico taglia le teste, come si era già visto con le foto dei giocatori.

export async function uploadMyAvatar(userId, blob) {
  const path = `${userId}/avatar_${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('user-avatars')
    .upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
  if (upErr) throw describeAvatarError(upErr);
  return setMyAvatar(path, 50, 50);
}

export async function setMyAvatar(path, focalX, focalY) {
  const { data, error } = await supabase.rpc('set_my_avatar', {
    p_path: path, p_focal_x: focalX ?? 50, p_focal_y: focalY ?? 50
  });
  if (error) throw describeAvatarError(error);
  return data;
}

export async function removeMyAvatar(path) {
  if (path) await supabase.storage.from('user-avatars').remove([path]).catch(() => {});
  return setMyAvatar(null, 50, 50);
}

export async function getAvatarUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from('user-avatars').createSignedUrl(path, 3600);
  if (error) return null; // un avatar che non si carica non deve rompere niente
  return data.signedUrl;
}

// Le foto di più persone in una chiamata sola: { [profileId]: url }
export async function fetchAvatarUrls(profiles) {
  const withPhoto = (profiles || []).filter(p => p.avatar_path);
  if (withPhoto.length === 0) return {};
  const { data, error } = await supabase.storage.from('user-avatars')
    .createSignedUrls(withPhoto.map(p => p.avatar_path), 3600);
  if (error) return {};
  const map = {};
  withPhoto.forEach((p, i) => { if (data[i] && data[i].signedUrl) map[p.id] = data[i].signedUrl; });
  return map;
}

function describeAvatarError(error) {
  const msg = (error && error.message) || '';
  if (/set_my_avatar|avatar_path/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la fotografia del profilo: esegui la migrazione 024 su Supabase, poi riprova.');
  }
  if (/Bucket not found/i.test(msg)) {
    return new Error('Manca il deposito delle immagini: esegui la migrazione 024 su Supabase, poi riprova.');
  }
  return error;
}

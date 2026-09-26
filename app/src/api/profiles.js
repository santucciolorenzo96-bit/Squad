import { supabase } from '../supabaseClient.js';

export async function fetchMyProfile() {
  // getSession legge la sessione gia' in memoria e rinnova il token solo se e'
  // scaduto; getUser andava SEMPRE a chiedere al server di validarlo, e quella
  // richiesta stava in cima alla catena di avvio: la pagava ogni apertura
  // dell app, anche quando non c era nessuna sessione da validare.
  const { data: auth } = await supabase.auth.getSession();
  const utente = auth && auth.session ? auth.session.user : null;
  if (!utente) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', utente.id).maybeSingle();
  if (error) throw descriviErroreProfilo(error);
  return data ? { ...data, email: utente.email } : null;
}

/* Questa lettura e' la prima cosa che l'app fa: se fallisce, l'utente finisce
 * sulla schermata d'accesso e sembra che non riesca piu' a entrare. Il motivo
 * vero va detto, altrimenti l'unico sintomo e' una porta che non si apre.
 *
 * La ricorsione e' successa davvero, con la migrazione 046: una policy su
 * profiles che leggeva profiles. Ha chiuso fuori tutti, SuperAdmin compreso. */
function descriviErroreProfilo(error) {
  const msg = (error && error.message) || '';
  if (/infinite recursion/i.test(msg)) {
    return new Error(
      'Le regole di accesso ai profili si richiamano fra loro e il database si ferma: '
      + 'esegui la migrazione 048 su Supabase, poi ricarica.'
    );
  }
  if (/approved_at|claim_note/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca l’approvazione degli iscritti: esegui la migrazione 046 su Supabase, poi ricarica.');
  }
  return error;
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
  // La foto del profilo non dipende da nessun ruolo: si scrive nella propria
  // cartella e basta. Se il database la rifiuta, le regole non ci sono —
  // non e' una questione di permessi di chi carica.
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error(
      'Il database ha rifiutato la foto. La foto del profilo non dipende dal ruolo, '
      + 'quindi mancano le regole del deposito: esegui la migrazione 024 su Supabase, poi riprova.'
    );
  }
  return error;
}

/* =============== Chi aspetta di entrare in società (migrazione 046) ===============
 *
 * Con il codice della società si entra come atleta o come genitore, e si
 * resta in attesa: un codice che gira in una chat non è una prova di identità.
 * Lo staff entra solo con un invito personale, che un amministratore ha creato
 * sapendo chi stava invitando — e quello è già l'approvazione.
 */

export async function fetchPending() {
  const { data, error } = await supabase.rpc('chi_aspetta');
  if (error) throw descriviErroreIscritti(error);
  return data || [];
}

// Approvare e collegare l'atleta sono lo stesso gesto: l'amministratore sta
// rispondendo a «sono il genitore di Luca», e dire di sì senza collegare
// lascerebbe a metà proprio la cosa che era stata chiesta.
export async function approveMember(profileId, playerId, role) {
  const { error } = await supabase.rpc('approva_iscritto', {
    p_profile: profileId, p_player: playerId || null, p_role: role || null
  });
  if (error) throw descriviErroreIscritti(error);
}

export async function rejectMember(profileId) {
  const { error } = await supabase.rpc('rifiuta_iscritto', { p_profile: profileId });
  if (error) throw descriviErroreIscritti(error);
}

function descriviErroreIscritti(error) {
  const msg = (error && error.message) || '';
  if (/chi_aspetta|approva_iscritto|rifiuta_iscritto|approved_at/.test(msg)
      && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca l’approvazione degli iscritti: esegui la migrazione 046 su Supabase, poi riprova.');
  }
  return error;
}

import { supabase } from '../supabaseClient.js';

export async function fetchRosterBySector(sectorId) {
  const { data, error } = await supabase.from('player_sectors')
    .select('players(*)').eq('sector_id', sectorId);
  if (error) throw error;
  return data.map(row => row.players).sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

export async function addPlayer(teamId, sectorId, number, name) {
  const { data: player, error } = await supabase.from('players')
    .insert({ team_id: teamId, number, name }).select().single();
  if (error) throw error;
  const { error: linkErr } = await supabase.from('player_sectors').insert({ player_id: player.id, sector_id: sectorId });
  if (linkErr) throw linkErr;
  return player;
}

export async function removePlayerFromSector(playerId, sectorId) {
  const { error } = await supabase.from('player_sectors').delete()
    .eq('player_id', playerId).eq('sector_id', sectorId);
  if (error) throw error;
}

export async function deletePlayer(id) {
  const { error } = await supabase.from('players').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchPlayer(id) {
  const { data, error } = await supabase.from('players').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function updatePlayer(id, fields) {
  const { data, error } = await supabase.from('players').update(fields).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Percorso per gli account famiglia: RLS non filtra per colonna, quindi il
// giocatore collegato si aggiorna tramite una funzione che scrive i soli campi
// anagrafici (niente numero di maglia, nome o squadra).
export async function updateLinkedPlayerDetails(id, fields) {
  const { data, error } = await supabase.rpc('update_linked_player_details', {
    p_player_id: id,
    p_birth_date: fields.birth_date,
    p_fiscal_code: fields.fiscal_code,
    p_guardian_phone: fields.guardian_phone,
    p_email: fields.email,
    p_height_cm: fields.height_cm
  });
  if (error) throw error;
  return data;
}

export async function uploadPlayerPhoto(teamId, playerId, blob) {
  const path = `${teamId}/${playerId}/photo_${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('player-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId).select().single();
  if (error) throw error;
  return data;
}

export async function getPlayerPhotoSignedUrl(filePath) {
  const { data, error } = await supabase.storage.from('player-photos').createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

// Firma in un'unica chiamata le foto di più giocatori: { [playerId]: signedUrl }
export async function fetchPlayerPhotoUrls(players) {
  const withPhoto = players.filter(p => p.photo_path);
  if (withPhoto.length === 0) return {};
  const { data, error } = await supabase.storage.from('player-photos')
    .createSignedUrls(withPhoto.map(p => p.photo_path), 600);
  if (error) throw error;
  const map = {};
  withPhoto.forEach((p, i) => { if (data[i] && data[i].signedUrl) map[p.id] = data[i].signedUrl; });
  return map;
}

export async function fetchPlayerDocuments(playerId) {
  const { data, error } = await supabase.from('player_documents')
    .select('*').eq('player_id', playerId).order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function uploadPlayerDocument(teamId, playerId, docType, blob, extension, uploadedBy, expiresAt) {
  const path = `${teamId}/${playerId}/${docType}_${Date.now()}.${extension}`;
  const { error: upErr } = await supabase.storage.from('player-documents').upload(path, blob, { upsert: false });
  if (upErr) throw upErr;
  const { data, error } = await supabase.from('player_documents').insert({
    team_id: teamId, player_id: playerId, doc_type: docType,
    file_path: path, file_name: path.split('/').pop(),
    status: 'in_review', uploaded_by: uploadedBy, expires_at: expiresAt || null
  }).select().single();
  if (error) throw error;
  return data;
}

export async function getDocumentSignedUrl(filePath) {
  const { data, error } = await supabase.storage.from('player-documents').createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function reviewDocument(docId, status, reviewerId, note) {
  const { data, error } = await supabase.from('player_documents').update({
    status, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(), review_note: note || null
  }).eq('id', docId).select().single();
  if (error) throw error;
  return data;
}

// RLS su player_documents restringe già ai soli documenti dei settori a cui questo
// utente ha accesso (has_sector_access_to_player) — nessun filtro aggiuntivo necessario qui.
export async function fetchPendingDocuments(teamId) {
  const { data, error } = await supabase.from('player_documents')
    .select('*, players(name, number)').eq('team_id', teamId).eq('status', 'in_review')
    .order('uploaded_at');
  if (error) throw error;
  return data;
}

// Documenti con scadenza entro `days` giorni (comprende quelli già scaduti):
// usato per l'avviso di rinnovo del certificato medico.
export async function fetchExpiringDocuments(teamId, days = 30) {
  const limit = new Date();
  limit.setDate(limit.getDate() + days);
  const { data, error } = await supabase.from('player_documents')
    .select('*, players(name, number)').eq('team_id', teamId)
    .not('expires_at', 'is', null).lte('expires_at', limit.toISOString().slice(0, 10))
    .order('expires_at');
  if (error) throw error;
  return data;
}

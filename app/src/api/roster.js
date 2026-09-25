import { supabase } from '../supabaseClient.js';
import { stagioneAttiva } from './stagione.js';
import { giornoISO } from '../utils/format.js';

// La rosa è di una stagione: la stessa persona può essere nell'Under 15
// quest'anno e nell'Under 17 il prossimo, e le due rose restano distinte.
export async function fetchRosterBySector(sectorId, seasonId) {
  let q = supabase.from('player_sectors').select('players(*)').eq('sector_id', sectorId);
  q = seasonId ? q.eq('season_id', seasonId) : q.is('season_id', null);
  const { data, error } = await q;
  if (error) throw error;
  return data.map(row => row.players).filter(Boolean)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}

/* Aggiungere un giocatore sono due scritture: la persona, e la sua presenza
 * nella rosa di questa categoria in questa stagione.
 *
 * Se la seconda falliva, la prima restava. Nasceva un giocatore che non sta in
 * nessuna rosa: Rosa e Anagrafica leggono per categoria e stagione, quindi
 * quella persona non compariva piu' da nessuna parte — esisteva solo nella
 * Situazione e nel database. L'errore lo vedevi, ma sembrava «non e' stato
 * creato», e invece era stato creato a meta'.
 *
 * Adesso o entrano tutte e due o non entra niente: se il collegamento non
 * riesce, il giocatore appena creato viene tolto. Non e' una transazione vera
 * — quelle da qui non si fanno — ma copre il caso che conta. */
export async function addPlayer(teamId, sectorId, number, name, seasonId = stagioneAttiva()) {
  const { data: player, error } = await supabase.from('players')
    .insert({ team_id: teamId, number, name }).select().single();
  if (error) throw error;
  const { error: linkErr } = await supabase.from('player_sectors')
    .insert({ player_id: player.id, sector_id: sectorId, season_id: seasonId || null });
  if (linkErr) {
    // try/catch e non .catch(): il costruttore di query di Supabase ha `then`
    // ma non `catch`, e una .catch() qui lancerebbe un errore suo al posto di
    // quello vero. Se il ritiro non riesce il giocatore resta orfano, ed e'
    // giusto che esca comunque l'errore che ha causato tutto.
    try { await supabase.from('players').delete().eq('id', player.id); } catch (e) { /* vedi sopra */ }
    throw linkErr;
  }
  return player;
}

// Toglie il giocatore dalla rosa della stagione indicata, non dalla sua
// storia: le stagioni precedenti restano intatte.
export async function removePlayerFromSector(playerId, sectorId, seasonId = stagioneAttiva()) {
  let q = supabase.from('player_sectors').delete()
    .eq('player_id', playerId).eq('sector_id', sectorId);
  q = seasonId ? q.eq('season_id', seasonId) : q.is('season_id', null);
  const { error } = await q;
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

/* Il numero di maglia scelto da chi lo indossa (migrazione 040).
 *
 * Una porta stretta e separata da updateLinkedPlayerDetails, che il numero lo
 * esclude apposta: qui si scrive SOLO il numero, solo sul proprio atleta, solo
 * se non ce l'ha ancora, e solo se nessun compagno ce l'ha addosso. Il
 * database rifa' tutti e quattro i controlli — quelli dell'app sono cortesia,
 * non difesa. */
export async function chooseMyNumber(playerId, numero) {
  const { data, error } = await supabase.rpc('choose_my_number', {
    p_player_id: playerId, p_number: String(numero)
  });
  if (error) throw descriviErroreNumero(error);
  return data;
}

function descriviErroreNumero(error) {
  const msg = (error && error.message) || '';
  if (/choose_my_number/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la scelta del numero: esegui la migrazione 040 su Supabase, poi riprova.');
  }
  return error;
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

/* IL PERCORSO NON E' UNA COMODITA': E' IL PERMESSO.
 *
 * Le regole del deposito leggono la seconda cartella del percorso e chiedono
 * se chi carica puo' gestire QUELL'atleta. Cambiare la forma di questa riga
 * — togliere la societa', mettere l'atleta altrove — non sposta un file:
 * toglie il permesso di scriverlo, e l'errore che ne esce parla di sicurezza
 * invece che di percorsi.
 */
export async function uploadPlayerPhoto(teamId, playerId, blob) {
  const path = `${teamId}/${playerId}/photo_${Date.now()}.jpg`;
  const { error: upErr } = await supabase.storage.from('player-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (upErr) throw descriviErroreFoto(upErr);
  const { data, error } = await supabase.from('players').update({ photo_path: path }).eq('id', playerId).select().single();
  if (error) throw error;
  return data;
}

/* «new row violates row-level security policy» e' corretto e non serve a
 * niente: chi lo legge sta caricando la foto di un ragazzino, non
 * amministrando un database. Qui diventa una frase che dice cosa fare.
 *
 * Le due cause sono diverse e portano in due posti diversi — una si risolve
 * eseguendo una migrazione, l'altra chiedendo a un amministratore — quindi
 * vanno distinte invece di essere messe insieme in un «non e' stato
 * possibile». */
function descriviErroreFoto(error) {
  const msg = (error && error.message) || '';
  if (/Bucket not found/i.test(msg)) {
    return new Error(
      'Manca il deposito delle foto degli atleti: esegui la migrazione 004 su Supabase, poi riprova.'
    );
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error(
      'Il database ha rifiutato la foto: per caricarla servono i permessi su questa categoria. '
      + 'Se il giocatore non è assegnato a nessuna categoria serve la migrazione 039; '
      + 'se sei un amministratore e succede lo stesso, mancano le regole del deposito: '
      + 'esegui la migrazione 010 su Supabase.'
    );
  }
  return error;
}

export async function getPlayerPhotoSignedUrl(filePath) {
  const { data, error } = await supabase.storage.from('player-photos').createSignedUrl(filePath, 300);
  if (error) throw error;
  return data.signedUrl;
}

/* Firma in un'unica chiamata le foto di piu' giocatori: { [playerId]: url }.
 *
 * `secondi` dice quanto valgono. Dieci minuti bastano a una schermata che si
 * guarda e si chiude; non bastano a una partita, che dura un'ora e mezza e
 * durante la quale nessuno ricarica niente. Lo scout ne chiede sei ore, che
 * coprono anche un torneo con tre partite di fila.
 */
export async function fetchPlayerPhotoUrls(players, secondi = 600) {
  const withPhoto = players.filter(p => p.photo_path);
  if (withPhoto.length === 0) return {};
  const { data, error } = await supabase.storage.from('player-photos')
    .createSignedUrls(withPhoto.map(p => p.photo_path), secondi);
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

// I documenti di tutta la rosa in una query sola. Chiedere i documenti giocatore
// per giocatore vorrebbe dire una richiesta a testa: con venti atleti sono venti
// andate e ritorni per disegnare una tabella.
export async function fetchDocumentsForPlayers(playerIds) {
  const map = {};
  if (!playerIds || playerIds.length === 0) return map;
  const { data, error } = await supabase.from('player_documents')
    .select('player_id, doc_type, status, expires_at, uploaded_at')
    .in('player_id', playerIds);
  if (error) throw error;
  data.forEach(d => {
    if (!map[d.player_id]) map[d.player_id] = [];
    map[d.player_id].push(d);
  });
  return map;
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
    .not('expires_at', 'is', null).lte('expires_at', giornoISO(limit))
    .order('expires_at');
  if (error) throw error;
  return data;
}

import { supabase } from '../supabaseClient.js';

export async function fetchLinkedPlayers(profileId) {
  const { data, error } = await supabase.from('profile_players')
    .select('players(*)').eq('profile_id', profileId);
  if (error) throw error;
  return data.map(row => row.players);
}

export async function linkProfileToPlayer(profileId, playerId) {
  const { error } = await supabase.from('profile_players').insert({ profile_id: profileId, player_id: playerId });
  if (error) throw error;
}

export async function unlinkProfileFromPlayer(profileId, playerId) {
  const { error } = await supabase.from('profile_players').delete()
    .eq('profile_id', profileId).eq('player_id', playerId);
  if (error) throw error;
}

// Account (genitore/atleta) collegati a un giocatore: serve alla scheda atleta
// per sapere chi versa le quote e chi vede i suoi dati.
export async function fetchLinkedProfilesForPlayer(playerId) {
  const { data, error } = await supabase.from('profile_players')
    .select('profiles(id, display_name, role)').eq('player_id', playerId);
  if (error) throw error;
  return data.map(r => r.profiles).filter(Boolean);
}

/* Chi è collegato a una scheda atleta, e chi potrebbe esserlo.
 *
 * Non più i soli genitori e atleti. Il collegamento serve anche a chi nella
 * società fa due cose: l'allenatore dell'Open A che gioca in Prima Squadra, il
 * genitore che allena un'altra categoria. Collegarlo alla sua scheda gli fa
 * vedere anche quella categoria — da giocatore, senza poterci mettere mano.
 *
 * Restituisce TUTTI gli account attivi, ognuno con i suoi collegamenti: sta a
 * chi disegna decidere chi mostrare per primo e chi solo su richiesta.
 */
export async function fetchFamilyLinksForTeam(teamId) {
  const { data: profiles, error } = await supabase.from('profiles')
    .select('id, display_name, role, active, can_upload_documents, can_score_matches')
    .eq('team_id', teamId).eq('active', true);
  if (error) throw error;
  const { data: links, error: linkErr } = await supabase.from('profile_players').select('profile_id, players(id, name, number)');
  if (linkErr) throw linkErr;
  const byProfile = {};
  links.forEach(l => {
    if (!byProfile[l.profile_id]) byProfile[l.profile_id] = [];
    byProfile[l.profile_id].push(l.players);
  });
  return profiles.map(p => ({ ...p, linkedPlayers: byProfile[p.id] || [] }));
}

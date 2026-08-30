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

export async function fetchFamilyLinksForTeam(teamId) {
  // profili famiglia del team + i loro giocatori collegati (per la schermata Utenti)
  const { data: profiles, error } = await supabase.from('profiles')
    .select('id, display_name, active, can_upload_documents')
    .eq('team_id', teamId).eq('role', 'famiglia').eq('active', true);
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

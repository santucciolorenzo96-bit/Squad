import { supabase } from '../supabaseClient.js';

export async function fetchSectors(teamId) {
  const { data, error } = await supabase.from('sectors').select('*').eq('team_id', teamId).order('sort_order');
  if (error) throw error;
  return data;
}

export async function createSector(teamId, name) {
  const { data, error } = await supabase.from('sectors').insert({ team_id: teamId, name }).select().single();
  if (error) throw error;
  return data;
}

export async function renameSector(sectorId, name) {
  const { error } = await supabase.from('sectors').update({ name }).eq('id', sectorId);
  if (error) throw error;
}

export async function removeSector(sectorId) {
  const { error } = await supabase.from('sectors').delete().eq('id', sectorId);
  if (error) throw error;
}

export async function fetchStaffSectors(teamId) {
  const { data, error } = await supabase.from('profile_sectors')
    .select('profile_id, sector_id, sectors!inner(team_id)').eq('sectors.team_id', teamId);
  if (error) throw error;
  const map = {};
  data.forEach(row => {
    if (!map[row.profile_id]) map[row.profile_id] = [];
    map[row.profile_id].push(row.sector_id);
  });
  return map;
}

export async function assignStaffToSector(profileId, sectorId) {
  const { error } = await supabase.from('profile_sectors').insert({ profile_id: profileId, sector_id: sectorId });
  if (error) throw error;
}

export async function removeStaffFromSector(profileId, sectorId) {
  const { error } = await supabase.from('profile_sectors').delete()
    .eq('profile_id', profileId).eq('sector_id', sectorId);
  if (error) throw error;
}

export async function fetchPlayerSectorIds(playerId) {
  const { data, error } = await supabase.from('player_sectors').select('sector_id').eq('player_id', playerId);
  if (error) throw error;
  return data.map(r => r.sector_id);
}

export async function setPlayerSectors(playerId, sectorIds) {
  const { error: delErr } = await supabase.from('player_sectors').delete().eq('player_id', playerId);
  if (delErr) throw delErr;
  if (sectorIds.length === 0) return;
  const { error } = await supabase.from('player_sectors')
    .insert(sectorIds.map(sector_id => ({ player_id: playerId, sector_id })));
  if (error) throw error;
}

export async function addPlayerToSector(playerId, sectorId) {
  const { error } = await supabase.from('player_sectors').insert({ player_id: playerId, sector_id: sectorId });
  if (error) throw error;
}

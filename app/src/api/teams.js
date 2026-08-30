import { supabase } from '../supabaseClient.js';

export async function fetchTeam(teamId) {
  const { data, error } = await supabase.from('teams').select('*').eq('id', teamId).single();
  if (error) throw error;
  return data;
}

export async function updateTeam(teamId, patch) {
  const { data, error } = await supabase.from('teams').update(patch).eq('id', teamId).select().single();
  if (error) throw error;
  return data;
}

export async function uploadTeamLogo(teamId, blob) {
  // I loghi si salvano nel formato del blob prodotto in fase di elaborazione:
  // forzare JPEG qui azzererebbe la trasparenza appena preservata.
  const type = blob.type || 'image/png';
  const ext = type === 'image/png' ? 'png' : 'jpg';
  const path = `${teamId}/logo_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from('team-logos').upload(path, blob, {
    contentType: type,
    upsert: true
  });
  if (upErr) throw upErr;
  const { data } = supabase.storage.from('team-logos').getPublicUrl(path);
  return data.publicUrl;
}

export async function regenerateInviteCode() {
  const { data, error } = await supabase.rpc('regenerate_invite_code');
  if (error) throw error;
  return data;
}

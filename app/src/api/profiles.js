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

export async function updateProfile(id, patch) {
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deactivateProfile(id) {
  const { error } = await supabase.from('profiles').update({ active: false }).eq('id', id);
  if (error) throw error;
}

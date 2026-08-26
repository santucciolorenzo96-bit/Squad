import { supabase } from '../supabaseClient.js';

export async function fetchNotifications(teamId) {
  const { data, error } = await supabase.from('notifications')
    .select('*').eq('team_id', teamId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return data;
}

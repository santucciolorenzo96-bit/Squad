import { supabase } from '../supabaseClient.js';

export async function fetchAttendance(trainingId) {
  const { data, error } = await supabase.from('training_attendance').select('*').eq('training_id', trainingId);
  if (error) throw error;
  return data;
}

// Presenze di più allenamenti in una sola query (per il pannello Presenze).
export async function fetchAttendanceForTrainings(trainingIds) {
  if (!trainingIds || trainingIds.length === 0) return [];
  const { data, error } = await supabase.from('training_attendance')
    .select('*').in('training_id', trainingIds);
  if (error) throw error;
  return data;
}

export async function setAttendance(trainingId, playerId, status) {
  const { data, error } = await supabase.from('training_attendance')
    .upsert({ training_id: trainingId, player_id: playerId, status, updated_at: new Date().toISOString() })
    .select().single();
  if (error) throw error;
  return data;
}

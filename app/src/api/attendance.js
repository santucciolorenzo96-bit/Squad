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

/* ======================= Gli avvisi di assenza =======================
 *
 * Una cosa diversa dalla presenza, e per questo una tabella diversa: la
 * presenza la constata chi sta in palestra, l'avviso lo da' prima la famiglia.
 * Serve all'allenatore per sapere, mentre prepara la seduta, che stasera sono
 * in nove. Se poi il ragazzo si presenta lo stesso, il foglio dice presente:
 * l'avviso non decide niente, informa.
 */

export async function fetchAbsenceNotices(trainingIds) {
  if (!trainingIds || trainingIds.length === 0) return [];
  const { data, error } = await supabase.from('training_absence_notices')
    .select('*').in('training_id', trainingIds);
  if (error) throw error;
  return data;
}

export async function announceAbsence(trainingId, playerId, note, userId) {
  const { data, error } = await supabase.from('training_absence_notices')
    .upsert({
      training_id: trainingId, player_id: playerId,
      note: (note || '').trim() || null, created_by: userId
    })
    .select().single();
  if (error) throw descriviErroreAvviso(error);
  return data;
}

export async function cancelAbsenceNotice(trainingId, playerId) {
  const { error } = await supabase.from('training_absence_notices')
    .delete().eq('training_id', trainingId).eq('player_id', playerId);
  if (error) throw descriviErroreAvviso(error);
}

function descriviErroreAvviso(error) {
  const msg = (error && error.message) || '';
  if (/training_absence_notices/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Mancano gli avvisi di assenza: esegui la migrazione 041 su Supabase, poi riprova.');
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error('Si può avvisare solo per il proprio atleta, e solo per un allenamento non ancora passato.');
  }
  return error;
}

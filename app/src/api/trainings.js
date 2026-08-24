import { supabase } from '../supabaseClient.js';

export async function fetchTrainings(sectorId) {
  const { data, error } = await supabase.from('trainings').select('*').eq('sector_id', sectorId).order('date');
  if (error) throw error;
  return data;
}

export async function addTraining(teamId, sectorId, training) {
  const { data, error } = await supabase.from('trainings')
    .insert({ team_id: teamId, sector_id: sectorId, ...training }).select().single();
  if (error) throw error;
  return data;
}

export async function updateTraining(id, training) {
  const { data, error } = await supabase.from('trainings').update(training).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeTraining(id) {
  const { error } = await supabase.from('trainings').delete().eq('id', id);
  if (error) throw error;
}

import { supabase } from '../supabaseClient.js';

export async function fetchTrainings(sectorId, seasonId) {
  let q = supabase.from('trainings').select('*').eq('sector_id', sectorId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q.order('date');
  if (error) throw error;
  return data;
}

// Allenamenti di una singola data su TUTTI i settori: il resto dell'app lavora
// per settore attivo, il pannello "Oggi" ha invece bisogno della giornata
// intera della società. Le RLS filtrano già ai settori accessibili.
export async function fetchTrainingsForDate(teamId, date) {
  const { data, error } = await supabase.from('trainings')
    .select('*, sectors(name)')
    .eq('team_id', teamId).eq('date', date)
    .order('start_time', { nullsFirst: false });
  if (error) throw error;
  return data;
}

// I luoghi gia' usati dalla societa', per proporli invece di farli riscrivere:
// e' il modo meno invadente di far convergere le grafie senza costringere
// nessuno a gestire un elenco di impianti.
export async function fetchKnownLocations(teamId) {
  const { data, error } = await supabase.from('trainings')
    .select('location').eq('team_id', teamId).not('location', 'is', null)
    .order('date', { ascending: false }).limit(300);
  if (error) throw error;
  const visti = new Map();
  data.forEach(r => {
    const k = (r.location || '').trim().toLowerCase();
    if (k && !visti.has(k)) visti.set(k, r.location.trim());
  });
  return [...visti.values()].sort((x, y) => x.localeCompare(y));
}

export async function addTraining(teamId, sectorId, training, seasonId) {
  const { data, error } = await supabase.from('trainings')
    .insert({ team_id: teamId, sector_id: sectorId, season_id: seasonId || null, ...training })
    .select().single();
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

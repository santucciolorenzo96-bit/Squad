import { supabase } from '../supabaseClient.js';

// La stagione sportiva: da luglio a giugno, playoff compresi. È il perimetro
// entro cui hanno senso statistiche, classifica, presenze e rose — senza,
// i numeri di anni diversi si sommano fra loro.

export async function fetchSeasons(teamId) {
  const { data, error } = await supabase.from('seasons')
    .select('*').eq('team_id', teamId).order('start_date', { ascending: false });
  if (error) throw describeSeasonError(error);
  return data;
}

export async function createSeason(teamId, { name, start_date, end_date }) {
  const { data, error } = await supabase.from('seasons')
    .insert({ team_id: teamId, name, start_date, end_date }).select().single();
  if (error) throw error;
  return data;
}

// Scadenze e nome si correggono anche a stagione avviata: l'iscrizione ai
// campionati e il tesseramento arrivano spesso dopo che la stagione è aperta.
export async function updateSeason(id, patch) {
  const { data, error } = await supabase.from('seasons')
    .update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function removeSeason(id) {
  const { error } = await supabase.from('seasons').delete().eq('id', id);
  if (error) throw error;
}

// Chiusura: archivia la stagione, ne apre una nuova e ci porta dentro le
// persone secondo le assegnazioni decise a mano. Chi non è nell'elenco resta
// in anagrafica e nello storico, semplicemente non nella nuova rosa.
export async function closeSeasonAndOpen(closingId, { name, start_date, end_date }, assignments) {
  const { data, error } = await supabase.rpc('close_season_and_open', {
    p_closing_season_id: closingId,
    p_new_name: name,
    p_new_start: start_date,
    p_new_end: end_date,
    p_assignments: assignments || []
  });
  if (error) throw error;
  return data;
}

function describeSeasonError(error) {
  const msg = (error && error.message) || '';
  if (/seasons/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la tabella seasons: esegui la migrazione 021 su Supabase, poi riprova.');
  }
  return error;
}

// Giorni che mancano a una data, negativi se è passata.
export function daysTo(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

// La stagione su cui lavorare: quella aperta più recente, altrimenti la più
// recente in assoluto — una società che ha chiuso tutto deve comunque vedere
// qualcosa invece di una schermata vuota.
export function pickActiveSeason(seasons) {
  if (!seasons || seasons.length === 0) return null;
  return seasons.find(s => !s.closed) || seasons[0];
}

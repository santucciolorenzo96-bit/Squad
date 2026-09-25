import { supabase } from '../supabaseClient.js';
import { oggiISO } from '../utils/format.js';

// La parte scritta della scheda evolutiva. Il resto (presenze, valutazione,
// medie) si calcola dai dati già in memoria: non va salvato, invecchierebbe.
export async function fetchDevelopment(playerId) {
  const { data, error } = await supabase.from('player_development')
    .select('*').eq('player_id', playerId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveDevelopment(teamId, playerId, fields) {
  const patch = {
    player_id: playerId,
    team_id: teamId,
    objective: fields.objective || null,
    coach_note: fields.coach_note || null,
    updated_at: new Date().toISOString()
  };
  // La data dell'obiettivo si aggiorna solo quando l'obiettivo cambia davvero,
  // così "fissato il ..." resta una data vera e non l'ultimo salvataggio.
  if (fields.objective_changed) {
    patch.objective_set_at = fields.objective ? oggiISO() : null;
  }
  if (fields.updated_by) patch.updated_by = fields.updated_by;

  const { data, error } = await supabase.from('player_development')
    .upsert(patch, { onConflict: 'player_id' }).select().single();
  if (error) throw error;
  return data;
}

/* ======================= Gli obiettivi (migrazione 043) =======================
 *
 * Prima l'obiettivo era un campo solo: scriverne uno nuovo cancellava il
 * precedente, e di quello che un ragazzo aveva migliorato in due anni non
 * restava niente. Adesso sono righe — quello in corso e' l'ultimo senza data
 * di raggiungimento, gli altri sono la sua storia.
 *
 * La decisione resta dell'allenatore: scrive lui, spunta lui. Il ragazzo
 * legge, ci lavora, e vede l'elenco di quello che ha gia' chiuso.
 */

export async function fetchObjectives(playerId) {
  const { data, error } = await supabase.from('player_objectives')
    .select('*').eq('player_id', playerId)
    .order('set_at', { ascending: false }).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addObjective(teamId, playerId, testo, userId) {
  const { data, error } = await supabase.from('player_objectives')
    .insert({ team_id: teamId, player_id: playerId, testo: String(testo).trim(), set_by: userId })
    .select().single();
  if (error) throw descriviErroreObiettivo(error);
  return data;
}

export async function achieveObjective(id, userId) {
  const { data, error } = await supabase.from('player_objectives')
    .update({ achieved_at: oggiISO(), achieved_by: userId })
    .eq('id', id).select().single();
  if (error) throw descriviErroreObiettivo(error);
  return data;
}

// Rimettere in corso un obiettivo spuntato per sbaglio: un tocco si sbaglia,
// e senza questa l'unica strada sarebbe riscriverlo da capo perdendo la data.
export async function reopenObjective(id) {
  const { data, error } = await supabase.from('player_objectives')
    .update({ achieved_at: null, achieved_by: null })
    .eq('id', id).select().single();
  if (error) throw descriviErroreObiettivo(error);
  return data;
}

export async function removeObjective(id) {
  const { error } = await supabase.from('player_objectives').delete().eq('id', id);
  if (error) throw descriviErroreObiettivo(error);
}

function descriviErroreObiettivo(error) {
  const msg = (error && error.message) || '';
  if (/player_objectives/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Mancano gli obiettivi: esegui la migrazione 043 su Supabase, poi riprova.');
  }
  return error;
}

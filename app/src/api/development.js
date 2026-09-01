import { supabase } from '../supabaseClient.js';

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
    patch.objective_set_at = fields.objective ? new Date().toISOString().slice(0, 10) : null;
  }
  if (fields.updated_by) patch.updated_by = fields.updated_by;

  const { data, error } = await supabase.from('player_development')
    .upsert(patch, { onConflict: 'player_id' }).select().single();
  if (error) throw error;
  return data;
}

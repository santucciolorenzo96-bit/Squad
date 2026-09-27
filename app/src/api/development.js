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

/* ============ La scheda di allenamento (migrazione 050) ============
 *
 * Il programma della sala pesi. Sta accanto all'obiettivo perche' e' la stessa
 * cosa detta in modo operativo: l'obiettivo dice dove si va, la scheda dice
 * come. La carica il tecnico, la apre e la scarica anche l'atleta — una scheda
 * che chi si allena non puo' aprire non serve a niente.
 *
 * Non e' un documento: i documenti hanno uno stato, una scadenza e
 * un'approvazione, e servono a rispondere a «questo ragazzo puo' giocare?».
 * Una scheda non si approva e non scade, si sostituisce.
 */

// Quanto puo' pesare. Una scansione A4 a colori sta sotto i due megabyte; sopra
// i dieci c'e' quasi sempre una fotografia non ridotta, e in palestra si
// scarica con la rete che c'e'.
export const MAX_SCHEDA_MB = 10;

export const TIPI_SCHEDA = 'image/*,application/pdf';

export async function fetchTrainingPlans(playerId) {
  const { data, error } = await supabase.from('player_training_plans')
    .select('*').eq('player_id', playerId).order('uploaded_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function uploadTrainingPlan(teamId, playerId, file, { titolo, nota, userId }) {
  const pulito = String(file.name || 'scheda').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-60);
  const path = `${teamId}/${playerId}/${Date.now()}_${pulito}`;
  const { error: upErr } = await supabase.storage.from('training-plans')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (upErr) throw descriviErroreScheda(upErr);

  const { data, error } = await supabase.from('player_training_plans').insert({
    team_id: teamId, player_id: playerId,
    titolo: String(titolo || '').trim() || 'Scheda di allenamento',
    nota: (nota || '').trim() || null,
    file_path: path, file_name: file.name || pulito,
    mime: file.type || null, bytes: file.size || null,
    uploaded_by: userId
  }).select().single();
  if (error) {
    // La riga non e' entrata: il file da solo non lo vede nessuno, e resterebbe
    // li' per sempre. Stesso rimedio del giocatore creato a meta'.
    try { await supabase.storage.from('training-plans').remove([path]); } catch (e) { /* pazienza */ }
    throw descriviErroreScheda(error);
  }
  return data;
}

export async function removeTrainingPlan(piano) {
  const { error } = await supabase.from('player_training_plans').delete().eq('id', piano.id);
  if (error) throw descriviErroreScheda(error);
  if (piano.file_path) {
    try { await supabase.storage.from('training-plans').remove([piano.file_path]); } catch (e) { /* pazienza */ }
  }
}

/* Due indirizzi diversi per due gesti diversi: aprire e scaricare.
 *
 * `download` fa arrivare il file con l'intestazione che dice al browser di
 * salvarlo invece di mostrarlo. Senza, su telefono un PDF si apre nel visore e
 * non resta niente sul dispositivo — e la scheda serve proprio quando la rete
 * in palestra non c'e'. Un'ora di validita': il tempo di un allenamento.
 */
export async function getTrainingPlanUrl(filePath, { scarica = false, nome } = {}) {
  const { data, error } = await supabase.storage.from('training-plans')
    .createSignedUrl(filePath, 3600, scarica ? { download: nome || true } : undefined);
  if (error) throw descriviErroreScheda(error);
  return data.signedUrl;
}

function descriviErroreScheda(error) {
  const msg = (error && error.message) || '';
  if (/Bucket not found/i.test(msg)) {
    return new Error('Manca il deposito delle schede: esegui la migrazione 050 su Supabase, poi riprova.');
  }
  if (/player_training_plans/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la scheda di allenamento: esegui la migrazione 050 su Supabase, poi riprova.');
  }
  if (/row-level security|violates row-level/i.test(msg)) {
    return new Error('Per caricare una scheda servono i permessi su questa categoria.');
  }
  return error;
}

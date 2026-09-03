import { supabase } from '../supabaseClient.js';

// Versione dell'informativa accettata. Cambiandola, a tutti viene richiesto di
// accettare di nuovo: è il modo in cui un consenso resta dimostrabile anche
// dopo un aggiornamento del testo.
export const PRIVACY_VERSION = '2026-09';

export async function acceptPrivacy() {
  const { error } = await supabase.rpc('accept_privacy', { p_version: PRIVACY_VERSION });
  if (error) throw error;
}

// Tutto ciò che l'app conserva su un atleta, in un colpo solo: serve a
// rispondere a una richiesta di accesso senza cercare tabella per tabella,
// che è il modo in cui si dimentica qualcosa.
export async function fetchPlayerPersonalData(playerId) {
  const { data, error } = await supabase.rpc('player_personal_data', { p_player_id: playerId });
  if (error) throw error;
  return data;
}

// Anonimizza l'atleta ovunque compaia ed elimina i documenti sanitari. I
// movimenti contabili restano, senza nome: la legge impone di conservarli.
export async function erasePlayer(playerId, reason) {
  const { error } = await supabase.rpc('erase_player', { p_player_id: playerId, p_reason: reason || null });
  if (error) throw error;
}

import { supabase } from '../supabaseClient.js';

// Inviti nominativi. Il codice società resta quello che è — uno solo, uguale
// per tutti, permanente — e serve a far entrare chiunque. Un invito serve a
// far entrare una persona precisa già col suo ruolo, le sue categorie e, se è
// un genitore o un atleta, già collegata alla scheda giusta.

export async function fetchInvites() {
  const { data, error } = await supabase.from('invites')
    .select('*, players(name, number), profiles:used_by(display_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createInvite({ role, playerId, sectorIds, label, note, daysValid, maxUses }) {
  const base = {
    p_role: role,
    p_player_id: playerId || null,
    p_sector_ids: sectorIds || [],
    p_label: label || null,
    p_note: note || null,
    p_days_valid: daysValid == null ? 14 : daysValid
  };
  const posti = maxUses == null ? 1 : maxUses;
  // Quanti possono entrare con questo codice. Uno e` l'invito nominativo di
  // sempre; piu` di uno e` un codice che si manda a un gruppo, e chi lo usa
  // aspetta conferma (migrazione 064).
  const { data, error } = await supabase.rpc('create_invite', { ...base, p_max_uses: posti });
  if (!error) return data;

  /* IL CODICE E` IN PRODUZIONE PRIMA DELLA MIGRAZIONE.
     Le migrazioni si lanciano a mano, quindi fra il momento in cui questa
     versione e` online e il momento in cui 064 e` stata eseguita c'e` una
     finestra. Senza questo ripiego, in quella finestra NESSUNO potrebbe piu`
     creare un invito — nemmeno un amministratore, con la schermata che c'era
     prima e che funzionava. Un invito nominativo non ha bisogno di niente di
     nuovo: si rifa` la chiamata di prima. Un codice condiviso si` — e allora
     si dice che cosa manca. */
  if (!mancaLa064(error)) throw error;
  if (posti > 1) throw erroreMigrazione();
  const vecchio = await supabase.rpc('create_invite', base);
  if (vecchio.error) throw vecchio.error;
  return vecchio.data;
}

function mancaLa064(error) {
  const msg = (error && error.message) || '';
  return /create_invite|join_team_with_invite|p_max_uses|p_claim/.test(msg)
    && /does not exist|schema cache|without parameters|no function matches/i.test(msg);
}

function erroreMigrazione() {
  return new Error('Manca il codice di categoria: esegui la migrazione 064 su Supabase, poi riprova.');
}

function descriviErroreInvito(error) {
  return mancaLa064(error) ? erroreMigrazione() : error;
}

/* Entrare con un invito.
 *
 * `p_claim` e` il nome con cui chi entra dice di essere in rosa: con un codice
 * condiviso e` l'unica cosa che ha, chi conferma, per riconoscerlo. Prima
 * della 064 quel parametro non esiste, e allora si entra come si entrava —
 * perche` un invito nominativo porta gia` dentro la scheda, e il nome non
 * serviva a nessuno. */
export async function entraConInvito(code, displayName, claim) {
  const { error } = await supabase.rpc('join_team_with_invite', {
    p_code: code, p_display_name: displayName, p_claim: claim || null
  });
  if (!error) return;
  if (!mancaLa064(error)) throw error;
  const { error: vecchio } = await supabase.rpc('join_team_with_invite', {
    p_code: code, p_display_name: displayName
  });
  if (vecchio) throw vecchio;
}

export async function revokeInvite(inviteId) {
  const { error } = await supabase.rpc('revoke_invite', { p_invite_id: inviteId });
  if (error) throw descriviErroreInvito(error);
}

// Anteprima prima della registrazione: non c'è ancora nessuna sessione.
// Restituisce null se il codice non esiste, è scaduto, revocato o già usato —
// il server non distingue fra questi casi e non deve.
export async function fetchInvitePreview(code) {
  const clean = (code || '').trim();
  if (!clean) return null;
  const { data, error } = await supabase.rpc('invite_preview', { p_code: clean });
  if (error) throw error;
  return (data && data.length) ? data[0] : null;
}

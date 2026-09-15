import { supabase } from '../supabaseClient.js';

/* I codici di attivazione, dal lato dell'app.
 *
 * Tutto passa da funzioni SECURITY DEFINER: la tabella `platform_codes` non ha
 * policy, quindi da qui non è leggibile né scrivibile in nessun altro modo.
 * Il controllo su chi può fare cosa sta là dentro, non qui — questo file è
 * solo il telefono, non il portiere.
 */

export async function amIPlatformOwner() {
  const { data, error } = await supabase.rpc('am_i_platform_owner');
  if (error) return false;          // in dubbio, il pannello non compare
  return data === true;
}

export async function createActivationCode(label, days) {
  const { data, error } = await supabase.rpc('create_activation_code', {
    p_label: label || null,
    p_days: days || 30
  });
  if (error) throw error;
  return data;
}

export async function listActivationCodes() {
  const { data, error } = await supabase.rpc('list_activation_codes');
  if (error) throw error;
  return data || [];
}

export async function revokeActivationCode(code) {
  const { error } = await supabase.rpc('revoke_activation_code', { p_code: code });
  if (error) throw error;
}

// L'anagrafe delle societa': nome, sport, citta', quando sono nate, quante
// persone ci sono. NON i loro dati — rose, documenti e conti restano di chi ne
// fa parte, e la funzione nel database non li restituisce nemmeno volendo.
export async function listSocieties() {
  const { data, error } = await supabase.rpc('list_societies');
  if (error) throw error;
  return data || [];
}

/* Entrare in una societa'.
 *
 * Nessun permesso viene copiato o duplicato: il database risponde in modo
 * diverso a due domande — di quale societa' faccio parte, e con che ruolo — e
 * tutte le policy gia' scritte si allineano da sole. Vedi la migrazione 030.
 *
 * Dopo essere entrati (o usciti) si ricarica la pagina: l'app tiene la societa'
 * in memoria fin dall'avvio, e cambiargliela sotto vorrebbe dire rincorrere
 * dieci cose che si sono gia' caricate.
 */
const SEGNALINO = 'squad_ospite';

// Un segno lasciato nel browser: all'avvio dice che vale la pena chiedere al
// database dove siamo, anche a chi un profilo suo ce l'ha. Senza, un
// SuperAdmin che ha anche una societa' propria entrerebbe altrove e
// continuerebbe a vedere la sua.
export function segnoOspite() {
  try { return window.localStorage.getItem(SEGNALINO); } catch (e) { return null; }
}

export async function enterSociety(teamId) {
  const { data, error } = await supabase.rpc('enter_society', { p_team_id: teamId });
  if (error) throw error;
  try { window.localStorage.setItem(SEGNALINO, teamId); } catch (e) { /* niente */ }
  return data;
}

export async function leaveSociety() {
  const { error } = await supabase.rpc('leave_society');
  try { window.localStorage.removeItem(SEGNALINO); } catch (e) { /* niente */ }
  if (error) throw error;
}

// Dove sono adesso: { team_id, name, city, entered_at } oppure null.
export async function currentSociety() {
  const { data, error } = await supabase.rpc('current_society');
  if (error) return null;
  return data || null;
}

// Chi e' entrato in questa societa', e quando.
export async function societyVisits(teamId) {
  const { data, error } = await supabase.rpc('society_visits', { p_team_id: teamId });
  if (error) throw error;
  return data || [];
}

/* Gli account della piattaforma.
 *
 * `auth.users` dal client non si raggiunge in nessun altro modo: passa tutto
 * da due funzioni che controllano chi chiama prima di rispondere.
 */
export async function listAccounts() {
  const { data, error } = await supabase.rpc('list_accounts');
  if (error) throw error;
  return data || [];
}

// `ancheOwner` e' la seconda conferma per cancellare un altro amministratore
// di piattaforma: senza, il database si rifiuta.
export async function deleteAccount(userId, ancheOwner) {
  const { data, error } = await supabase.rpc('delete_account', {
    p_user_id: userId,
    p_anche_owner: !!ancheOwner
  });
  if (error) throw error;
  return data;
}

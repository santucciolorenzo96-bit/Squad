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

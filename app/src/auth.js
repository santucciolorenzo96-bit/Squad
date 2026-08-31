import { supabase } from './supabaseClient.js';

const PENDING_KEY = 'bbapp_pending_team_action';

// Se Supabase richiede la conferma email, subito dopo signUp non c'è ancora una sessione:
// l'azione (creare/entrare in una squadra) va rimandata al primo login effettivo, dopo che
// l'utente ha cliccato il link di conferma ricevuto via email.
function savePendingAction(action) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(action));
}

export function getPendingAction() {
  const raw = localStorage.getItem(PENDING_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function clearPendingAction() {
  localStorage.removeItem(PENDING_KEY);
}

export async function runPendingAction(action) {
  if (action.type === 'create_team') {
    const { error } = await supabase.rpc('create_team', {
      p_name: action.teamName, p_city: action.city, p_category: action.category,
      p_display_name: action.displayName
    });
    if (error) throw error;
  } else if (action.type === 'join_team') {
    const { error } = await supabase.rpc('join_team', {
      p_invite_code: action.inviteCode, p_display_name: action.displayName, p_role: action.role || 'genitore'
    });
    if (error) throw error;
  }
  clearPendingAction();
}

export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function createTeamAndAdmin({ email, password, teamName, city, category, displayName }) {
  const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) throw signUpErr;
  const action = { type: 'create_team', teamName, city, category, displayName };
  if (!data.session) { savePendingAction(action); return { needsEmailConfirmation: true }; }
  await runPendingAction(action);
  return { needsEmailConfirmation: false };
}

export async function joinTeamByCode({ email, password, inviteCode, displayName, role }) {
  const { data, error: signUpErr } = await supabase.auth.signUp({ email, password });
  if (signUpErr) throw signUpErr;
  const action = { type: 'join_team', inviteCode, displayName, role: role || 'genitore' };
  if (!data.session) { savePendingAction(action); return { needsEmailConfirmation: true }; }
  await runPendingAction(action);
  return { needsEmailConfirmation: false };
}

export async function changePassword(email, oldPassword, newPassword) {
  const { error: reauthErr } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
  if (reauthErr) throw new Error('Password attuale errata.');
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function requestPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) throw error;
}

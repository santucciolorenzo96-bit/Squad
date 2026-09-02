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
  try { return raw ? JSON.parse(raw) : null; }
  catch (e) { localStorage.removeItem(PENDING_KEY); return null; }
}

export function clearPendingAction() {
  localStorage.removeItem(PENDING_KEY);
}

export async function runPendingAction(action) {
  if (action.type === 'create_team') {
    const { error } = await supabase.rpc('create_team', {
      p_name: action.teamName, p_city: action.city, p_category: action.category,
      p_display_name: action.displayName, p_sport: action.sport || 'basket'
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

// Il link di conferma deve riportare all'indirizzo da cui ci si è registrati.
// Senza questo Supabase usa la "Site URL" del progetto, che di default è
// http://localhost:3000: da un telefono quel link apre una pagina morta.
function redirectTarget() {
  return window.location.origin;
}

// Con la conferma email attiva Supabase risponde "ok" anche quando l'indirizzo
// è GIÀ registrato: lo fa apposta, per non rivelare chi ha un account. L'unico
// segnale è `identities` vuoto. Senza questo controllo l'utente resta fermo su
// "conferma la tua email" ad aspettare un messaggio che non parte, e più
// riprova più sembra che la registrazione sia rotta.
function isExistingUser(data) {
  return !!(data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0);
}

export class EmailAlreadyRegisteredError extends Error {
  constructor() {
    super('Questa email è già registrata. Accedi con la tua password: se non la ricordi usa "Password dimenticata?".');
    this.name = 'EmailAlreadyRegisteredError';
  }
}

async function signUpUser(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { emailRedirectTo: redirectTarget() }
  });
  if (error) throw error;
  if (isExistingUser(data)) throw new EmailAlreadyRegisteredError();
  return data;
}

// Rimanda il link di conferma: serve quando la prima email non arriva o scade.
export async function resendConfirmation(email) {
  const { error } = await supabase.auth.resend({
    type: 'signup', email,
    options: { emailRedirectTo: redirectTarget() }
  });
  if (error) throw error;
}

export async function login(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export async function createTeamAndAdmin({ email, password, teamName, city, category, displayName, sport }) {
  const data = await signUpUser(email, password);
  const action = { type: 'create_team', teamName, city, category, displayName, sport: sport || 'basket' };
  if (!data.session) { savePendingAction(action); return { needsEmailConfirmation: true }; }
  await runPendingAction(action);
  return { needsEmailConfirmation: false };
}

export async function joinTeamByCode({ email, password, inviteCode, displayName, role }) {
  const data = await signUpUser(email, password);
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
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTarget() });
  if (error) throw error;
}

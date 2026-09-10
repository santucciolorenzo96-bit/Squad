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
    const { error } = await supabase.rpc('create_team_with_code', {
      p_code: action.code || '', p_name: action.teamName, p_city: action.city,
      p_category: action.category, p_display_name: action.displayName,
      p_sport: action.sport || 'basket'
    });
    if (error) throw error;
  } else if (action.type === 'join_team') {
    const { error } = await supabase.rpc('join_team', {
      p_invite_code: action.inviteCode, p_display_name: action.displayName, p_role: action.role || 'genitore'
    });
    if (error) throw error;
  } else if (action.type === 'join_invite') {
    // Ruolo, categorie e collegamento alla scheda sono gia' scritti
    // nell'invito: qui non si sceglie piu' niente.
    const { error } = await supabase.rpc('join_team_with_invite', {
      p_code: action.inviteCode, p_display_name: action.displayName
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

// Senza conferma email Supabase non finge più: risponde con un errore in
// chiaro, ma in inglese. Diventa lo stesso messaggio dell'altro caso, perché
// per chi si registra la situazione è identica.
function isAlreadyRegisteredError(error) {
  const msg = (error && error.message) || '';
  return /already registered|already exists|user_already_exists/i.test(msg);
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
  if (error) throw isAlreadyRegisteredError(error) ? new EmailAlreadyRegisteredError() : error;
  if (isExistingUser(data)) throw new EmailAlreadyRegisteredError();
  return data;
}

// Con la conferma attiva l'iscrizione alla squadra è rimandata al primo
// accesso; senza, parte subito dopo la registrazione. In quel secondo caso, se
// fallisce — un codice invito sbagliato — l'account è già creato ma senza
// squadra, e riprovare dalla stessa schermata darebbe "email già registrata":
// un vicolo cieco. Marcare l'errore permette alle schermate di portare
// l'utente al recupero, dove la sessione aperta basta a completare.
async function runActionAfterSignup(action) {
  try {
    await runPendingAction(action);
  } catch (e) {
    e.accountCreated = true;
    throw e;
  }
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

// Il codice di attivazione viaggia con l'azione in sospeso: se la conferma
// dell'email arriva domani, la societa' si crea domani, e senza il codice il
// database la rifiuterebbe.
export async function createTeamAndAdmin({ email, password, activationCode, teamName, city, category, displayName, sport }) {
  const data = await signUpUser(email, password);
  const action = { type: 'create_team', code: activationCode, teamName, city, category, displayName, sport: sport || 'basket' };
  if (!data.session) { savePendingAction(action); return { needsEmailConfirmation: true }; }
  await runActionAfterSignup(action);
  return { needsEmailConfirmation: false };
}

// `personale` distingue un invito nominativo dal codice societa'. Sono due
// strade diverse fin dentro il database: il codice societa' fa scegliere il
// ruolo a chi si registra, l'invito ce l'ha gia' dentro.
export async function joinTeamByCode({ email, password, inviteCode, displayName, role, personale }) {
  const data = await signUpUser(email, password);
  const action = personale
    ? { type: 'join_invite', inviteCode, displayName }
    : { type: 'join_team', inviteCode, displayName, role: role || 'genitore' };
  if (!data.session) { savePendingAction(action); return { needsEmailConfirmation: true }; }
  await runActionAfterSignup(action);
  return { needsEmailConfirmation: false };
}

// Il codice di attivazione si verifica PRIMA del modulo: scoprire che non va
// bene dopo aver scritto nome, email e password e' il modo migliore per far
// chiudere la pagina a qualcuno che aveva diritto di entrare.
export async function checkActivationCode(code) {
  const { data, error } = await supabase.rpc('activation_code_ok', { p_code: (code || '').trim().toUpperCase() });
  if (error) return false;
  return data === true;
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

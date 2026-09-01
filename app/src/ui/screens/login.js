import { login, requestPasswordReset } from '../../auth.js';
import { toast } from '../modal.js';

export function renderLogin() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:360px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>
    <div class="card">
      <h2>Accesso</h2>
      <div class="field"><label>Email</label><input type="email" id="lEmail" autocomplete="username"></div>
      <div class="field"><label>Password</label><input type="password" id="lPass" autocomplete="current-password"></div>
      <div class="error-msg" id="lError"></div>
      <button class="btn btn-primary" id="lSubmit">Accedi</button>
      <button class="btn btn-ghost" id="lForgot" style="width:100%;margin-top:8px;">Password dimenticata?</button>
    </div>
    <button class="btn btn-ghost" id="lBack" style="width:100%;">← Indietro</button>
  </div></div>`;

  async function doLogin() {
    const errEl = document.getElementById('lError');
    const email = document.getElementById('lEmail').value.trim();
    const pass = document.getElementById('lPass').value;
    if (!email || !pass) { errEl.textContent = 'Inserisci email e password.'; return; }
    try {
      await login(email, pass);
      const { boot } = await import('../../router.js');
      await boot();
    } catch (e) {
      // Prima ogni errore diventava "email o password errati": chi non aveva
      // ancora confermato l'indirizzo credeva che la registrazione fosse fallita
      // e ricominciava da capo, invece di cercare la mail di conferma.
      const msg = (e && e.message) || '';
      if (/email not confirmed|not confirmed/i.test(msg)) {
        errEl.innerHTML = 'Devi prima confermare la tua email: apri il link che ti abbiamo inviato.';
        showResend(email);
      } else if (/invalid login credentials/i.test(msg)) {
        errEl.textContent = 'Email o password errati.';
      } else {
        errEl.textContent = msg || 'Accesso non riuscito.';
      }
    }
  }

  // Il link di conferma scade e la prima email può non arrivare: senza un modo
  // per rimandarla l'unica via era registrarsi di nuovo, che con un indirizzo
  // già esistente non produce nessuna mail.
  function showResend(email) {
    if (document.getElementById('lResend')) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.id = 'lResend';
    btn.style.cssText = 'width:100%;margin-top:8px;';
    btn.textContent = 'Invia di nuovo l\'email di conferma';
    btn.onclick = async () => {
      const { resendConfirmation } = await import('../../auth.js');
      try {
        await resendConfirmation(email);
        toast('Email di conferma inviata di nuovo, controlla la posta');
      } catch (err) {
        document.getElementById('lError').textContent =
          (err && err.message) || 'Non è stato possibile inviare di nuovo l\'email.';
      }
    };
    document.getElementById('lError').after(btn);
  }
  document.getElementById('lSubmit').onclick = doLogin;
  document.getElementById('lPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
  document.getElementById('lForgot').onclick = async () => {
    const email = document.getElementById('lEmail').value.trim();
    if (!email) { document.getElementById('lError').textContent = 'Inserisci la tua email per ricevere il link di reset.'; return; }
    try {
      await requestPasswordReset(email);
      toast('Email di reset inviata, controlla la posta');
    } catch (e) {
      document.getElementById('lError').textContent = 'Impossibile inviare la email di reset.';
    }
  };
  document.getElementById('lBack').onclick = async () => {
    const { renderLanding } = await import('./landing.js');
    renderLanding();
  };
}

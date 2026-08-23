import { login, requestPasswordReset } from '../../auth.js';
import { toast } from '../modal.js';

export function renderLogin() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:360px;width:100%;">
    <div class="brand-header"><span style="font-size:30px;">🏀</span><div class="brand-name">Team Manager</div></div>
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
      errEl.textContent = 'Email o password errati.';
    }
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

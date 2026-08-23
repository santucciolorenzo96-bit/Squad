import { esc } from '../../utils/format.js';

export function renderConfirmEmailNotice(email) {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:380px;width:100%;">
    <div class="brand-header"><span style="font-size:30px;">🏀</span><div class="brand-name">Team Manager</div></div>
    <div class="card">
      <h2>Conferma la tua email</h2>
      <p style="font-size:13px;color:var(--dim);line-height:1.5;">
        Abbiamo inviato un link di conferma a <b>${esc(email)}</b>. Aprilo, poi torna qui e accedi:
        la squadra verrà completata automaticamente al primo login.
      </p>
    </div>
    <button class="btn btn-primary" id="ceBackToLogin">Vai al login</button>
  </div></div>`;
  document.getElementById('ceBackToLogin').onclick = async () => {
    const { renderLogin } = await import('./login.js');
    renderLogin();
  };
}

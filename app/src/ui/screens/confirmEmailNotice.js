import { esc } from '../../utils/format.js';
import { toast } from '../modal.js';
import { resendConfirmation } from '../../auth.js';

export function renderConfirmEmailNotice(email) {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:380px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>
    <div class="card">
      <h2>Conferma la tua email</h2>
      <p style="font-size:13px;color:var(--dim);line-height:1.5;">
        Abbiamo inviato un link di conferma a <b>${esc(email)}</b>. Aprilo, poi torna qui e accedi:
        la squadra verrà completata automaticamente al primo login.
      </p>
      <p style="font-size:12.5px;color:var(--dim);line-height:1.5;">
        Se non lo trovi, controlla la posta indesiderata. Conviene aprire il link
        <b>sullo stesso dispositivo</b> da cui ti sei registrato: se lo apri altrove
        ti verrà chiesto il codice invito una seconda volta.
      </p>
      <div class="error-msg" id="ceError"></div>
      <button class="btn btn-secondary" id="ceResend" style="width:100%;">Non è arrivata, rimandala</button>
    </div>
    <button class="btn btn-primary" id="ceBackToLogin">Vai al login</button>
  </div></div>`;

  document.getElementById('ceResend').onclick = async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await resendConfirmation(email);
      toast('Email inviata di nuovo, controlla la posta');
    } catch (err) {
      document.getElementById('ceError').textContent =
        (err && err.message) || 'Non è stato possibile inviare di nuovo l\'email.';
    } finally {
      btn.disabled = false;
    }
  };

  document.getElementById('ceBackToLogin').onclick = async () => {
    const { renderLogin } = await import('./login.js');
    renderLogin();
  };
}

import { createTeamAndAdmin } from '../../auth.js';
import { toast } from '../modal.js';
import { renderConfirmEmailNotice } from './confirmEmailNotice.js';

export function renderCreateTeam() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:420px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-primary.svg" alt="SQUAD"><div class="brand-name">SQUAD</div></div>
    <div class="card">
      <h2>Passo 1 · Dati della squadra</h2>
      <div class="field"><label>Nome squadra *</label><input type="text" id="wTeamName" placeholder="Es. Basket Catania"></div>
      <div class="row2">
        <div class="field"><label>Città</label><input type="text" id="wCity" placeholder="Es. Catania"></div>
        <div class="field"><label>Categoria</label><input type="text" id="wCategory" placeholder="Es. Serie D"></div>
      </div>
      <div class="hint">Potrai caricare il logo della società dopo, dalla sezione Squadra.</div>
    </div>
    <div class="card">
      <h2>Passo 2 · Il tuo account (amministratore)</h2>
      <div class="field"><label>Nome e cognome</label><input type="text" id="wAdminName" placeholder="Es. Lorenzo Santuccio"></div>
      <div class="field"><label>Email</label><input type="email" id="wAdminEmail" autocomplete="username"></div>
      <div class="row2">
        <div class="field"><label>Password</label><input type="password" id="wAdminPass" autocomplete="new-password"></div>
        <div class="field"><label>Conferma password</label><input type="password" id="wAdminPass2" autocomplete="new-password"></div>
      </div>
      <div class="error-msg" id="wError"></div>
    </div>
    <button class="btn btn-primary" id="wSubmit">Crea squadra e account</button>
    <button class="btn btn-ghost" id="wBack" style="width:100%;margin-top:8px;">← Indietro</button>
  </div></div>`;

  document.getElementById('wSubmit').onclick = async () => {
    const errEl = document.getElementById('wError');
    const teamName = document.getElementById('wTeamName').value.trim();
    const city = document.getElementById('wCity').value.trim();
    const category = document.getElementById('wCategory').value.trim();
    const displayName = document.getElementById('wAdminName').value.trim();
    const email = document.getElementById('wAdminEmail').value.trim();
    const pass1 = document.getElementById('wAdminPass').value;
    const pass2 = document.getElementById('wAdminPass2').value;

    if (!teamName) { errEl.textContent = 'Inserisci il nome della squadra.'; return; }
    if (!displayName || !email) { errEl.textContent = 'Inserisci nome ed email amministratore.'; return; }
    if (pass1.length < 6) { errEl.textContent = 'La password deve avere almeno 6 caratteri.'; return; }
    if (pass1 !== pass2) { errEl.textContent = 'Le password non coincidono.'; return; }

    try {
      const result = await createTeamAndAdmin({ email, password: pass1, teamName, city, category, displayName });
      if (result.needsEmailConfirmation) {
        renderConfirmEmailNotice(email);
        return;
      }
      toast('Squadra creata!');
      const { boot } = await import('../../router.js');
      await boot();
    } catch (e) {
      errEl.textContent = e.message || 'Errore durante la creazione della squadra.';
    }
  };
  document.getElementById('wBack').onclick = async () => {
    const { renderLanding } = await import('./landing.js');
    renderLanding();
  };
}

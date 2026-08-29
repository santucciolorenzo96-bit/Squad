import { joinTeamByCode } from '../../auth.js';
import { toast } from '../modal.js';
import { renderConfirmEmailNotice } from './confirmEmailNotice.js';

export function renderJoinTeam() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:380px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/logo-default.svg"><div class="brand-name">SQUAD</div></div>
    <div class="card">
      <h2>Entra in una squadra esistente</h2>
      <div class="field">
        <label>Chi sei?</label>
        <div class="row2">
          <button type="button" class="btn btn-secondary" id="jRoleStaff" style="border-color:var(--gold);">Sono dello staff</button>
          <button type="button" class="btn btn-ghost" id="jRoleFamiglia">Sono genitore/giocatore</button>
        </div>
      </div>
      <div class="field"><label>Codice invito</label><input type="text" id="jCode" placeholder="Es. A1B2C3" style="text-transform:uppercase;"></div>
      <div class="field"><label>Nome e cognome</label><input type="text" id="jName"></div>
      <div class="field"><label>Email</label><input type="email" id="jEmail" autocomplete="username"></div>
      <div class="row2">
        <div class="field"><label>Password</label><input type="password" id="jPass" autocomplete="new-password"></div>
        <div class="field"><label>Conferma password</label><input type="password" id="jPass2" autocomplete="new-password"></div>
      </div>
      <div class="hint" id="jRoleHint">Entrerai con il ruolo "Segnapunti": l'amministratore della squadra potrà promuoverti da Utenti.</div>
      <div class="error-msg" id="jError"></div>
    </div>
    <button class="btn btn-primary" id="jSubmit">Entra nella squadra</button>
    <button class="btn btn-ghost" id="jBack" style="width:100%;margin-top:8px;">← Indietro</button>
  </div></div>`;

  let chosenRole = 'segnapunti';
  const staffBtn = document.getElementById('jRoleStaff');
  const famBtn = document.getElementById('jRoleFamiglia');
  const hint = document.getElementById('jRoleHint');
  function selectRole(role) {
    chosenRole = role;
    if (role === 'segnapunti') {
      staffBtn.className = 'btn btn-secondary'; staffBtn.style.borderColor = 'var(--gold)';
      famBtn.className = 'btn btn-ghost'; famBtn.style.borderColor = '';
      hint.textContent = 'Entrerai con il ruolo "Segnapunti": l\'amministratore della squadra potrà promuoverti da Utenti.';
    } else {
      famBtn.className = 'btn btn-secondary'; famBtn.style.borderColor = 'var(--gold)';
      staffBtn.className = 'btn btn-ghost'; staffBtn.style.borderColor = '';
      hint.textContent = 'Vedrai solo il settore del tuo giocatore. Un amministratore dovrà collegare il tuo account al giocatore giusto prima che tu veda i suoi dati.';
    }
  }
  staffBtn.onclick = () => selectRole('segnapunti');
  famBtn.onclick = () => selectRole('famiglia');

  document.getElementById('jSubmit').onclick = async () => {
    const errEl = document.getElementById('jError');
    const inviteCode = document.getElementById('jCode').value.trim().toUpperCase();
    const displayName = document.getElementById('jName').value.trim();
    const email = document.getElementById('jEmail').value.trim();
    const pass1 = document.getElementById('jPass').value;
    const pass2 = document.getElementById('jPass2').value;

    if (!inviteCode) { errEl.textContent = 'Inserisci il codice invito.'; return; }
    if (!displayName || !email) { errEl.textContent = 'Inserisci nome ed email.'; return; }
    if (pass1.length < 6) { errEl.textContent = 'La password deve avere almeno 6 caratteri.'; return; }
    if (pass1 !== pass2) { errEl.textContent = 'Le password non coincidono.'; return; }

    try {
      const result = await joinTeamByCode({ email, password: pass1, inviteCode, displayName, role: chosenRole });
      if (result.needsEmailConfirmation) {
        renderConfirmEmailNotice(email);
        return;
      }
      toast('Sei entrato nella squadra!');
      const { boot } = await import('../../router.js');
      await boot();
    } catch (e) {
      errEl.textContent = e.message || 'Codice invito non valido o errore di registrazione.';
    }
  };
  document.getElementById('jBack').onclick = async () => {
    const { renderLanding } = await import('./landing.js');
    renderLanding();
  };
}

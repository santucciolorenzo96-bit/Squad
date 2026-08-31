import { joinTeamByCode } from '../../auth.js';
import { toast } from '../modal.js';
import { renderConfirmEmailNotice } from './confirmEmailNotice.js';

export function renderJoinTeam() {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:380px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>
    <div class="card">
      <h2>Entra in una squadra esistente</h2>
      <div class="field">
        <label>Chi sei?</label>
        <div class="row3">
          <button type="button" class="btn btn-secondary" data-role="atleta" style="border-color:var(--gold);">Sono un atleta</button>
          <button type="button" class="btn btn-ghost" data-role="genitore">Sono un genitore</button>
          <button type="button" class="btn btn-ghost" data-role="segnapunti">Segnapunti</button>
        </div>
      </div>
      <div class="field"><label>Codice invito</label><input type="text" id="jCode" placeholder="Es. A1B2C3" style="text-transform:uppercase;"></div>
      <div class="field"><label>Nome e cognome</label><input type="text" id="jName"></div>
      <div class="field"><label>Email</label><input type="email" id="jEmail" autocomplete="username"></div>
      <div class="row2">
        <div class="field"><label>Password</label><input type="password" id="jPass" autocomplete="new-password"></div>
        <div class="field"><label>Conferma password</label><input type="password" id="jPass2" autocomplete="new-password"></div>
      </div>
      <div class="hint" id="jRoleHint"></div>
      <div class="error-msg" id="jError"></div>
    </div>
    <button class="btn btn-primary" id="jSubmit">Entra nella squadra</button>
    <button class="btn btn-ghost" id="jBack" style="width:100%;margin-top:8px;">← Indietro</button>
  </div></div>`;

  // Solo i ruoli senza privilegi sono scegliibili in autonomia: allenatore,
  // staff, presidente e admin li assegna un amministratore da Utenti.
  const ROLE_HINTS = {
    atleta: 'Un amministratore collegherà il tuo account alla tua scheda giocatore: da lì potrai completare i tuoi dati.',
    genitore: 'Un amministratore collegherà il tuo account a tuo figlio: vedrai e completerai i suoi dati.',
    segnapunti: 'Potrai tenere il tabellino delle partite dei settori che ti verranno assegnati.'
  };
  let chosenRole = 'atleta';
  const roleBtns = Array.from(document.querySelectorAll('[data-role]'));
  const hint = document.getElementById('jRoleHint');
  function selectRole(role) {
    chosenRole = role;
    roleBtns.forEach(b => {
      const on = b.getAttribute('data-role') === role;
      b.className = on ? 'btn btn-secondary' : 'btn btn-ghost';
      b.style.borderColor = on ? 'var(--gold)' : '';
    });
    hint.textContent = ROLE_HINTS[role];
  }
  roleBtns.forEach(b => b.onclick = () => selectRole(b.getAttribute('data-role')));
  selectRole('atleta');

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

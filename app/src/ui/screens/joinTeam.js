import { joinTeamByCode } from '../../auth.js';
import { esc, passwordProblem, PASSWORD_MIN } from '../../utils/format.js';
import { fetchTeamByInviteCode } from '../../api/teams.js';
import { getSport } from '../../utils/sports/index.js';
import { renderConfirmEmailNotice } from './confirmEmailNotice.js';
import { openPrivacyText } from '../privacy.js';
import { acceptPrivacy } from '../../api/privacy.js';

// Iscrizione con codice invito: è la strada che percorrono quasi tutti gli
// utenti dell'app, quasi sempre da telefono e una volta sola.
//
// Prima era un'unica schermata con sette campi. Ora è in due passi: prima il
// codice, che viene verificato subito e mostra in che società si sta entrando,
// poi i dati personali. Chi sbaglia una lettera del codice se ne accorge lì,
// non dopo la conferma email.

const ROLES = [
  { key: 'atleta', label: 'Sono un atleta', hint: 'La società collegherà il tuo account alla tua scheda: da lì completi i tuoi dati e carichi il certificato.' },
  { key: 'genitore', label: 'Sono un genitore', hint: 'La società collegherà il tuo account a tuo figlio: vedrai convocazioni, quote e documenti.' },
  { key: 'staff', label: 'Faccio parte dello staff', hint: 'Allenatore, dirigente o collaboratore. Un amministratore ti assegnerà le categorie e i permessi che ti servono.' },
  { key: 'segnapunti', label: 'Faccio lo scout', hint: 'Seguirai le partite col tabellino dal vivo, nelle categorie che ti verranno assegnate.' }
];

export function renderJoinTeam(prefill = {}) {
  let step = 1;
  let team = null;
  let inviteCode = (prefill.inviteCode || '').toUpperCase();
  let chosenRole = 'atleta';

  const root = document.getElementById('root');

  function shell(inner) {
    root.innerHTML = `
    <div class="center-screen"><div style="max-width:400px;width:100%;">
      <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>
      <div class="wizard-steps">
        <span class="${step >= 1 ? 'on' : ''}">1 · La società</span>
        <span class="${step >= 2 ? 'on' : ''}">2 · I tuoi dati</span>
      </div>
      ${inner}
    </div></div>`;
  }

  function goBack() {
    import('./landing.js').then(m => m.renderLanding());
  }

  // ---------------------------------------------------------------- passo 1
  function renderStep1(errorMsg) {
    step = 1;
    shell(`
      <div class="card">
        <h2>Il codice della tua società</h2>
        <div class="hint" style="margin-top:0;">Sei nel posto giusto: te l'ha mandato la tua società, sono sei caratteri.</div>
        <div class="field">
          <input type="text" id="jCode" class="code-input" inputmode="latin" autocapitalize="characters"
                 autocomplete="off" maxlength="6" placeholder="A1B2C3" value="${esc(inviteCode)}">
        </div>
        <div id="jTeamPreview"></div>
        <div class="error-msg" id="jError">${errorMsg ? esc(errorMsg) : ''}</div>
      </div>
      <button class="btn btn-primary" id="jNext">Continua</button>
      <button class="btn btn-ghost" id="jBack" style="width:100%;margin-top:8px;">← Indietro</button>
    `);

    const codeEl = document.getElementById('jCode');
    codeEl.focus();
    codeEl.addEventListener('input', () => {
      codeEl.value = codeEl.value.toUpperCase().replace(/\s/g, '');
      document.getElementById('jTeamPreview').innerHTML = '';
      document.getElementById('jError').textContent = '';
    });
    codeEl.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('jNext').click(); });

    document.getElementById('jBack').onclick = goBack;
    document.getElementById('jNext').onclick = async () => {
      const errEl = document.getElementById('jError');
      const code = codeEl.value.trim().toUpperCase();
      if (code.length < 4) { errEl.textContent = 'Inserisci il codice che ti ha dato la società.'; return; }

      const btn = document.getElementById('jNext');
      btn.disabled = true; btn.textContent = 'Verifico…';
      try {
        team = await fetchTeamByInviteCode(code);
      } catch (e) {
        // Se la verifica non è disponibile si prosegue lo stesso: il codice
        // verrà comunque validato dal server al momento dell'iscrizione.
        team = null;
      }
      btn.disabled = false; btn.textContent = 'Continua';

      if (!team) {
        errEl.textContent = 'Non troviamo nessuna società con questo codice. Controlla di averlo copiato bene.';
        return;
      }
      inviteCode = code;
      renderStep2();
    };
  }

  // ---------------------------------------------------------------- passo 2
  function renderStep2(errorMsg) {
    step = 2;
    const sport = getSport(team && team.sport);
    shell(`
      <div class="card team-confirm">
        <div class="team-confirm-badge">${esc((team.name || '?').slice(0, 2).toUpperCase())}</div>
        <div>
          <b>${esc(team.name)}</b>
          <span>${team.city ? esc(team.city) + ' · ' : ''}${esc(sport.label)}</span>
        </div>
        <button class="btn btn-ghost" id="jChange">Cambia</button>
      </div>

      <div class="card">
        <div class="field">
          <label>Chi sei?</label>
          <div class="choice-list" id="jRoles">
            ${ROLES.map(r => `<button type="button" class="choice${r.key === chosenRole ? ' on' : ''}" data-role="${r.key}">
              <b>${r.label}</b><span>${r.hint}</span></button>`).join('')}
          </div>
        </div>
        <div class="field"><label>Nome e cognome</label><input type="text" id="jName" autocomplete="name" placeholder="Come ti chiami"></div>
        <div class="field"><label>Email</label><input type="email" id="jEmail" autocomplete="username" inputmode="email" placeholder="La tua email"></div>
        <div class="field">
          <label>Scegli una password</label>
          <div class="pass-wrap">
            <input type="password" id="jPass" autocomplete="new-password" placeholder="Almeno ${PASSWORD_MIN} caratteri, con un numero">
            <button type="button" class="pass-toggle" id="jPassToggle">Mostra</button>
          </div>
        </div>
        <label class="consent">
          <input type="checkbox" id="jPrivacy">
          <span>Ho letto l'<button type="button" class="linklike" id="jPrivacyLink">informativa sul trattamento dei dati</button> e acconsento. Se l'atleta è minorenne, dichiaro di essere chi ne esercita la responsabilità genitoriale.</span>
        </label>
        <div class="error-msg" id="jError">${errorMsg ? esc(errorMsg) : ''}</div>
      </div>
      <button class="btn btn-primary" id="jSubmit">Crea il mio account</button>
      <button class="btn btn-ghost" id="jBack" style="width:100%;margin-top:8px;">← Indietro</button>
    `);

    document.getElementById('jChange').onclick = () => renderStep1();
    document.getElementById('jBack').onclick = () => renderStep1();

    document.querySelectorAll('[data-role]').forEach(b => {
      b.onclick = () => {
        chosenRole = b.dataset.role;
        document.querySelectorAll('[data-role]').forEach(x => x.classList.toggle('on', x === b));
      };
    });

    document.getElementById('jPrivacyLink').onclick = () => openPrivacyText();

    const passEl = document.getElementById('jPass');
    document.getElementById('jPassToggle').onclick = (e) => {
      const showing = passEl.type === 'text';
      passEl.type = showing ? 'password' : 'text';
      e.currentTarget.textContent = showing ? 'Mostra' : 'Nascondi';
    };

    document.getElementById('jSubmit').onclick = async (e) => {
      const errEl = document.getElementById('jError');
      const displayName = document.getElementById('jName').value.trim();
      const email = document.getElementById('jEmail').value.trim();
      const pass = passEl.value;

      if (!displayName) { errEl.textContent = 'Scrivi il tuo nome e cognome.'; return; }
      if (!email) { errEl.textContent = 'Serve la tua email: è con quella che accedi.'; return; }
      const pwErr = passwordProblem(pass);
      if (pwErr) { errEl.textContent = pwErr; return; }
      if (!document.getElementById('jPrivacy').checked) {
        errEl.textContent = 'Per procedere serve il consenso al trattamento dei dati.';
        return;
      }

      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = 'Creo l\'account…';
      try {
        const result = await joinTeamByCode({ email, password: pass, inviteCode, displayName, role: chosenRole });
        if (result.needsEmailConfirmation) { renderConfirmEmailNotice(email); return; }
        // Il consenso si registra subito dopo la creazione del profilo. Se
        // fallisce non si blocca l'iscrizione: verrà richiesto all'apertura.
        try { await acceptPrivacy(); } catch (err) { console.error(err); }
        const { boot } = await import('../../router.js');
        await boot();
      } catch (err) {
        // L'account esiste già ma senza squadra: la sessione è aperta, quindi
        // il recupero può completare l'iscrizione senza registrarsi di nuovo.
        if (err.accountCreated) {
          const { boot } = await import('../../router.js');
          await boot();
          return;
        }
        btn.disabled = false; btn.textContent = 'Crea il mio account';
        errEl.textContent = err.message || 'Non è stato possibile completare la registrazione.';
      }
    };
  }

  renderStep1();
}

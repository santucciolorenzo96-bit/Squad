import { createTeamAndAdmin } from '../../auth.js';
import { esc } from '../../utils/format.js';
import { SPORT_LIST } from '../../utils/sports/index.js';
import { renderConfirmEmailNotice } from './confirmEmailNotice.js';

// Registrazione della società. La fa un dirigente, una volta sola, quasi
// sempre da computer: qui si può chiedere qualcosa in più che ai genitori.
//
// Lo sport è la prima domanda perché decide come si comporterà tutto il resto
// (ruoli, campo in Rosa, statistiche, classifica) e, a differenza degli altri
// campi, dopo non è più modificabile.

export function renderCreateTeam() {
  let sport = 'basket';

  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:440px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>

    <div class="card">
      <h2>Che sport fate?</h2>
      <div class="hint" style="margin-top:0;">Adatta ruoli, campo, statistiche e classifica. Non è modificabile dopo.</div>
      <div class="choice-list" id="sportList">
        ${SPORT_LIST.map(s => `<button type="button" class="choice${s.key === sport ? ' on' : ''}" data-sport="${s.key}">
          <b>${esc(s.label)}</b><span>${esc(s.description)}</span></button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>La società</h2>
      <div class="field"><label>Nome *</label><input type="text" id="wTeamName" placeholder="Es. Basket Catania"></div>
      <div class="row2">
        <div class="field"><label>Città</label><input type="text" id="wCity" placeholder="Es. Catania"></div>
        <div class="field"><label>Categoria</label><input type="text" id="wCategory" placeholder="Es. Serie D"></div>
      </div>
      <div class="hint">Il logo lo carichi dopo, dalla sezione Squadra.</div>
    </div>

    <div class="card">
      <h2>Il tuo account da amministratore</h2>
      <div class="field"><label>Nome e cognome</label><input type="text" id="wAdminName" autocomplete="name" placeholder="Es. Lorenzo Santuccio"></div>
      <div class="field"><label>Email</label><input type="email" id="wAdminEmail" autocomplete="username" inputmode="email"></div>
      <div class="field">
        <label>Scegli una password</label>
        <div class="pass-wrap">
          <input type="password" id="wAdminPass" autocomplete="new-password" placeholder="Almeno 6 caratteri">
          <button type="button" class="pass-toggle" id="wPassToggle">Mostra</button>
        </div>
      </div>
      <div class="error-msg" id="wError"></div>
    </div>

    <button class="btn btn-primary" id="wSubmit">Crea la società</button>
    <button class="btn btn-ghost" id="wBack" style="width:100%;margin-top:8px;">← Indietro</button>
  </div></div>`;

  document.querySelectorAll('[data-sport]').forEach(b => {
    b.onclick = () => {
      sport = b.dataset.sport;
      document.querySelectorAll('[data-sport]').forEach(x => x.classList.toggle('on', x === b));
    };
  });

  const passEl = document.getElementById('wAdminPass');
  document.getElementById('wPassToggle').onclick = (e) => {
    const showing = passEl.type === 'text';
    passEl.type = showing ? 'password' : 'text';
    e.currentTarget.textContent = showing ? 'Mostra' : 'Nascondi';
  };

  document.getElementById('wSubmit').onclick = async (e) => {
    const errEl = document.getElementById('wError');
    const teamName = document.getElementById('wTeamName').value.trim();
    const displayName = document.getElementById('wAdminName').value.trim();
    const email = document.getElementById('wAdminEmail').value.trim();
    const pass = passEl.value;

    if (!teamName) { errEl.textContent = 'Inserisci il nome della società.'; return; }
    if (!displayName) { errEl.textContent = 'Inserisci il tuo nome e cognome.'; return; }
    if (!email) { errEl.textContent = 'Inserisci la tua email.'; return; }
    if (pass.length < 6) { errEl.textContent = 'La password deve avere almeno 6 caratteri.'; return; }

    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Creo la società…';
    try {
      const result = await createTeamAndAdmin({
        email, password: pass, teamName,
        city: document.getElementById('wCity').value.trim(),
        category: document.getElementById('wCategory').value.trim(),
        displayName, sport
      });
      if (result.needsEmailConfirmation) { renderConfirmEmailNotice(email); return; }
      const { boot } = await import('../../router.js');
      await boot();
    } catch (err) {
      // Account creato ma società no: la sessione è aperta, il recupero
      // completa senza dover ripartire dalla registrazione.
      if (err.accountCreated) {
        const { boot } = await import('../../router.js');
        await boot();
        return;
      }
      btn.disabled = false; btn.textContent = 'Crea la società';
      errEl.textContent = err.message || 'Errore durante la creazione della società.';
    }
  };

  document.getElementById('wBack').onclick = async () => {
    const { renderLanding } = await import('./landing.js');
    renderLanding();
  };
}

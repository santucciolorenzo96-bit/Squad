import { supabase } from '../../supabaseClient.js';
import { esc } from '../../utils/format.js';

// Schermata di recupero: l'utente è autenticato ma non appartiene a nessuna
// squadra. Capita ogni volta che il link di conferma viene aperto su un
// dispositivo diverso da quello della registrazione — l'azione in sospeso vive
// nel localStorage di chi si è iscritto, quindi sul telefono non c'è.
//
// Prima di questa schermata si finiva sulla landing: da lì l'unica strada era
// registrarsi di nuovo, che con l'email già esistente non manda nessuna mail.
// Un vicolo cieco. Qui invece la sessione c'è già: bastano le RPC.

const ROLE_HINTS = {
  atleta: 'Un amministratore collegherà il tuo account alla tua scheda giocatore.',
  genitore: 'Un amministratore collegherà il tuo account a tuo figlio.',
  segnapunti: 'Potrai tenere il tabellino delle partite dei settori assegnati.'
};

export function renderCompleteSignup(email, pendingError) {
  const root = document.getElementById('root');
  root.innerHTML = `
  <div class="center-screen"><div style="max-width:400px;width:100%;">
    <div class="brand-header"><img class="brand-logo" src="/brand/squad-symbol-3d.png" alt=""><img class="brand-wordmark" src="/brand/squad-wordmark.png" alt="SQUAD"></div>
    <div class="card">
      <h2>Completa l'iscrizione</h2>
      <p style="font-size:13px;color:var(--dim);line-height:1.5;">
        La tua email <b>${esc(email || '')}</b> è confermata, ma il tuo account non è ancora
        collegato a nessuna squadra. Completa qui: non devi registrarti di nuovo.
      </p>
      ${pendingError ? `<div class="error-msg" style="display:block;">${esc(pendingError.message || 'Non è stato possibile completare l\'iscrizione automaticamente.')}</div>` : ''}

      <div class="field" style="margin-top:14px;">
        <label>Cosa vuoi fare</label>
        <div class="row2">
          <button type="button" class="btn btn-secondary" data-mode="join">Entro in una squadra</button>
          <button type="button" class="btn btn-ghost" data-mode="create">Creo una squadra</button>
        </div>
      </div>

      <div id="csJoin">
        <div class="field">
          <label>Chi sei?</label>
          <div class="row3">
            <button type="button" class="btn btn-secondary" data-role="atleta">Atleta</button>
            <button type="button" class="btn btn-ghost" data-role="genitore">Genitore</button>
            <button type="button" class="btn btn-ghost" data-role="segnapunti">Segnapunti</button>
          </div>
        </div>
        <div class="field"><label>Codice invito</label><input type="text" id="csCode" placeholder="Es. A1B2C3" style="text-transform:uppercase;"></div>
        <div class="hint" id="csRoleHint"></div>
      </div>

      <div id="csCreate" style="display:none;">
        <div class="field"><label>Nome della società</label><input type="text" id="csTeam"></div>
        <div class="row2">
          <div class="field"><label>Città</label><input type="text" id="csCity"></div>
          <div class="field"><label>Categoria</label><input type="text" id="csCat" placeholder="Es. Serie D"></div>
        </div>
      </div>

      <div class="field"><label>Nome e cognome</label><input type="text" id="csName"></div>
      <div class="error-msg" id="csError"></div>
    </div>
    <button class="btn btn-primary" id="csSubmit">Completa</button>
    <button class="btn btn-ghost" id="csLogout" style="width:100%;margin-top:8px;">Esci e usa un altro account</button>
  </div></div>`;

  let mode = 'join';
  let chosenRole = 'atleta';

  const modeBtns = Array.from(document.querySelectorAll('[data-mode]'));
  function selectMode(next) {
    mode = next;
    modeBtns.forEach(b => { b.className = b.dataset.mode === next ? 'btn btn-secondary' : 'btn btn-ghost'; });
    document.getElementById('csJoin').style.display = next === 'join' ? '' : 'none';
    document.getElementById('csCreate').style.display = next === 'create' ? '' : 'none';
  }
  modeBtns.forEach(b => { b.onclick = () => selectMode(b.dataset.mode); });

  const roleBtns = Array.from(document.querySelectorAll('[data-role]'));
  const hint = document.getElementById('csRoleHint');
  function selectRole(role) {
    chosenRole = role;
    roleBtns.forEach(b => { b.className = b.dataset.role === role ? 'btn btn-secondary' : 'btn btn-ghost'; });
    hint.textContent = ROLE_HINTS[role];
  }
  roleBtns.forEach(b => { b.onclick = () => selectRole(b.dataset.role); });

  selectMode('join');
  selectRole('atleta');

  document.getElementById('csSubmit').onclick = async () => {
    const errEl = document.getElementById('csError');
    errEl.textContent = '';
    const displayName = document.getElementById('csName').value.trim();
    if (!displayName) { errEl.textContent = 'Inserisci nome e cognome.'; return; }

    try {
      if (mode === 'join') {
        const inviteCode = document.getElementById('csCode').value.trim().toUpperCase();
        if (!inviteCode) { errEl.textContent = 'Inserisci il codice invito.'; return; }
        const { error } = await supabase.rpc('join_team', {
          p_invite_code: inviteCode, p_display_name: displayName, p_role: chosenRole
        });
        if (error) throw error;
      } else {
        const teamName = document.getElementById('csTeam').value.trim();
        if (!teamName) { errEl.textContent = 'Inserisci il nome della società.'; return; }
        const { error } = await supabase.rpc('create_team', {
          p_name: teamName,
          p_city: document.getElementById('csCity').value.trim(),
          p_category: document.getElementById('csCat').value.trim(),
          p_display_name: displayName
        });
        if (error) throw error;
      }
      const { clearPendingAction } = await import('../../auth.js');
      clearPendingAction();
      const { boot } = await import('../../router.js');
      await boot();
    } catch (e) {
      errEl.textContent = e.message || 'Non è stato possibile completare l\'iscrizione.';
    }
  };

  document.getElementById('csLogout').onclick = async () => {
    const { goLogout } = await import('../../router.js');
    await goLogout();
  };
}

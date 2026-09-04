import { state } from '../../state.js';
import { esc, passwordProblem } from '../../utils/format.js';
import { ROLES, ROLE_CLASS, isLinkedUser, isAdmin, DOC_TYPES } from '../../utils/permissions.js';
import { getStoredThemeMode, setTheme, userInitials, applyTeamAccent, teamInitials } from '../../utils/theme.js';
import { formModal, toast, withButtonLoading } from '../modal.js';
import { changePassword } from '../../auth.js';
import { goLogout } from '../../router.js';
import { updateMyProfile } from '../../api/profiles.js';
import { fetchEntriesForPlayers } from '../../api/financeEntries.js';
import { fetchPlayerDocuments } from '../../api/roster.js';
import { openPrivacyText } from '../privacy.js';
import { currentSport } from '../../utils/sports/index.js';

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Che cosa comporta il proprio ruolo, in una riga. Chi entra per la prima
// volta non ha modo di saperlo: la scheda Utenti la vede solo un
// amministratore, e "Staff" da solo non dice niente a nessuno.
function roleSummary(u) {
  if (isAdmin(u)) return 'Gestisci tutto: società, categorie, utenti e permessi.';
  if (u.role === 'allenatore') return 'Componi la rosa, segui le partite e gestisci allenamenti e presenze delle tue categorie.';
  if (u.role === 'staff') return 'Anagrafica, documenti, allenamenti, presenze e comunicazioni delle tue categorie.';
  if (u.role === 'segnapunti') return 'Segui le partite col tabellino dal vivo, nelle categorie assegnate.';
  if (u.role === 'genitore') return 'Vedi e completi i dati dei giocatori collegati al tuo account.';
  if (u.role === 'atleta') return 'Vedi e completi i tuoi dati, le convocazioni e le tue statistiche.';
  return 'Nessun permesso particolare.';
}

// I settori a cui si è assegnati: è la risposta a "perché non vedo l'Under 17".
function mySectors(u) {
  if (isAdmin(u)) return state.sectors.map(s => s.name);
  if (isLinkedUser(u)) return state.sectors.filter(s => state.familySectorIds.includes(s.id)).map(s => s.name);
  const ids = state.staffSectors[u.id] || [];
  return state.sectors.filter(s => ids.includes(s.id)).map(s => s.name);
}

export async function renderProfiloTab(c) {
  const u = state.currentUser;
  const currentMode = getStoredThemeMode();
  const settori = mySectors(u);
  const team = state.teamProfile;

  // "Squadra" mostra i colori che applicherà: senza, è un'etichetta che non
  // dice cosa succede finché non la si prova.
  const themeOptions = [
    { key: 'light', label: 'Chiaro', swatch: null },
    { key: 'dark', label: 'Scuro', swatch: null },
    { key: 'squadra', label: 'Squadra', swatch: [team.primary_color || '#19E3D1', team.secondary_color || '#11A8F4'] }
  ];

  c.innerHTML = `
    <div class="settings-col">
    <button class="btn btn-ghost" id="profBack" style="margin-bottom:14px;">← Torna</button>

    <div class="profile-hero">
      <div class="profile-avatar">${esc(userInitials(u.display_name))}</div>
      <div class="profile-id">
        <h2>${esc(u.display_name)}</h2>
        <div class="profile-meta">
          <span class="role-badge ${ROLE_CLASS[u.role] || ''}">${esc(ROLES[u.role] || 'Ruolo non impostato')}</span>
          <span>${esc(u.email || '')}</span>
        </div>
        <div class="profile-role-what">${esc(roleSummary(u))}</div>
      </div>
      <div class="profile-team">
        <div class="pt-badge${team.logo_url ? ' has-logo' : ''}">${team.logo_url
          ? `<img src="${esc(team.logo_url)}" alt="">`
          : esc(teamInitials(team.name))}</div>
        <div>
          <b>${esc(team.name)}</b>
          <span>${esc(currentSport().label)}${settori.length ? ' · ' + settori.length + ' categori' + (settori.length === 1 ? 'a' : 'e') : ''}</span>
        </div>
      </div>
    </div>

    <div class="settings-grid">

      <div class="card">
        <h2>Aspetto</h2>
        <div class="theme-switch" id="themeSwitch">
          ${themeOptions.map(o => `<button data-mode="${o.key}" class="${o.key === currentMode ? 'active' : ''}">
            ${o.swatch ? `<i class="theme-swatch"><em style="background:${esc(o.swatch[0])}"></em><em style="background:${esc(o.swatch[1])}"></em></i>` : ''}
            ${o.label}
          </button>`).join('')}
        </div>
        <div class="hint" style="margin-bottom:0;">${currentMode === 'squadra'
          ? 'SQUAD usa i colori della tua società. Li cambia un amministratore dalla scheda Squadra.'
          : "Con <b>Squadra</b> l'app prende i colori della tua società."}</div>
      </div>

      <div class="card">
        <h2>I tuoi dati</h2>
        <div class="field"><label>Nome visualizzato</label><input type="text" id="pName" value="${esc(u.display_name)}"></div>
        <div class="field"><label>Telefono</label><input type="tel" id="pPhone" value="${esc(u.phone || '')}" placeholder="Non inserito"></div>
        <div class="field"><label>Email</label><input type="email" value="${esc(u.email || '')}" disabled></div>
        <div class="hint" style="margin-top:0;">L'email è quella con cui accedi e non si cambia da qui.</div>
        <div class="error-msg" id="pError"></div>
        <button class="btn btn-primary" id="pSave">Salva</button>
      </div>

      <div class="card">
        <h2>Cosa vedi</h2>
        ${settori.length ? `
          <div class="hint" style="margin-top:0;">${isAdmin(u)
            ? 'Come amministratore vedi tutte le categorie della società.'
            : 'Sei assegnato a queste categorie. Per averne altre chiedi a un amministratore.'}</div>
          <div class="sector-chips">${settori.map(n => `<span>${esc(n)}</span>`).join('')}</div>
        ` : `<div class="hint" style="margin:0;">${isLinkedUser(u)
            ? 'Il tuo account non è ancora collegato a nessun giocatore. Chiedi a un amministratore di collegarlo.'
            : 'Non sei ancora assegnato a nessuna categoria: finché non lo sei, le schermate restano vuote.'}</div>`}
        ${state.linkedPlayers.length ? `
          <div class="section-label" style="margin-bottom:6px;">Giocatori collegati</div>
          <div class="sector-chips">${state.linkedPlayers.map(p => `<span>${esc(p.name)}</span>`).join('')}</div>
        ` : ''}
      </div>

      <div class="card">
        <h2>Privacy</h2>
        <div class="hint" style="margin-top:0;">${u.privacy_accepted_at
          ? "Hai accettato l'informativa il " + fmtDate(u.privacy_accepted_at) + "."
          : 'Non risulta ancora un consenso registrato.'}</div>
        <button class="btn btn-secondary" id="pPrivacy" style="width:100%;">Leggi l'informativa</button>
        <div class="hint" style="margin-bottom:0;">Per chiedere una copia dei tuoi dati o la loro cancellazione, scrivi a un amministratore della società.</div>
      </div>

    </div>

    ${isLinkedUser(u) ? `
    <div class="section-label">Quote da versare</div>
    <div id="famEntries"><div class="skeleton skeleton-row"></div></div>
    <div class="section-label">Documenti in scadenza</div>
    <div id="famDocs"><div class="skeleton skeleton-row"></div></div>
    ` : ''}

    <div class="section-label">Account</div>
    <div class="card account-actions">
      <button class="btn btn-secondary" id="pChangePass">Cambia password</button>
      <button class="btn btn-danger" id="pLogout">Esci</button>
    </div>
    </div>
  `;

  document.getElementById('profBack').onclick = async () => {
    state.currentTab = 'home';
    const { renderApp } = await import('../layout.js');
    renderApp();
  };

  document.querySelectorAll('#themeSwitch button').forEach(b => {
    b.onclick = () => {
      setTheme(b.dataset.mode);
      applyTeamAccent(state.teamProfile);
      renderProfiloTab(c); // il riquadro dei colori e il testo sotto seguono la scelta
    };
  });

  document.getElementById('pPrivacy').onclick = () => openPrivacyText();

  document.getElementById('pSave').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('pError');
    const display_name = document.getElementById('pName').value.trim();
    if (!display_name) { errEl.textContent = 'Il nome non può essere vuoto.'; return; }
    try {
      await updateMyProfile({ display_name, phone: document.getElementById('pPhone').value.trim() || null });
      u.display_name = display_name;
      u.phone = document.getElementById('pPhone').value.trim() || null;
      toast('Profilo aggiornato');
      const { renderApp } = await import('../layout.js');
      renderApp();
    } catch (err) {
      errEl.textContent = err.message || 'Errore nel salvataggio.';
    }
  });

  document.getElementById('pChangePass').onclick = openChangePasswordModal;
  document.getElementById('pLogout').onclick = () => goLogout();

  if (isLinkedUser(u)) {
    loadFamilyEntries();
    loadFamilyDocs();
  }
}

async function loadFamilyEntries() {
  const holder = document.getElementById('famEntries');
  try {
    const entries = await fetchEntriesForPlayers(state.linkedPlayers.map(p => p.id));
    if (entries.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessuna quota in sospeso.</div>'; return; }
    holder.innerHTML = '';
    entries.forEach(e => {
      const row = document.createElement('div');
      row.className = 'list-row';
      const scaduta = e.due_date && e.due_date < new Date().toISOString().slice(0, 10);
      row.innerHTML = `<div class="main">
          <div class="nm">${esc(e.description)}</div>
          <div class="sub">${e.due_date ? 'Scadenza ' + new Date(e.due_date).toLocaleDateString('it-IT') : 'Senza scadenza'}</div>
        </div>
        <span class="status-badge ${scaduta ? 'rejected' : 'pending'}">${fmtMoney(e._status ? e._status.residual_amount : e.planned_amount)}</span>`;
      holder.appendChild(row);
    });
  } catch (e) {
    holder.innerHTML = '<div class="placeholder-card">Impossibile caricare le quote al momento.</div>';
  }
}

async function loadFamilyDocs() {
  const holder = document.getElementById('famDocs');
  try {
    const today = new Date().toISOString().slice(0, 10);
    const limite = new Date(); limite.setDate(limite.getDate() + 30);
    const limiteIso = limite.toISOString().slice(0, 10);
    const perPlayer = await Promise.all(state.linkedPlayers.map(p => fetchPlayerDocuments(p.id)));
    const rows = [];
    state.linkedPlayers.forEach((p, i) => {
      DOC_TYPES.forEach(dt => {
        const d = (perPlayer[i] || []).filter(x => x.doc_type === dt.key && x.status !== 'rejected')
          .sort((a, b) => (b.expires_at || '').localeCompare(a.expires_at || ''))[0];
        if (!d) { rows.push({ p, dt, stato: 'mancante' }); return; }
        if (d.expires_at && d.expires_at < today) rows.push({ p, dt, d, stato: 'scaduto' });
        else if (d.expires_at && d.expires_at <= limiteIso) rows.push({ p, dt, d, stato: 'in_scadenza' });
      });
    });
    if (rows.length === 0) { holder.innerHTML = '<div class="placeholder-card">Tutti i documenti sono in regola.</div>'; return; }
    holder.innerHTML = rows.map(r => {
      const cls = r.stato === 'scaduto' ? 'rejected' : (r.stato === 'mancante' ? 'missing' : 'pending');
      const label = r.stato === 'scaduto' ? 'Scaduto' : (r.stato === 'mancante' ? 'Mancante' : 'In scadenza');
      return `<div class="list-row"><div class="main">
        <div class="nm">${esc(r.dt.label)}</div>
        <div class="sub">${esc(r.p.name)}${r.d && r.d.expires_at ? ' · fino al ' + new Date(r.d.expires_at).toLocaleDateString('it-IT') : ''}</div>
      </div><span class="status-badge ${cls}">${label}</span></div>`;
    }).join('');
  } catch (e) {
    holder.innerHTML = '<div class="placeholder-card">Impossibile caricare i documenti al momento.</div>';
  }
}

function openChangePasswordModal() {
  formModal('Cambia password', `
    <div class="field"><label>Password attuale</label><input type="password" id="cpOld" autocomplete="current-password"></div>
    <div class="field"><label>Nuova password</label><input type="password" id="cpNew" autocomplete="new-password"></div>
    <div class="field"><label>Ripeti la nuova password</label><input type="password" id="cpNew2" autocomplete="new-password"></div>
  `, async () => {
    const old = document.getElementById('cpOld').value;
    const n1 = document.getElementById('cpNew').value;
    const n2 = document.getElementById('cpNew2').value;
    if (!old) return 'Inserisci la password attuale.';
    const pwErr = passwordProblem(n1, { field: 'La nuova password' });
    if (pwErr) return pwErr;
    if (n1 !== n2) return 'Le due password non coincidono.';
    await changePassword(state.currentUser.email, old, n1);
    toast('Password aggiornata');
  }, { confirmLabel: 'Cambia password' });
}

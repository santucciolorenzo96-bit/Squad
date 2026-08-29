import { state } from '../../state.js';
import { esc } from '../../utils/format.js';
import { ROLES, ROLE_CLASS, isFamiglia, DOC_TYPES } from '../../utils/permissions.js';
import { getStoredThemeMode, setTheme, userInitials } from '../../utils/theme.js';
import { formModal, toast, withButtonLoading } from '../modal.js';
import { changePassword } from '../../auth.js';
import { goLogout } from '../../router.js';
import { updateProfile } from '../../api/profiles.js';
import { fetchEntriesForPlayers } from '../../api/financeEntries.js';
import { fetchPlayerDocuments } from '../../api/roster.js';

function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

export async function renderProfiloTab(c) {
  const u = state.currentUser;
  const themeLabels = { dark: 'Scuro', light: 'Chiaro', system: 'Sistema' };
  const currentMode = getStoredThemeMode();

  c.innerHTML = `
    <div class="settings-col">
    <button class="btn btn-ghost" id="profBack" style="margin-bottom:14px;">← Torna</button>

    <div class="card" style="text-align:center;">
      <div style="position:relative;width:64px;height:64px;margin:0 auto 10px;display:flex;align-items:center;justify-content:center;">
        <span class="gear-base" style="inset:0;"></span>
        ${Array.from({ length: 8 }, (_, i) => `<span class="gear-tooth" style="width:7px;height:10px;margin:-30px 0 0 -3.5px;transform-origin:3.5px 30px;transform:rotate(${i * 45}deg);"></span>`).join('')}
        <span class="user-avatar-circle" style="width:46px;height:46px;font-size:17px;">${esc(userInitials(u.display_name))}</span>
      </div>
      <div style="font-family:var(--font-display);font-weight:800;font-size:18px;">${esc(u.display_name)}</div>
      <span class="role-badge ${ROLE_CLASS[u.role]}" style="margin-top:4px;display:inline-block;">${ROLES[u.role]}</span>
    </div>

    <div class="card">
      <h2>Aspetto</h2>
      <div class="theme-switch" id="themeSwitch">
        ${['dark', 'light', 'system'].map(m => `<button data-mode="${m}" class="${m === currentMode ? 'active' : ''}">${themeLabels[m]}</button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Il tuo profilo</h2>
      <div class="field"><label>Nome visualizzato</label><input type="text" id="pName" value="${esc(u.display_name)}"></div>
      <div class="field"><label>Telefono</label><input type="tel" id="pPhone" value="${esc(u.phone || '')}" placeholder="Non inserito"></div>
      <div class="field"><label>Email</label><input type="email" value="${esc(u.email || '')}" disabled></div>
      <div class="error-msg" id="pError"></div>
      <button class="btn btn-primary" id="pSave">Salva profilo</button>
    </div>

    ${isFamiglia(u) ? `
    <div class="section-label">Quote da versare</div>
    <div id="famEntries" class="hint">Caricamento…</div>
    <div class="section-label">Documenti in scadenza</div>
    <div id="famDocs" class="hint">Caricamento…</div>
    ` : ''}

    <div class="card">
      <button class="btn btn-secondary" id="pChangePass" style="width:100%;margin-bottom:8px;">Cambia password</button>
      <button class="btn btn-danger" id="pLogout" style="width:100%;">Esci</button>
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
      document.querySelectorAll('#themeSwitch button').forEach(o => o.classList.toggle('active', o === b));
    };
  });

  document.getElementById('pSave').onclick = (e) => withButtonLoading(e.currentTarget, async () => {
    const errEl = document.getElementById('pError');
    const display_name = document.getElementById('pName').value.trim();
    if (!display_name) { errEl.textContent = 'Il nome non può essere vuoto.'; return; }
    try {
      await updateProfile(u.id, { display_name, phone: document.getElementById('pPhone').value.trim() || null });
      u.display_name = display_name;
      u.phone = document.getElementById('pPhone').value.trim() || null;
      toast('Profilo aggiornato');
      const { renderApp } = await import('../layout.js');
      renderApp();
    } catch (e) {
      errEl.textContent = e.message || 'Errore nel salvataggio.';
    }
  });

  document.getElementById('pChangePass').onclick = openChangePasswordModal;
  document.getElementById('pLogout').onclick = () => goLogout();

  if (isFamiglia(u)) {
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
      const player = state.linkedPlayers.find(p => p.id === e.player_id);
      const row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;">${esc(e.description)}${player ? ' · ' + esc(player.name) : ''}</div>
            <div class="hint">${e.due_date ? 'Scadenza ' + new Date(e.due_date).toLocaleDateString('it-IT') : 'Nessuna scadenza'}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-weight:800;">${fmtMoney(e._status.residual_amount)}</div>
            <span class="status-badge pending">${e._status.status.replace(/_/g, ' ')}</span>
          </div>
        </div>`;
      holder.appendChild(row);
    });
  } catch (err) {
    holder.innerHTML = '<div class="placeholder-card">Impossibile caricare le quote al momento.</div>';
  }
}

async function loadFamilyDocs() {
  const holder = document.getElementById('famDocs');
  try {
    const today = new Date().toISOString().slice(0, 10);
    const limit = new Date(); limit.setDate(limit.getDate() + 30);
    const limitStr = limit.toISOString().slice(0, 10);
    const perPlayer = await Promise.all(state.linkedPlayers.map(async p => ({
      player: p, docs: await fetchPlayerDocuments(p.id)
    })));
    const rows = [];
    perPlayer.forEach(({ player, docs }) => {
      DOC_TYPES.forEach(dt => {
        const latest = docs.filter(d => d.doc_type === dt.key).sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at))[0];
        if (latest && latest.expires_at && latest.expires_at <= limitStr) rows.push({ player, doc: latest, label: dt.label });
      });
    });
    if (rows.length === 0) { holder.innerHTML = '<div class="placeholder-card">Nessun documento in scadenza.</div>'; return; }
    holder.innerHTML = '';
    rows.forEach(({ player, doc, label }) => {
      const expired = doc.expires_at < today;
      const row = document.createElement('div');
      row.className = 'card';
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-weight:700;">${esc(label)} · ${esc(player.name)}</div>
            <div class="hint">${expired ? 'Scaduto il' : 'Valido fino al'} ${new Date(doc.expires_at).toLocaleDateString('it-IT')}</div>
          </div>
          <span class="status-badge ${expired ? 'rejected' : 'pending'}">${expired ? 'Scaduto' : 'In scadenza'}</span>
        </div>`;
      holder.appendChild(row);
    });
  } catch (err) {
    holder.innerHTML = '<div class="placeholder-card">Impossibile caricare i documenti al momento.</div>';
  }
}

function openChangePasswordModal() {
  formModal('Cambia password', `
    <div class="field"><label>Password attuale</label><input type="password" id="cpOld"></div>
    <div class="field"><label>Nuova password</label><input type="password" id="cpNew"></div>
    <div class="field"><label>Conferma nuova password</label><input type="password" id="cpNew2"></div>
  `, async () => {
    const oldP = document.getElementById('cpOld').value;
    const n1 = document.getElementById('cpNew').value;
    const n2 = document.getElementById('cpNew2').value;
    if (n1.length < 6) return 'La nuova password deve avere almeno 6 caratteri.';
    if (n1 !== n2) return 'Le nuove password non coincidono.';
    try {
      await changePassword(state.currentUser.email, oldP, n1);
      toast('Password aggiornata');
    } catch (e) {
      return e.message || 'Impossibile aggiornare la password.';
    }
  });
}

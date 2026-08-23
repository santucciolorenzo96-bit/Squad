import { state } from '../state.js';
import { ROLES, ROLE_CLASS, TABS, canSeeTab } from '../utils/permissions.js';
import { esc } from '../utils/format.js';
import { formModal, toast } from './modal.js';
import { changePassword } from '../auth.js';
import { goLogout } from '../router.js';

import { renderHomeTab } from './screens/home.js';
import { renderRosaTab } from './screens/rosa.js';
import { renderPartitaTab } from './screens/partita/setup.js';
import { renderStoricoTab } from './screens/storico.js';
import { renderStatisticheTab } from './screens/statistiche.js';
import { renderClassificaTab } from './screens/classifica.js';
import { renderCalendarioTab } from './screens/calendario.js';
import { renderUtentiTab } from './screens/utenti.js';
import { renderSquadraTab } from './screens/squadra.js';

export function renderApp() {
  if (!TABS.find(t => t.id === state.currentTab && canSeeTab(t, state.currentUser))) state.currentTab = 'home';
  const root = document.getElementById('root');
  root.innerHTML = `
    <div class="app-header">
      <div class="left">
        ${state.teamProfile.logo_url ? `<img class="team-logo" src="${esc(state.teamProfile.logo_url)}">` : '<span style="font-size:20px;">🏀</span>'}
        <div class="team-name">${esc(state.teamProfile.name)}</div>
      </div>
      <div class="user-pill" id="userPill">
        <span>${esc(state.currentUser.display_name)}</span>
        <span class="role-badge ${ROLE_CLASS[state.currentUser.role]}">${ROLES[state.currentUser.role]}</span>
      </div>
    </div>
    <div class="tabbar" id="tabbar"></div>
    <div class="screen" id="tabContent"></div>
  `;
  const tabbar = document.getElementById('tabbar');
  TABS.filter(t => canSeeTab(t, state.currentUser)).forEach(t => {
    const b = document.createElement('button');
    b.textContent = t.label;
    b.className = state.currentTab === t.id ? 'active' : '';
    b.onclick = () => { state.currentTab = t.id; renderApp(); };
    tabbar.appendChild(b);
  });

  document.getElementById('userPill').onclick = (e) => {
    e.stopPropagation();
    const existing = document.getElementById('userMenuDrop');
    if (existing) { existing.remove(); return; }
    const menu = document.createElement('div');
    menu.className = 'user-menu'; menu.id = 'userMenuDrop';
    menu.innerHTML = `<button id="umChangePass">Cambia password</button><button id="umLogout">Esci</button>`;
    document.body.appendChild(menu);
    document.getElementById('umChangePass').onclick = () => { menu.remove(); openChangePasswordModal(); };
    document.getElementById('umLogout').onclick = async () => {
      menu.remove();
      await goLogout();
    };
    setTimeout(() => {
      document.addEventListener('click', function h() {
        const m = document.getElementById('userMenuDrop'); if (m) m.remove();
        document.removeEventListener('click', h);
      }, 0);
    }, 0);
  };

  renderTabContent();
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

function renderTabContent() {
  const c = document.getElementById('tabContent');
  if (state.currentTab === 'home') return renderHomeTab(c);
  if (state.currentTab === 'rosa') return renderRosaTab(c);
  if (state.currentTab === 'partita') return renderPartitaTab(c);
  if (state.currentTab === 'storico') return renderStoricoTab(c);
  if (state.currentTab === 'statistiche') return renderStatisticheTab(c);
  if (state.currentTab === 'classifica') return renderClassificaTab(c);
  if (state.currentTab === 'calendario') return renderCalendarioTab(c);
  if (state.currentTab === 'utenti') return renderUtentiTab(c);
  if (state.currentTab === 'squadra') return renderSquadraTab(c);
}

export { renderTabContent };

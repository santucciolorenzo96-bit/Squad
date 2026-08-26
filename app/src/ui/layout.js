import { state } from '../state.js';
import { ROLES, ROLE_CLASS, TABS, canSeeTab } from '../utils/permissions.js';
import { esc } from '../utils/format.js';
import { formModal, toast } from './modal.js';
import { changePassword } from '../auth.js';
import { goLogout, switchSector, unseenNotificationsCount } from '../router.js';
import { updateProfile } from '../api/profiles.js';

import { renderHomeTab } from './screens/home.js';
import { renderRosaTab } from './screens/rosa.js';
import { renderAnagraficaTab } from './screens/anagrafica.js';
import { renderPartitaTab } from './screens/partita/setup.js';
import { renderAllenamentiTab } from './screens/allenamenti.js';
import { renderStoricoTab } from './screens/storico.js';
import { renderStatisticheTab } from './screens/statistiche.js';
import { renderClassificaTab } from './screens/classifica.js';
import { renderCalendarioTab } from './screens/calendario.js';
import { renderUtentiTab } from './screens/utenti.js';
import { renderSquadraTab } from './screens/squadra.js';
import { renderFinanzaTab } from './screens/finanza/index.js';

const NAV_ICONS = {
  home: '<path d="M3 9.5 10 3l7 6.5"/><path d="M5 8.5V17h10V8.5"/>',
  rosa: '<circle cx="7" cy="6.5" r="2.5"/><path d="M2.5 16c0-3 2-5 4.5-5s4.5 2 4.5 5"/><circle cx="14.5" cy="7" r="2"/><path d="M13 11.2c2 .2 3.5 2 3.5 4.8"/>',
  anagrafica: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><circle cx="7.5" cy="9" r="1.7"/><path d="M4.5 13.5c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5"/><path d="M12.5 8.5h3M12.5 11h3"/>',
  partita: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/>',
  allenamenti: '<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>',
  classifica: '<path d="M10 2.5 12 7l5 .7-3.6 3.4.9 4.9L10 13.6 5.7 16l.9-4.9L3 7.7 8 7z" stroke-linejoin="round"/>',
  storico: '<circle cx="9.5" cy="10" r="7"/><path d="M9.5 6v4l3 2"/><path d="M3 4l1.5 2M17.3 5l-1.8 1.6"/>',
  statistiche: '<path d="M3 17V3M3 17h14"/><rect x="5.5" y="11" width="2.6" height="6"/><rect x="9.7" y="7" width="2.6" height="10"/><rect x="13.9" y="9.5" width="2.6" height="7.5"/>',
  calendario: '<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/><path d="M6 12h2M9 12h2M12 12h2"/>',
  utenti: '<circle cx="7" cy="6.5" r="2.5"/><path d="M2.5 16c0-3 2-5 4.5-5s4.5 2 4.5 5"/><circle cx="15" cy="7.5" r="1.6"/><path d="M15 5.3v.6M15 9v.6M16.9 6.4l-.5.3M13.6 8.3l-.5.3M13.1 6.4l.5.3M16.4 8.3l.5.3"/>',
  squadra: '<path d="M10 2.5 16 5v5c0 4-2.6 6.6-6 7.5-3.4-.9-6-3.5-6-7.5V5z" stroke-linejoin="round"/>',
  finanza: '<circle cx="10" cy="10" r="7.2"/><path d="M10 6.2v7.6M12.3 7.8c0-1-1-1.6-2.3-1.6-1.5 0-2.5.7-2.5 1.7 0 2.6 4.8 1.3 4.8 3.9 0 1-1 1.7-2.5 1.7-1.3 0-2.3-.6-2.3-1.6"/>'
};

function navIcon(id) {
  return `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${NAV_ICONS[id] || ''}</svg>`;
}

function formatRelativeTime(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'adesso';
  if (mins < 60) return `${mins} min fa`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'ora' : 'ore'} fa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ${days === 1 ? 'giorno' : 'giorni'} fa`;
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

function accessibleSectorList() {
  if (state.currentUser.role === 'admin') return state.sectors;
  if (state.currentUser.role === 'famiglia') return state.sectors.filter(s => state.familySectorIds.includes(s.id));
  const ids = state.staffSectors[state.currentUser.id] || [];
  return state.sectors.filter(s => ids.includes(s.id));
}

export function renderApp() {
  if (!TABS.find(t => t.id === state.currentTab && canSeeTab(t, state.currentUser))) state.currentTab = 'home';
  const root = document.getElementById('root');
  const mySectors = accessibleSectorList();
  const visibleTabs = TABS.filter(t => canSeeTab(t, state.currentUser));

  root.innerHTML = `
    <div class="app-shell">
      <div class="header-bar">
        <div class="left">
          ${state.teamProfile.logo_url ? `<img class="team-logo" src="${esc(state.teamProfile.logo_url)}">` : '<span style="font-size:20px;">🏀</span>'}
          <div class="team-name">${esc(state.teamProfile.name)}</div>
        </div>
        ${mySectors.length > 1 ? `<div class="sector-switcher" id="sectorSwitcher"></div>` : (mySectors.length === 1 ? `<div class="hint" style="margin:0;">${esc(mySectors[0].name)}</div>` : '')}
        <div class="header-right">
          <button class="bell-btn" id="notifBell">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z"/><path d="M8 15.5a2 2 0 0 0 4 0"/></svg>
            ${unseenNotificationsCount() > 0 ? `<span class="badge-count bell-badge">${unseenNotificationsCount()}</span>` : ''}
          </button>
          <div class="user-pill" id="userPill">
            <span>${esc(state.currentUser.display_name)}</span>
            <span class="role-badge ${ROLE_CLASS[state.currentUser.role]}">${ROLES[state.currentUser.role]}</span>
          </div>
        </div>
      </div>
      <div class="tabbar" id="tabbarMobile"></div>
      <div class="shell-body">
        <div class="sidebar" id="sidebarNav"></div>
        <div class="tab-content screen" id="tabContent"></div>
      </div>
    </div>
  `;

  if (mySectors.length > 1) {
    const sw = document.getElementById('sectorSwitcher');
    mySectors.forEach(s => {
      const b = document.createElement('button');
      b.className = 'sector-pill' + (state.activeSectorId === s.id ? ' active' : '');
      b.textContent = s.name;
      b.onclick = () => { if (state.activeSectorId !== s.id) switchSector(s.id); };
      sw.appendChild(b);
    });
  }

  const groupLabels = { settore: 'Settore', societa: 'Società' };
  const sidebar = document.getElementById('sidebarNav');
  const mobileBar = document.getElementById('tabbarMobile');
  let lastGroup = null;
  visibleTabs.forEach(t => {
    if (t.group !== lastGroup) {
      const lbl = document.createElement('div');
      lbl.className = 'nav-group-label';
      lbl.textContent = groupLabels[t.group] || '';
      sidebar.appendChild(lbl);
      lastGroup = t.group;
    }
    const row = document.createElement('div');
    row.className = 'nav-row' + (state.currentTab === t.id ? ' active' : '');
    row.innerHTML = navIcon(t.id) + `<span>${t.label}</span>` +
      (t.id === 'anagrafica' && state.pendingDocsCount > 0 && state.currentUser.role !== 'famiglia' ? `<span class="badge-count">${state.pendingDocsCount}</span>` : '');
    row.onclick = () => { state.currentTab = t.id; renderApp(); };
    sidebar.appendChild(row);

    const mb = document.createElement('button');
    mb.textContent = t.label;
    mb.className = state.currentTab === t.id ? 'active' : '';
    mb.onclick = () => { state.currentTab = t.id; renderApp(); };
    mobileBar.appendChild(mb);
  });

  document.getElementById('notifBell').onclick = (e) => {
    e.stopPropagation();
    const existing = document.getElementById('notifPanel');
    if (existing) { existing.remove(); return; }
    const panel = document.createElement('div');
    panel.className = 'notif-panel'; panel.id = 'notifPanel';
    if (state.notifications.length === 0) {
      panel.innerHTML = `<div class="notif-panel-title">Notifiche</div><div class="hint" style="padding:14px;">Nessuna notifica per ora.</div>`;
    } else {
      panel.innerHTML = `<div class="notif-panel-title">Notifiche</div>` + state.notifications.map(n => {
        const sector = state.sectors.find(s => s.id === n.sector_id);
        return `<div class="notif-row">
          <div class="notif-row-title">${esc(n.title)}</div>
          ${n.body ? `<div class="notif-row-body">${esc(n.body)}</div>` : ''}
          <div class="notif-row-meta">${sector ? esc(sector.name) + ' · ' : ''}${formatRelativeTime(n.created_at)}</div>
        </div>`;
      }).join('');
    }
    document.body.appendChild(panel);
    setTimeout(() => {
      document.addEventListener('click', function h() {
        const p = document.getElementById('notifPanel'); if (p) p.remove();
        document.removeEventListener('click', h);
      }, 0);
    }, 0);

    if (unseenNotificationsCount() > 0) {
      const seenAt = new Date().toISOString();
      state.currentUser.notifications_seen_at = seenAt;
      updateProfile(state.currentUser.id, { notifications_seen_at: seenAt }).catch(() => {});
      const badge = document.querySelector('#notifBell .bell-badge');
      if (badge) badge.remove();
    }
  };

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
  if (!state.activeSectorId && !['utenti', 'squadra', 'finanza'].includes(state.currentTab)) {
    const isFamiglia = state.currentUser.role === 'famiglia';
    c.innerHTML = `<div class="placeholder-card">
      ${isFamiglia
        ? 'Il tuo account non è ancora collegato a nessun giocatore. Chiedi a un amministratore della società di collegarlo dalla sezione Anagrafica o Utenti.'
        : 'Non sei ancora assegnato a nessun settore. Chiedi a un amministratore di assegnarti da Utenti.'}
    </div>`;
    return;
  }
  if (state.currentTab === 'home') return renderHomeTab(c);
  if (state.currentTab === 'rosa') return renderRosaTab(c);
  if (state.currentTab === 'anagrafica') return renderAnagraficaTab(c);
  if (state.currentTab === 'partita') return renderPartitaTab(c);
  if (state.currentTab === 'allenamenti') return renderAllenamentiTab(c);
  if (state.currentTab === 'storico') return renderStoricoTab(c);
  if (state.currentTab === 'statistiche') return renderStatisticheTab(c);
  if (state.currentTab === 'classifica') return renderClassificaTab(c);
  if (state.currentTab === 'calendario') return renderCalendarioTab(c);
  if (state.currentTab === 'utenti') return renderUtentiTab(c);
  if (state.currentTab === 'squadra') return renderSquadraTab(c);
  if (state.currentTab === 'finanza') return renderFinanzaTab(c);
}

export { renderTabContent };

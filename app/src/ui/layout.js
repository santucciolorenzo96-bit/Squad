import { state } from '../state.js';
import { TABS, canSeeTab } from '../utils/permissions.js';
import { esc } from '../utils/format.js';
import { switchSector, unseenNotificationsCount } from '../router.js';
import { updateProfile } from '../api/profiles.js';
import { userInitials } from '../utils/theme.js';

import { renderHomeTab } from './screens/home.js';
import { renderRosaTab } from './screens/rosa.js';
import { renderAnagraficaTab } from './screens/anagrafica.js';
import { renderPartitaTab } from './screens/partita/setup.js';
import { renderAllenamentiTab } from './screens/allenamenti.js';
import { renderPresenzeTab } from './screens/presenze.js';
import { renderStatisticheTab } from './screens/statistiche.js';
import { renderClassificaTab } from './screens/classifica.js';
import { renderCalendarioTab } from './screens/calendario.js';
import { renderUtentiTab } from './screens/utenti.js';
import { renderSquadraTab } from './screens/squadra.js';
import { renderFinanzaTab } from './screens/finanza/index.js';
import { renderProfiloTab } from './screens/profilo.js';

const NAV_ICONS = {
  home: '<path d="M3 9.5 10 3l7 6.5"/><path d="M5 8.5V17h10V8.5"/>',
  rosa: '<circle cx="7" cy="6.5" r="2.5"/><path d="M2.5 16c0-3 2-5 4.5-5s4.5 2 4.5 5"/><circle cx="14.5" cy="7" r="2"/><path d="M13 11.2c2 .2 3.5 2 3.5 4.8"/>',
  anagrafica: '<rect x="2.5" y="4" width="15" height="12" rx="2"/><circle cx="7.5" cy="9" r="1.7"/><path d="M4.5 13.5c.4-1.6 1.6-2.5 3-2.5s2.6.9 3 2.5"/><path d="M12.5 8.5h3M12.5 11h3"/>',
  partita: '<circle cx="10" cy="10" r="7"/><circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none"/>',
  allenamenti: '<rect x="2.5" y="4" width="15" height="13" rx="2"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3"/>',
  presenze: '<path d="M3 16.5c0-2.6 1.8-4.3 4-4.3s4 1.7 4 4.3"/><circle cx="7" cy="7" r="2.7"/><path d="M12.5 10.2l1.7 1.8 3.3-3.6"/>',
  classifica: '<path d="M10 2.5 12 7l5 .7-3.6 3.4.9 4.9L10 13.6 5.7 16l.9-4.9L3 7.7 8 7z" stroke-linejoin="round"/>',
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
  if (state.currentTab !== 'profilo' && !TABS.find(t => t.id === state.currentTab && canSeeTab(t, state.currentUser))) state.currentTab = 'home';
  const root = document.getElementById('root');
  const mySectors = accessibleSectorList();
  const visibleTabs = TABS.filter(t => canSeeTab(t, state.currentUser));

  root.innerHTML = `
    <div class="app-shell">
      <div class="header-bar">
        <div class="left">
          <img class="app-logo" src="/logo-default.svg" alt="SQUAD">
          <div class="team-name">${esc(state.teamProfile.name)}</div>
        </div>
        <div class="header-mid">
          ${mySectors.length > 1 ? `<div class="sector-switcher" id="sectorSwitcher"></div>` : (mySectors.length === 1 ? `<div class="hint" style="margin:0;">${esc(mySectors[0].name)}</div>` : '')}
        </div>
        <div class="header-right">
          <button class="bell-btn" id="notifBell">
            <svg width="19" height="19" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8a5 5 0 0 1 10 0c0 4 1.5 5 1.5 5h-13S5 12 5 8Z"/><path d="M8 15.5a2 2 0 0 0 4 0"/></svg>
            ${unseenNotificationsCount() > 0 ? `<span class="badge-count bell-badge">${unseenNotificationsCount()}</span>` : ''}
          </button>
          <button class="user-avatar-btn" id="userAvatarBtn" aria-label="Profilo e impostazioni">
            <span class="gear-base"></span>
            ${Array.from({ length: 8 }, (_, i) => `<span class="gear-tooth" style="transform:rotate(${i * 45}deg);"></span>`).join('')}
            <span class="user-avatar-circle">${esc(userInitials(state.currentUser.display_name))}</span>
          </button>
        </div>
      </div>
      <div class="shell-body">
        <div class="sidebar" id="sidebarNav"></div>
        <div class="tab-content" id="tabContent"></div>
      </div>
      <div class="bottom-nav-float" id="bottomNavFloat"></div>
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
  });

  renderBottomNav(visibleTabs, groupLabels);

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

  document.getElementById('userAvatarBtn').onclick = (e) => {
    e.stopPropagation();
    state.currentTab = 'profilo';
    renderApp();
  };

  renderTabContent();
}

function renderBottomNav(visibleTabs, groupLabels) {
  const nav = document.getElementById('bottomNavFloat');
  if (!nav) return;
  const primaryTabs = visibleTabs.filter(t => t.primary).slice(0, 4);
  const otherTabs = visibleTabs.filter(t => !primaryTabs.includes(t));
  nav.innerHTML = '';
  primaryTabs.forEach(t => {
    const b = document.createElement('button');
    b.className = 'bn-item' + (state.currentTab === t.id ? ' active' : '');
    b.innerHTML = navIcon(t.id) + `<span>${esc(t.label)}</span>`;
    b.onclick = () => { state.currentTab = t.id; renderApp(); };
    nav.appendChild(b);
  });
  if (otherTabs.length > 0) {
    const b = document.createElement('button');
    const otherActive = otherTabs.some(t => t.id === state.currentTab);
    b.className = 'bn-item' + (otherActive ? ' active' : '');
    b.innerHTML = `<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="4.5" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none"/><circle cx="15.5" cy="10" r="1.3" fill="currentColor" stroke="none"/></svg><span>Altro</span>`;
    b.onclick = () => openMoreSheet(otherTabs, groupLabels);
    nav.appendChild(b);
  }
}

function openMoreSheet(otherTabs, groupLabels) {
  const existing = document.getElementById('moreSheetOverlay');
  if (existing) { existing.remove(); return; }
  const overlay = document.createElement('div');
  overlay.className = 'bottom-sheet-overlay'; overlay.id = 'moreSheetOverlay';
  const sheet = document.createElement('div');
  sheet.className = 'bottom-sheet';
  let lastGroup = null;
  let rowsHtml = '';
  otherTabs.forEach(t => {
    if (t.group !== lastGroup) {
      rowsHtml += `<div class="nav-group-label">${groupLabels[t.group] || ''}</div>`;
      lastGroup = t.group;
    }
    rowsHtml += `<div class="nav-row${state.currentTab === t.id ? ' active' : ''}" data-tab="${t.id}">${navIcon(t.id)}<span>${esc(t.label)}</span>${t.id === 'anagrafica' && state.pendingDocsCount > 0 && state.currentUser.role !== 'famiglia' ? `<span class="badge-count">${state.pendingDocsCount}</span>` : ''}</div>`;
  });
  sheet.innerHTML = `<div class="bottom-sheet-handle"></div>${rowsHtml}`;
  overlay.appendChild(sheet);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  sheet.querySelectorAll('.nav-row').forEach(row => {
    row.onclick = () => { state.currentTab = row.dataset.tab; overlay.remove(); renderApp(); };
  });
  document.body.appendChild(overlay);
}

function renderTabContent() {
  const c = document.getElementById('tabContent');
  c.classList.remove('tab-anim'); void c.offsetWidth; c.classList.add('tab-anim');
  if (state.currentTab === 'profilo') return renderProfiloTab(c);
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
  if (state.currentTab === 'presenze') return renderPresenzeTab(c);
  if (state.currentTab === 'statistiche') return renderStatisticheTab(c);
  if (state.currentTab === 'classifica') return renderClassificaTab(c);
  if (state.currentTab === 'calendario') return renderCalendarioTab(c);
  if (state.currentTab === 'utenti') return renderUtentiTab(c);
  if (state.currentTab === 'squadra') return renderSquadraTab(c);
  if (state.currentTab === 'finanza') return renderFinanzaTab(c);
}

export { renderTabContent };

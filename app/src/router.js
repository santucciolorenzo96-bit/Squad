import { state, resetState } from './state.js';
import { fetchMyProfile, fetchTeamStaff } from './api/profiles.js';
import { fetchTeam } from './api/teams.js';
import { fetchRosterBySector, fetchPendingDocuments, fetchExpiringDocuments } from './api/roster.js';
import { fetchHistory, fetchLiveGame } from './api/games.js';
import { fetchNextMatch } from './api/nextMatch.js';
import { fetchStandings } from './api/standings.js';
import { fetchSectors, fetchStaffSectors, fetchPlayerSectorIds } from './api/sectors.js';
import { fetchSeasons, storedSeasonId } from './api/seasons.js';
import { fetchTrainings } from './api/trainings.js';
import { fetchRecurrences } from './api/trainingRecurrences.js';
import { fetchCalendar } from './api/calendar.js';
import { fetchLinkedPlayers } from './api/family.js';
import { fetchNotifications } from './api/notifications.js';
import { fetchFiscalYears } from './api/financeFiscalYears.js';
import { fetchCategories } from './api/financeCategories.js';
import { fetchCostCenters } from './api/financeCostCenters.js';
import { fetchAccounts, fetchAccountBalances } from './api/financeAccounts.js';
import { fetchSuppliers } from './api/financeSuppliers.js';
import { fetchSponsors } from './api/financeSponsors.js';
import { isAdmin, isLinkedUser } from './utils/permissions.js';

const LAST_SECTOR_KEY = 'bbapp_active_sector';

export async function loadTeamWideData() {
  const teamId = state.currentUser.team_id;
  const [team, sectors, staff, staffSectors] = await Promise.all([
    fetchTeam(teamId),
    fetchSectors(teamId),
    fetchTeamStaff(teamId),
    fetchStaffSectors(teamId)
  ]);
  state.teamProfile = team;
  const { applyTeamAccent } = await import('./utils/theme.js');
  applyTeamAccent(team);
  state.sectors = sectors;
  state.staff = staff;
  state.staffSectors = staffSectors;

  // La stagione decide il perimetro di rose, partite, presenze e classifica.
  // Se la tabella non c'è ancora (migrazione 021 non eseguita) si continua
  // senza: le query cadono sul comportamento precedente invece di fallire.
  try {
    state.seasons = await fetchSeasons(teamId);
    state.activeSeasonId = storedSeasonId(state.seasons);
  } catch (e) {
    state.seasons = [];
    state.activeSeasonId = null;
    console.error(e);
  }

  if (!isLinkedUser(state.currentUser)) {
    try { state.pendingDocsCount = (await fetchPendingDocuments(teamId)).length; }
    catch (e) { state.pendingDocsCount = 0; }
    try { state.expiringDocsCount = (await fetchExpiringDocuments(teamId)).length; }
    catch (e) { state.expiringDocsCount = 0; }
  }

  try { state.notifications = await fetchNotifications(teamId); }
  catch (e) { state.notifications = []; }

  if (state.currentUser.finance_role) {
    try { await loadFinanceConfig(); }
    catch (e) { console.error('Errore nel caricamento dati finanza:', e); }
  }
}

export async function loadFinanceConfig() {
  const teamId = state.teamProfile.id;
  const [fiscalYears, categories, costCenters, accounts, balances, suppliers, sponsors] = await Promise.all([
    fetchFiscalYears(teamId),
    fetchCategories(teamId),
    fetchCostCenters(teamId),
    fetchAccounts(teamId),
    fetchAccountBalances(teamId),
    fetchSuppliers(teamId),
    fetchSponsors(teamId)
  ]);
  state.financeFiscalYears = fiscalYears;
  state.financeCategories = categories;
  state.financeCostCenters = costCenters;
  state.financeAccounts = accounts;
  state.financeAccountBalances = balances;
  state.financeSuppliers = suppliers;
  state.financeSponsors = sponsors;
}

export async function refreshNotifications() {
  state.notifications = await fetchNotifications(state.teamProfile.id);
}

// Le proprie azioni non si notificano da sole: chi ha creato l'allenamento
// sa di averlo creato.
export function unseenNotificationsCount() {
  return state.notifications.filter(n => !n.read && n.actor_id !== state.currentUser.id).length;
}

export async function loadFamilyLinks() {
  state.linkedPlayers = await fetchLinkedPlayers(state.currentUser.id);
  const sectorIdSet = new Set();
  for (const p of state.linkedPlayers) {
    const ids = await fetchPlayerSectorIds(p.id);
    ids.forEach(id => sectorIdSet.add(id));
  }
  state.familySectorIds = [...sectorIdSet];
}

function accessibleSectorIds() {
  if (isAdmin(state.currentUser)) return state.sectors.map(s => s.id);
  if (isLinkedUser(state.currentUser)) return state.familySectorIds;
  return state.staffSectors[state.currentUser.id] || [];
}

function pickDefaultSectorId() {
  const accessible = accessibleSectorIds();
  if (accessible.length === 0) return null;
  const last = localStorage.getItem(LAST_SECTOR_KEY);
  if (last && accessible.includes(last)) return last;
  // preferisci l'ordine di state.sectors (sort_order) tra quelli accessibili
  const bySortOrder = state.sectors.find(s => accessible.includes(s.id));
  return bySortOrder ? bySortOrder.id : accessible[0];
}

export async function loadSectorData(sectorId) {
  const seasonId = state.activeSeasonId;
  if (!sectorId) {
    state.roster = []; state.history = []; state.liveGame = null;
    state.nextMatch = null; state.standings = []; state.trainings = []; state.calendar = [];
    state.trainingRecurrences = [];
    return;
  }
  const [roster, history, liveGame, nextMatch, standings, trainings, calendar, trainingRecurrences] = await Promise.all([
    fetchRosterBySector(sectorId, seasonId),
    fetchHistory(sectorId, seasonId),
    fetchLiveGame(sectorId),
    fetchNextMatch(sectorId),
    fetchStandings(sectorId, seasonId),
    fetchTrainings(sectorId, seasonId),
    fetchCalendar(sectorId, seasonId),
    fetchRecurrences(sectorId)
  ]);
  state.roster = roster;
  state.history = history;
  state.liveGame = liveGame;
  state.nextMatch = nextMatch;
  state.standings = standings;
  state.trainings = trainings;
  state.calendar = calendar;
  state.trainingRecurrences = trainingRecurrences;
}

export async function switchSector(sectorId) {
  state.activeSectorId = sectorId;
  if (sectorId) localStorage.setItem(LAST_SECTOR_KEY, sectorId);
  await loadSectorData(sectorId);
  const { renderApp } = await import('./ui/layout.js');
  renderApp();
}

export async function boot() {
  let profile = await fetchMyProfile();
  if (!profile) {
    const { data: auth } = await (await import('./supabaseClient.js')).supabase.auth.getUser();
    const { getPendingAction, runPendingAction, clearPendingAction } = await import('./auth.js');
    const pending = getPendingAction();
    let pendingError = null;
    if (auth.user && pending) {
      // Se l'azione in sospeso fallisce (codice invito sbagliato, squadra
      // cancellata) l'eccezione usciva da boot() e la pagina restava bianca:
      // dopo aver confermato l'email non si vedeva più nulla.
      try {
        await runPendingAction(pending);
        profile = await fetchMyProfile();
      } catch (e) {
        pendingError = e;
        clearPendingAction();
      }
    }
    // Autenticato ma senza squadra: succede quando il link di conferma viene
    // aperto su un altro dispositivo (l'azione in sospeso sta nel localStorage
    // di chi si è registrato). Dalla landing non se ne usciva più.
    if (!profile && auth.user) {
      resetState();
      const { renderCompleteSignup } = await import('./ui/screens/completeSignup.js');
      renderCompleteSignup(auth.user.email, pendingError);
      return;
    }
  }
  if (!profile) {
    resetState();
    const { renderLanding } = await import('./ui/screens/landing.js');
    renderLanding();
    return;
  }
  state.currentUser = profile;
  await loadTeamWideData();
  if (isLinkedUser(profile)) await loadFamilyLinks();
  state.activeSectorId = pickDefaultSectorId();
  await loadSectorData(state.activeSectorId);
  const { renderApp } = await import('./ui/layout.js');
  renderApp();
}

export async function goLogout() {
  const { logout } = await import('./auth.js');
  await logout();
  resetState();
  const { renderLanding } = await import('./ui/screens/landing.js');
  renderLanding();
}

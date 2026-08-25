import { state, resetState } from './state.js';
import { fetchMyProfile, fetchTeamStaff } from './api/profiles.js';
import { fetchTeam } from './api/teams.js';
import { fetchRosterBySector, fetchPendingDocuments } from './api/roster.js';
import { fetchHistory, fetchLiveGame } from './api/games.js';
import { fetchNextMatch } from './api/nextMatch.js';
import { fetchStandings } from './api/standings.js';
import { fetchSectors, fetchStaffSectors, fetchPlayerSectorIds } from './api/sectors.js';
import { fetchTrainings } from './api/trainings.js';
import { fetchCalendar } from './api/calendar.js';
import { fetchLinkedPlayers } from './api/family.js';
import { applyTheme } from './utils/theme.js';

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
  state.sectors = sectors;
  state.staff = staff;
  state.staffSectors = staffSectors;
  applyTheme(team);

  if (state.currentUser.role !== 'famiglia') {
    try { state.pendingDocsCount = (await fetchPendingDocuments(teamId)).length; }
    catch (e) { state.pendingDocsCount = 0; }
  }
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
  if (state.currentUser.role === 'admin') return state.sectors.map(s => s.id);
  if (state.currentUser.role === 'famiglia') return state.familySectorIds;
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
  if (!sectorId) {
    state.roster = []; state.history = []; state.liveGame = null;
    state.nextMatch = null; state.standings = []; state.trainings = []; state.calendar = [];
    return;
  }
  const [roster, history, liveGame, nextMatch, standings, trainings, calendar] = await Promise.all([
    fetchRosterBySector(sectorId),
    fetchHistory(sectorId),
    fetchLiveGame(sectorId),
    fetchNextMatch(sectorId),
    fetchStandings(sectorId),
    fetchTrainings(sectorId),
    fetchCalendar(sectorId)
  ]);
  state.roster = roster;
  state.history = history;
  state.liveGame = liveGame;
  state.nextMatch = nextMatch;
  state.standings = standings;
  state.trainings = trainings;
  state.calendar = calendar;
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
    const { getPendingAction, runPendingAction } = await import('./auth.js');
    const pending = getPendingAction();
    if (auth.user && pending) {
      await runPendingAction(pending);
      profile = await fetchMyProfile();
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
  if (profile.role === 'famiglia') await loadFamilyLinks();
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

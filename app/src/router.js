import { state, resetState } from './state.js';
import { fetchMyProfile } from './api/profiles.js';
import { fetchTeam } from './api/teams.js';
import { fetchRoster } from './api/roster.js';
import { fetchHistory, fetchLiveGame } from './api/games.js';
import { fetchNextMatch } from './api/nextMatch.js';
import { fetchStandings } from './api/standings.js';
import { fetchTeamStaff } from './api/profiles.js';
import { applyTheme } from './utils/theme.js';

export async function loadAllTeamData() {
  const teamId = state.currentUser.team_id;
  const [team, roster, history, liveGame, nextMatch, standings, staff] = await Promise.all([
    fetchTeam(teamId),
    fetchRoster(teamId),
    fetchHistory(teamId),
    fetchLiveGame(teamId),
    fetchNextMatch(teamId),
    fetchStandings(teamId),
    fetchTeamStaff(teamId)
  ]);
  state.teamProfile = team;
  state.roster = roster;
  state.history = history;
  state.liveGame = liveGame;
  state.nextMatch = nextMatch;
  state.standings = standings;
  state.staff = staff;
  applyTheme(team);
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
  await loadAllTeamData();
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

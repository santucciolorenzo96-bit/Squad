export const state = {
  teamProfile: null,   // { id, name, city, category, logo_url, primary_color, secondary_color, invite_code }
  currentUser: null,   // profile row + email: { id, team_id, display_name, role, email }
  staff: [],
  roster: [],
  history: [],
  liveGame: null,
  nextMatch: null,
  standings: [],
  currentTab: 'home',
  undoStack: [],
  selectedCourtId: null,
  pendingBenchId: null,
  showTovSubtypes: false
};

export function resetState() {
  state.teamProfile = null;
  state.currentUser = null;
  state.staff = [];
  state.roster = [];
  state.history = [];
  state.liveGame = null;
  state.nextMatch = null;
  state.standings = [];
  state.currentTab = 'home';
  state.undoStack = [];
  state.selectedCourtId = null;
  state.pendingBenchId = null;
  state.showTovSubtypes = false;
}

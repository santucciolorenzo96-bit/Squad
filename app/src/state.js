export const state = {
  teamProfile: null,   // { id, name, city, category, logo_url, primary_color, secondary_color, invite_code }
  currentUser: null,   // profile row + email: { id, team_id, display_name, role, email, phone, notifications_seen_at, finance_role, can_upload_documents }
  staff: [],
  staffSectors: {},    // { [profileId]: sectorId[] }
  sectors: [],
  activeSectorId: null,
  linkedPlayers: [],   // per profilo 'famiglia': i giocatori a cui è collegato
  familySectorIds: [], // per profilo 'famiglia': unione dei settori dei giocatori collegati
  roster: [],
  history: [],
  liveGame: null,
  nextMatch: null,
  standings: [],
  trainings: [],
  trainingRecurrences: [],
  calendar: [],
  notifications: [],
  pendingDocsCount: 0,
  expiringDocsCount: 0,
  presenzePeriod: 'month',
  financeSubTab: 'conti',
  financeFiscalYears: [],
  financeCategories: [],
  financeCostCenters: [],
  financeAccounts: [],
  financeAccountBalances: {},
  financeSuppliers: [],
  financeSponsors: [],
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
  state.staffSectors = {};
  state.sectors = [];
  state.activeSectorId = null;
  state.linkedPlayers = [];
  state.familySectorIds = [];
  state.roster = [];
  state.history = [];
  state.liveGame = null;
  state.nextMatch = null;
  state.standings = [];
  state.trainings = [];
  state.trainingRecurrences = [];
  state.calendar = [];
  state.notifications = [];
  state.pendingDocsCount = 0;
  state.financeSubTab = 'conti';
  state.financeFiscalYears = [];
  state.financeCategories = [];
  state.financeCostCenters = [];
  state.financeAccounts = [];
  state.financeAccountBalances = {};
  state.financeSuppliers = [];
  state.financeSponsors = [];
  state.currentTab = 'home';
  state.undoStack = [];
  state.selectedCourtId = null;
  state.pendingBenchId = null;
  state.showTovSubtypes = false;
}

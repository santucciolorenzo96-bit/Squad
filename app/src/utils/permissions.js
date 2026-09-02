export const ROLES = {
  admin: 'Admin',
  presidente: 'Presidente',
  staff: 'Staff',
  allenatore: 'Allenatore',
  segnapunti: 'Scout',
  genitore: 'Genitore',
  atleta: 'Atleta'
};
export const ROLE_CLASS = {
  admin: 'role-admin', presidente: 'role-admin', staff: 'role-staff',
  allenatore: 'role-allenatore', segnapunti: 'role-segnapunti',
  genitore: 'role-famiglia', atleta: 'role-famiglia'
};

// Ruoli con pieni poteri sulla società
export const ADMIN_ROLES = ['admin', 'presidente'];
// Chi ha responsabilità gestionali sui propri settori (lo staff dirigenziale
// gestisce anagrafica, documenti, presenze, allenamenti e calendario)
export const MANAGER_ROLES = ['admin', 'presidente', 'allenatore', 'staff'];
// Chi compone la rosa: è una scelta tecnica, lo staff non la tocca
export const ROSTER_ROLES = ['admin', 'presidente', 'allenatore'];
// Utenti base, collegati a un giocatore: stessi permessi, etichette diverse
export const LINKED_ROLES = ['genitore', 'atleta'];
// Ruoli assegnabili in autonomia al momento della registrazione. Lo staff è
// compreso perchè di per sé non dà nessun potere: ogni scrittura passa da
// can_manage_sector, che richiede un settore assegnato da un amministratore.
// Admin, presidente e allenatore restano fuori: quelli contano anche senza settori.
export const SELF_SIGNUP_ROLES = ['staff', 'segnapunti', 'genitore', 'atleta'];
// Ruoli che un amministratore può attribuire dalla schermata Utenti: tutti,
// inclusi Genitore e Atleta, altrimenti un account finito nel ruolo sbagliato
// non sarebbe più correggibile dall'interfaccia.
export const ASSIGNABLE_ROLES = ['admin', 'presidente', 'staff', 'allenatore', 'segnapunti', 'genitore', 'atleta'];

export function roleLabel(role) {
  return ROLES[role] || (role ? `Ruolo sconosciuto (${role})` : 'Ruolo non impostato');
}

export const TOV_TYPES = [
  { key: 'generica', label: 'Generica' },
  { key: 'palleggio', label: 'Palleggio' },
  { key: 'passaggio', label: 'Passaggio' },
  { key: 'passi', label: 'Passi/Sup.' }
];

export const DOC_TYPES = [
  { key: 'certificato_medico', label: 'Certificato medico agonistico' },
  { key: 'tesseramento_fip', label: 'Tesseramento FIP' }
];

export const FINANCE_DOC_TYPES = [
  { key: 'fattura', label: 'Fattura' },
  { key: 'ricevuta', label: 'Ricevuta' },
  { key: 'nota_spese', label: 'Nota spese' },
  { key: 'ricevuta_pagamento', label: 'Ricevuta di pagamento' },
  { key: 'documento_acquisto', label: 'Documento di acquisto' },
  { key: 'contratto', label: 'Contratto' },
  { key: 'documento_sponsor', label: 'Documento sponsor' },
  { key: 'altro', label: 'Altro' }
];

export const TABS = [
  { id: 'home', label: 'Home', group: 'settore', roles: [...MANAGER_ROLES, 'segnapunti', ...LINKED_ROLES], primary: true },
  { id: 'rosa', label: 'Rosa', group: 'settore', roles: [...ROSTER_ROLES, ...LINKED_ROLES] },
  { id: 'anagrafica', label: 'Anagrafica', group: 'settore', roles: [...MANAGER_ROLES, ...LINKED_ROLES] },
  // alsoIf: visibile anche a chi ha quel permesso, oltre ai ruoli elencati
  { id: 'partita', label: 'Partita', group: 'settore', roles: [...ROSTER_ROLES, 'segnapunti'], alsoIf: 'can_score_matches', primary: true },
  { id: 'allenamenti', label: 'Allenamenti', group: 'settore', roles: [...MANAGER_ROLES, 'segnapunti', ...LINKED_ROLES], primary: true },
  { id: 'presenze', label: 'Presenze', group: 'settore', roles: MANAGER_ROLES },
  { id: 'comunicazioni', label: 'Comunicazioni', group: 'settore', roles: [...MANAGER_ROLES, ...LINKED_ROLES] },
  { id: 'classifica', label: 'Classifica', group: 'settore', roles: [...MANAGER_ROLES, 'segnapunti', ...LINKED_ROLES] },
  { id: 'statistiche', label: 'Statistiche', group: 'settore', roles: [...ROSTER_ROLES, 'segnapunti'] },
  { id: 'calendario', label: 'Calendario', group: 'settore', roles: [...MANAGER_ROLES, ...LINKED_ROLES], primary: true },
  { id: 'situazione', label: 'Situazione', group: 'societa', roles: MANAGER_ROLES },
  { id: 'documenti', label: 'Documenti', group: 'societa', roles: MANAGER_ROLES },
  { id: 'utenti', label: 'Utenti', group: 'societa', roles: ADMIN_ROLES },
  { id: 'squadra', label: 'Squadra', group: 'societa', roles: ADMIN_ROLES },
  { id: 'finanza', label: 'Finanza', group: 'societa', financeGated: true }
];

export function canSeeTab(tab, user) {
  if (!user) return false;
  if (tab.financeGated) return !!user.finance_role;
  if (tab.alsoIf && user[tab.alsoIf]) return true;
  return tab.roles.includes(user.role);
}

export function canManageFinance(user) {
  return !!user && (user.finance_role === 'admin' || user.finance_role === 'manager');
}

export function isFinanceAdmin(user) {
  return !!user && user.finance_role === 'admin';
}

export function isAdmin(user) {
  return !!user && ADMIN_ROLES.includes(user.role);
}

// Prossima partita, allenamenti, classifica, calendario: gestione di settore
export function canEditHome(user) {
  return !!user && MANAGER_ROLES.includes(user.role);
}

// Comporre la rosa è una scelta tecnica: lo staff dirigenziale non la tocca
export function canEditRoster(user) {
  return !!user && ROSTER_ROLES.includes(user.role);
}

export function canReviewDocuments(user) {
  return !!user && MANAGER_ROLES.includes(user.role);
}

// Utente base collegato a un giocatore: Genitore e Atleta hanno gli stessi
// permessi, cambia solo l'etichetta con cui si presentano
export function isLinkedUser(user) {
  return !!user && LINKED_ROLES.includes(user.role);
}

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
// Ruoli assegnabili in autonomia al momento della registrazione. Lo staff è
// compreso perchè di per sé non dà nessun potere: ogni scrittura passa da
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
  // «Gestione» e non «Situazione»: la vecchia parola non diceva cosa ci trovi
  // dentro. Qui c'e' l'elenco di quello che manca e di chi va sistemato.
  { id: 'situazione', label: 'Gestione', group: 'societa', roles: MANAGER_ROLES },
  { id: 'documenti', label: 'Documenti', group: 'societa', roles: MANAGER_ROLES },
  { id: 'utenti', label: 'Utenti', group: 'societa', roles: ADMIN_ROLES },
  // «Impostazioni» e non «Squadra»: dentro ci sono identita' della societa',
  // categorie, stagioni e codice d'ingresso. Chiamarla Squadra la confondeva
  // con la macro Squadra, che sono le persone.
  { id: 'squadra', label: 'Impostazioni', group: 'societa', roles: ADMIN_ROLES },
  { id: 'finanza', label: 'Finanza', group: 'societa', financeGated: true }
];

/* ---------------------------------------------------------- macro categorie
 *
 * Quindici voci in colonna non sono un menu: sono un elenco, e per trovarne
 * una si legge tutto. Raggruppate diventano cinque voci di primo livello, e
 * cinque cose si riconoscono senza leggerle.
 *
 * Il criterio non e' il permesso — quello resta su ogni voce — ma la DOMANDA a
 * cui si sta rispondendo: chi ho in squadra, cosa facciamo in palestra, come
 * sono andate le partite, come sta la societa'. E' il modo in cui le cose si
 * cercano davvero, e non coincide con il modo in cui sono fatte.
 *
 * `icona` e' il volto della macro: e' l'icona di una delle sue voci, quella
 * che la rappresenta. Un glifo nuovo per il gruppo vorrebbe dire insegnare
 * cinque simboli in piu' senza aggiungere niente.
 */
export const MACRO = [
  { id: 'apertura', label: 'Home', icona: 'home', tabs: ['home'] },
  { id: 'squadra', label: 'Squadra', icona: 'rosa', tabs: ['rosa', 'anagrafica', 'comunicazioni'] },
  { id: 'palestra', label: 'Allenamenti', icona: 'allenamenti', tabs: ['allenamenti', 'presenze'] },
  { id: 'gare', label: 'Partite', icona: 'partita', tabs: ['calendario', 'partita', 'classifica', 'statistiche'] },
  { id: 'societa', label: 'Società', icona: 'squadra', tabs: ['situazione', 'documenti', 'finanza', 'utenti', 'squadra'] }
];

// Le macro con dentro solo le voci che questo utente puo' vedere, e senza
// quelle rimaste vuote: a un genitore la colonna non deve raccontare che
// esistono sezioni che non aprira' mai.
export function macroConVoci(visibili) {
  return MACRO
    .map(m => ({ ...m, voci: m.tabs.map(id => visibili.find(v => v.id === id)).filter(Boolean) }))
    .filter(m => m.voci.length > 0);
}

export function macroDiSezione(id) {
  const m = MACRO.find(x => x.tabs.indexOf(id) >= 0);
  return m ? m.id : null;
}

export function canSeeTab(tab, user) {
  if (!user) return false;
  if (tab.financeGated) return !!user.finance_role;
  if (tab.alsoIf && user[tab.alsoIf]) return true;
  return tab.roles.includes(user.role);
}

/* Gestire UNA categoria.
 *
 * Il ruolo dice cosa sai fare; l'assegnazione dice dove. Servono tutti e due.
 *
 * Serve da quando una persona puo' vedere una categoria per due motivi diversi:
 * perche' gliel'ha assegnata un amministratore, o perche' li' dentro c'e' una
 * scheda atleta collegata al suo account. Nel secondo caso guarda e basta —
 * anche se il suo ruolo, altrove, e' Allenatore.
 *
 * Non e' l'unica difesa: il database rifiuta comunque la scrittura, perche'
 * can_manage_sector() guarda le assegnazioni e non il ruolo. Questa serve a non
 * mostrare pulsanti che poi non funzionano.
 */
export function managesSector(user, sectorId, staffSectors) {
  if (!user || !sectorId) return false;
  if (ADMIN_ROLES.includes(user.role)) return true;
  return ((staffSectors || {})[user.id] || []).indexOf(sectorId) >= 0;
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

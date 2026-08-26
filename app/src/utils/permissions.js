export const ROLES = { admin: 'Amministratore', allenatore: 'Allenatore', segnapunti: 'Segnapunti', famiglia: 'Famiglia' };
export const ROLE_CLASS = { admin: 'role-admin', allenatore: 'role-allenatore', segnapunti: 'role-segnapunti', famiglia: 'role-famiglia' };

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
  { id: 'home', label: 'Home', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti', 'famiglia'], primary: true },
  { id: 'rosa', label: 'Rosa', group: 'settore', roles: ['admin', 'allenatore', 'famiglia'] },
  { id: 'anagrafica', label: 'Anagrafica', group: 'settore', roles: ['admin', 'allenatore', 'famiglia'] },
  { id: 'partita', label: 'Partita', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti'], primary: true },
  { id: 'allenamenti', label: 'Allenamenti', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti', 'famiglia'], primary: true },
  { id: 'classifica', label: 'Classifica', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti', 'famiglia'] },
  { id: 'storico', label: 'Storico', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'statistiche', label: 'Statistiche', group: 'settore', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'calendario', label: 'Calendario', group: 'settore', roles: ['admin', 'allenatore', 'famiglia'], primary: true },
  { id: 'utenti', label: 'Utenti', group: 'societa', roles: ['admin'] },
  { id: 'squadra', label: 'Squadra', group: 'societa', roles: ['admin'] },
  { id: 'finanza', label: 'Finanza', group: 'societa', financeGated: true }
];

export function canSeeTab(tab, user) {
  if (!user) return false;
  if (tab.financeGated) return !!user.finance_role;
  return tab.roles.includes(user.role);
}

export function canManageFinance(user) {
  return !!user && (user.finance_role === 'admin' || user.finance_role === 'manager');
}

export function isFinanceAdmin(user) {
  return !!user && user.finance_role === 'admin';
}

export function canEditHome(user) {
  return !!user && (user.role === 'admin' || user.role === 'allenatore');
}

export function canEditRoster(user) {
  return !!user && (user.role === 'admin' || user.role === 'allenatore');
}

export function canReviewDocuments(user) {
  return !!user && (user.role === 'admin' || user.role === 'allenatore');
}

export function isFamiglia(user) {
  return !!user && user.role === 'famiglia';
}

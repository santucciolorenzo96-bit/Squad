export const ROLES = { admin: 'Amministratore', allenatore: 'Allenatore', segnapunti: 'Segnapunti' };
export const ROLE_CLASS = { admin: 'role-admin', allenatore: 'role-allenatore', segnapunti: 'role-segnapunti' };

export const TOV_TYPES = [
  { key: 'generica', label: 'Generica' },
  { key: 'palleggio', label: 'Palleggio' },
  { key: 'passaggio', label: 'Passaggio' },
  { key: 'passi', label: 'Passi/Sup.' }
];

export const TABS = [
  { id: 'home', label: 'Home', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'rosa', label: 'Rosa', roles: ['admin', 'allenatore'] },
  { id: 'partita', label: 'Partita', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'storico', label: 'Storico', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'statistiche', label: 'Statistiche', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'classifica', label: 'Classifica', roles: ['admin', 'allenatore', 'segnapunti'] },
  { id: 'calendario', label: 'Calendario', roles: ['admin', 'allenatore'] },
  { id: 'utenti', label: 'Utenti', roles: ['admin'] },
  { id: 'squadra', label: 'Squadra', roles: ['admin'] }
];

export function canSeeTab(tab, user) {
  return !!user && tab.roles.includes(user.role);
}

export function canEditHome(user) {
  return !!user && (user.role === 'admin' || user.role === 'allenatore');
}

export function canEditRoster(user) {
  return !!user && (user.role === 'admin' || user.role === 'allenatore');
}

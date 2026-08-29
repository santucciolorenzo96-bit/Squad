// Set di icone nel linguaggio della brand guide SQUAD: tratto sottile,
// terminali arrotondati e piccoli "nodi" che richiamano il simbolo connesso.
// Tutte su viewBox 20x20, colore ereditato da currentColor.

export const NAV_ICONS = {
  home: '<path d="M3.2 9.4 10 4l6.8 5.4"/><path d="M5.1 8.6V16a1 1 0 0 0 1 1h7.8a1 1 0 0 0 1-1V8.6"/><circle cx="10" cy="4" r="1.7" fill="currentColor" stroke="none"/>',
  rosa: '<circle cx="10" cy="5.2" r="2.2"/><circle cx="5" cy="14" r="2.2"/><circle cx="15" cy="14" r="2.2"/><path d="M8.7 7.1 6.3 11.9M11.3 7.1l2.4 4.8M7.2 14h5.6"/>',
  anagrafica: '<rect x="2.8" y="4.2" width="14.4" height="11.6" rx="2.6"/><circle cx="7.3" cy="9" r="1.8"/><path d="M4.6 13.4c.5-1.4 1.5-2.2 2.7-2.2s2.2.8 2.7 2.2"/><path d="M12.4 8.4h3.2M12.4 11.2h3.2"/>',
  partita: '<circle cx="10" cy="10" r="7"/><path d="M10 3v14"/><path d="M5.05 5.05c2.7 2.7 2.7 7.2 0 9.9M14.95 5.05c-2.7 2.7-2.7 7.2 0 9.9"/>',
  allenamenti: '<rect x="2.8" y="4.6" width="14.4" height="12.2" rx="2.6"/><path d="M2.8 8.4h14.4M6.6 2.8v3.2M13.4 2.8v3.2"/><circle cx="10" cy="12.4" r="1.5" fill="currentColor" stroke="none"/>',
  presenze: '<circle cx="10" cy="10" r="7"/><path d="M6.8 10.2 8.9 12.3l4.3-4.5"/>',
  classifica: '<path d="M3 16.6h14"/><path d="M5.6 16.6v-3.4M10 16.6V8.8M14.4 16.6V5.4"/><circle cx="5.6" cy="13.2" r="1.5" fill="currentColor" stroke="none"/><circle cx="10" cy="8.8" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.4" cy="5.4" r="1.5" fill="currentColor" stroke="none"/>',
  statistiche: '<path d="M3.2 16.6V3.6M3.2 16.6h13.6"/><rect x="5.8" y="10.8" width="2.6" height="5.8" rx="1.1"/><rect x="9.9" y="7" width="2.6" height="9.6" rx="1.1"/><rect x="14" y="12.6" width="2.6" height="4" rx="1.1"/>',
  calendario: '<rect x="2.8" y="4.6" width="14.4" height="12.2" rx="2.6"/><path d="M2.8 8.4h14.4M6.6 2.8v3.2M13.4 2.8v3.2"/><circle cx="7" cy="12.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="10.6" cy="12.2" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.2" cy="12.2" r="1.2" fill="currentColor" stroke="none"/>',
  utenti: '<circle cx="7.2" cy="6.6" r="2.4"/><path d="M2.9 15.9c0-2.7 1.9-4.5 4.3-4.5s4.3 1.8 4.3 4.5"/><circle cx="15" cy="8.2" r="2"/><path d="M13.4 12.5c1.8.4 3 1.8 3 3.4"/>',
  squadra: '<path d="M10 2.8 16 5.2v4.6c0 3.8-2.5 6.3-6 7.4-3.5-1.1-6-3.6-6-7.4V5.2z" stroke-linejoin="round"/><circle cx="10" cy="9.3" r="1.9"/>',
  finanza: '<circle cx="10" cy="10" r="7"/><path d="M13 7.4a3.7 3.7 0 0 0-5.2 1.3M13 12.6a3.7 3.7 0 0 1-5.2-1.3"/><path d="M6.5 9.3h4.6M6.5 11h4.6"/>'
};

export function navIcon(id, size = 18) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${NAV_ICONS[id] || ''}</svg>`;
}

// Casa = tetto; Trasferta = spostamento da un nodo all'altro (motivo "connected motion").
export function venueIcon(isHome, size = 14) {
  const inner = isHome
    ? '<path d="M2.6 7.6 8 3.3l5.4 4.3"/><path d="M4.1 6.9v6a.9.9 0 0 0 .9.9h6a.9.9 0 0 0 .9-.9v-6"/>'
    : '<circle cx="3.4" cy="8" r="1.9"/><circle cx="12.6" cy="8" r="1.9"/><path d="M5.9 8h3.6"/><path d="M8.2 6.3 9.9 8l-1.7 1.7"/>';
  return `<svg class="venue-ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

export function venueLabel(isHome, size = 14) {
  return `${venueIcon(isHome, size)} ${isHome ? 'Casa' : 'Trasferta'}`;
}

// Icone di supporto usate nelle liste (luogo, ricorrenza, presenze).
export function pinIcon(size = 13) {
  return `<svg class="venue-ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 14.2s5-4 5-7.4a5 5 0 0 0-10 0c0 3.4 5 7.4 5 7.4z"/><circle cx="8" cy="6.7" r="1.9"/></svg>`;
}

export function repeatIcon(size = 13) {
  return `<svg class="venue-ico" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7.2A3.6 3.6 0 0 1 6.6 3.6h5.2"/><path d="M9.8 1.8l2 1.8-2 1.8"/><path d="M13 8.8a3.6 3.6 0 0 1-3.6 3.6H4.2"/><path d="M6.2 14.2l-2-1.8 2-1.8"/></svg>`;
}

export function peopleIcon(size = 15) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${NAV_ICONS.rosa}</svg>`;
}

export function ballIcon(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${NAV_ICONS.partita}</svg>`;
}

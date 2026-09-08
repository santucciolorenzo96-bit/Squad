// Gerarchia delle categorie.
//
// Una sottocategoria è un settore con un genitore: rosa, allenamenti, partite e
// permessi continuano a ragionare per settore senza sapere che esiste una
// gerarchia. Qui c'è solo il modo di presentarle in ordine e di dire per esteso
// di quale si sta parlando.

// Genitori in ordine, ognuno seguito dai propri figli. Un figlio il cui
// genitore non è nell'elenco (settore cancellato, dati parziali) non sparisce:
// finisce in fondo come se fosse di primo livello. Nascondere una categoria
// perché manca il suo genitore vorrebbe dire nascondere una rosa.
export function orderedSectors(sectors) {
  const list = sectors || [];
  const byOrder = (a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name);
  const parents = list.filter(s => !s.parent_id).sort(byOrder);
  const known = new Set(parents.map(s => s.id));
  const out = [];
  parents.forEach(p => {
    out.push(p);
    list.filter(s => s.parent_id === p.id).sort(byOrder).forEach(f => out.push(f));
  });
  list.filter(s => s.parent_id && !known.has(s.parent_id)).sort(byOrder).forEach(o => out.push(o));
  return out;
}

// "Under 15 · Blu" quando serve dire di quale si parla fuori contesto,
// "Blu" da solo quando il genitore è già visibile lì accanto.
export function sectorFullName(sector, sectors) {
  if (!sector) return '';
  if (!sector.parent_id) return sector.name;
  const parent = (sectors || []).find(s => s.id === sector.parent_id);
  return parent ? parent.name + ' · ' + sector.name : sector.name;
}

export function hasChildren(sector, sectors) {
  return (sectors || []).some(s => s.parent_id === sector.id);
}

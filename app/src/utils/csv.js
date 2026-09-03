// Export in CSV. Fino a oggi l'unico export dell'app era il tabellino di una
// singola partita di basket: una società non aveva modo di portarsi via i
// propri dati, e a un atleta che li chiedeva — diritto che ha — non si sapeva
// cosa rispondere.
//
// Punto e virgola come separatore e BOM in testa: è la combinazione che Excel
// italiano apre senza chiedere niente. Con la virgola finirebbe tutto in una
// colonna sola, e senza BOM gli accenti diventano illeggibili.

function cell(v) {
  if (v == null) return '';
  const s = String(v);
  // Il separatore dentro un valore romperebbe le colonne: diventa una virgola.
  // Gli spazi attorno vengono assorbiti, altrimenti "Rossi; Mario" uscirebbe
  // come "Rossi,  Mario" con due spazi.
  return s.replace(/\s*[;\r\n]+\s*/g, ', ').trim();
}

export function toCsv(headers, rows) {
  return headers.join(';') + '\n'
    + rows.map(r => r.map(cell).join(';')).join('\n');
}

export function downloadCsv(filename, headers, rows) {
  const blob = new Blob(['﻿' + toCsv(headers, rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function safeName(s) {
  return (s || 'squad').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

// Generazione PDF. jsPDF si importa solo quando si genera un documento, così
// non pesa sull'avvio dell'app (finisce in un chunk separato).

const MM = { left: 20, right: 20, top: 18, bottom: 18 };
const PAGE_W = 210, PAGE_H = 297; // A4 in mm

export async function createDoc() {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFont('helvetica', 'normal');
  return doc;
}

export function contentWidth() {
  return PAGE_W - MM.left - MM.right;
}

/** Intestazione con i dati della società. Restituisce la y da cui proseguire. */
export function drawHeader(doc, team, title) {
  let y = MM.top;
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text(team.name || '', MM.left, y);
  y += 5;

  doc.setFont('helvetica', 'normal').setFontSize(9);
  const rows = [
    [team.address, team.zip, team.city, team.province ? `(${team.province})` : ''].filter(Boolean).join(' '),
    [team.fiscal_code ? `C.F. ${team.fiscal_code}` : '', team.vat_number ? `P.IVA ${team.vat_number}` : ''].filter(Boolean).join(' — '),
    team.registry_number ? `Registro attività sportive n. ${team.registry_number}` : '',
    [team.contact_email, team.contact_phone].filter(Boolean).join(' — ')
  ].filter(Boolean);
  rows.forEach(r => { doc.text(r, MM.left, y); y += 4; });

  y += 4;
  doc.setDrawColor(180).setLineWidth(0.3).line(MM.left, y, PAGE_W - MM.right, y);
  y += 9;

  doc.setFont('helvetica', 'bold').setFontSize(13);
  doc.text(title, MM.left, y);
  y += 8;
  doc.setFont('helvetica', 'normal').setFontSize(10);
  return y;
}

/** Paragrafo giustificato alla larghezza utile, con a capo automatico. */
export function drawParagraph(doc, text, y, { size = 10, gap = 5 } = {}) {
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, contentWidth());
  lines.forEach(line => {
    y = pageBreakIfNeeded(doc, y);
    doc.text(line, MM.left, y);
    y += gap;
  });
  return y;
}

/** Riga "Etichetta: valore", con il valore in grassetto. */
export function drawField(doc, label, value, y, { labelWidth = 46 } = {}) {
  y = pageBreakIfNeeded(doc, y);
  doc.setFontSize(10).setFont('helvetica', 'normal');
  doc.text(label, MM.left, y);
  doc.setFont('helvetica', 'bold');
  doc.text(String(value ?? ''), MM.left + labelWidth, y);
  doc.setFont('helvetica', 'normal');
  return y + 6;
}

/** Riga da compilare a mano: etichetta seguita da una linea vuota. */
export function drawBlankField(doc, label, y, { labelWidth = 46 } = {}) {
  y = pageBreakIfNeeded(doc, y);
  doc.setFontSize(10);
  doc.text(label, MM.left, y);
  doc.setDrawColor(150).setLineWidth(0.2);
  doc.line(MM.left + labelWidth, y + 1, PAGE_W - MM.right, y + 1);
  return y + 8;
}

/** Tabella semplice: colonne a larghezza fissa in mm. */
export function drawTable(doc, headers, rows, widths, y) {
  y = pageBreakIfNeeded(doc, y, 16);
  doc.setFontSize(9).setFont('helvetica', 'bold');
  let x = MM.left;
  headers.forEach((h, i) => { doc.text(h, x, y); x += widths[i]; });
  y += 2;
  doc.setDrawColor(180).setLineWidth(0.3).line(MM.left, y, PAGE_W - MM.right, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  rows.forEach(r => {
    y = pageBreakIfNeeded(doc, y);
    x = MM.left;
    r.forEach((cell, i) => { doc.text(String(cell ?? ''), x, y); x += widths[i]; });
    y += 5.5;
  });
  return y;
}

export function drawSignature(doc, y, { place = '', label = 'Il legale rappresentante' } = {}) {
  y = pageBreakIfNeeded(doc, y, 34);
  y += 10;
  doc.setFontSize(10);
  doc.text(`Luogo e data ${place ? place + ', ' : ''}______________________`, MM.left, y);
  y += 16;
  doc.setDrawColor(150).setLineWidth(0.2);
  doc.line(PAGE_W - MM.right - 65, y, PAGE_W - MM.right, y);
  y += 4;
  doc.setFontSize(9).text(label, PAGE_W - MM.right - 65, y);
  return y;
}

function pageBreakIfNeeded(doc, y, needed = 8) {
  if (y + needed > PAGE_H - MM.bottom) {
    doc.addPage();
    return MM.top;
  }
  return y;
}

export function save(doc, filename) {
  doc.save(filename.replace(/[^a-zA-Z0-9._-]/g, '_'));
}

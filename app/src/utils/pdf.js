// Generazione PDF. jsPDF si importa solo quando si genera un documento, così
// non pesa sull'avvio dell'app (finisce in un chunk separato).

const MM = { left: 20, right: 20, top: 18, bottom: 18 };
const PAGE_W = 210, PAGE_H = 297; // A4 in mm

/* I COLORI DEL DOCUMENTO.
 *
 * Pochi e con un mestiere, non una tavolozza. Un referto stampato finisce in
 * una cartellina e viene letto di fretta: il colore serve a far trovare le
 * cose, non a decorarle.
 *
 * Il blu e' quello dell'app, cosi' il foglio e lo schermo si riconoscono come
 * la stessa cosa. Il grigio chiarissimo delle righe alterne non e' estetica:
 * su una tabella di dodici colonne e' quello che impedisce all'occhio di
 * saltare di riga a meta' strada. E resta leggibile anche stampato in bianco
 * e nero, che e' come la meta' dei referti finisce davvero.
 */
const COLORI = {
  blu: [37, 99, 235],
  bluScuro: [23, 55, 135],
  testo: [24, 26, 32],
  tenue: [116, 122, 136],
  riga: [244, 246, 250],
  linea: [214, 218, 226],
  verde: [22, 138, 90],
  rosso: [190, 48, 48]
};

export const TINTE = COLORI;

function riempi(doc, colore) { doc.setFillColor(colore[0], colore[1], colore[2]); }
function scrivi(doc, colore) { doc.setTextColor(colore[0], colore[1], colore[2]); }
function traccia(doc, colore) { doc.setDrawColor(colore[0], colore[1], colore[2]); }

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
  // Una fascia di colore in cima, alta quanto basta a dire dove finisce
  // l'intestazione e comincia il documento. Prima era una riga grigia.
  riempi(doc, COLORI.blu);
  doc.rect(0, 0, PAGE_W, 6, 'F');

  let y = MM.top;
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text(team.name || '', MM.left, y);
  y += 5;

  scrivi(doc, COLORI.tenue);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const rows = [
    [team.address, team.zip, team.city, team.province ? `(${team.province})` : ''].filter(Boolean).join(' '),
    [team.fiscal_code ? `C.F. ${team.fiscal_code}` : '', team.vat_number ? `P.IVA ${team.vat_number}` : ''].filter(Boolean).join(' — '),
    team.registry_number ? `Registro attività sportive n. ${team.registry_number}` : '',
    [team.contact_email, team.contact_phone].filter(Boolean).join(' — ')
  ].filter(Boolean);
  rows.forEach(r => { doc.text(r, MM.left, y); y += 4; });

  y += 4;
  traccia(doc, COLORI.linea);
  doc.setLineWidth(0.3).line(MM.left, y, PAGE_W - MM.right, y);
  y += 9;

  scrivi(doc, COLORI.bluScuro);
  doc.setFont('helvetica', 'bold').setFontSize(15);
  doc.text(title, MM.left, y);
  y += 8;
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  return y;
}

/** Il titolo di una sezione: una barretta di colore e il nome accanto. */
export function drawSection(doc, testo, y) {
  y = pageBreakIfNeeded(doc, y, 14);
  y += 2;
  riempi(doc, COLORI.blu);
  doc.rect(MM.left, y - 3.4, 1.4, 4.6, 'F');
  scrivi(doc, COLORI.bluScuro);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text(testo, MM.left + 4, y);
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  return y + 6;
}

/* Il risultato, grande, in cima al referto: e' la prima cosa che si cerca
   aprendo il foglio, e su carta non si puo' toccare niente per scoprirla. */
export function drawScore(doc, sinistra, destra, nostri, loro, y) {
  y = pageBreakIfNeeded(doc, y, 22);
  const vinta = (nostri || 0) > (loro || 0);
  riempi(doc, COLORI.riga);
  doc.roundedRect(MM.left, y - 5, contentWidth(), 17, 1.6, 1.6, 'F');

  scrivi(doc, COLORI.tenue);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  doc.text(String(sinistra || ''), MM.left + 5, y);
  doc.text(String(destra || ''), PAGE_W - MM.right - 5, y, { align: 'right' });

  scrivi(doc, vinta ? COLORI.verde : COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(19);
  doc.text(`${nostri ?? 0} - ${loro ?? 0}`, PAGE_W / 2, y + 6, { align: 'center' });

  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  return y + 18;
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

/* LA TABELLA.
 *
 * Intestazione su fondo blu con il testo bianco, righe alterne su grigio
 * chiarissimo, una linea sotto l'ultima. Tre cose che non sono decorazione:
 * l'intestazione colorata resta riconoscibile quando la tabella continua
 * sulla pagina dopo, le righe alterne impediscono all'occhio di cambiare
 * riga a meta' strada su dodici colonne, e la linea di chiusura dice dove
 * finiscono i dati e comincia la legenda.
 *
 * `totale` e' la riga della squadra: stessa tabella, fondo piu' marcato e
 * testo in grassetto, perche' e' un totale e non una dodicesima giocatrice.
 *
 * Su una pagina nuova l'intestazione si ristampa da sola. Una tabella che
 * continua senza intestazione e' una tabella di numeri anonimi.
 */
export function drawTable(doc, headers, rows, widths, y, { totale = null, allineaDa = 2 } = {}) {
  const ALTA = 6.2;

  function intestazione(yy) {
    riempi(doc, COLORI.blu);
    doc.rect(MM.left, yy - 4.2, contentWidth(), ALTA, 'F');
    scrivi(doc, [255, 255, 255]);
    doc.setFontSize(8.5).setFont('helvetica', 'bold');
    let x = MM.left + 1.8;
    headers.forEach((h, i) => {
      const dx = i >= allineaDa ? widths[i] - 3.6 : 0;
      doc.text(String(h), x + dx, yy, i >= allineaDa ? { align: 'right' } : undefined);
      x += widths[i];
    });
    scrivi(doc, COLORI.testo);
    return yy + ALTA;
  }

  y = pageBreakIfNeeded(doc, y, 20);
  y = intestazione(y);

  doc.setFont('helvetica', 'normal').setFontSize(8.5);
  rows.forEach((r, n) => {
    if (y + ALTA > PAGE_H - MM.bottom) {
      doc.addPage();
      y = intestazione(MM.top + 2);
      doc.setFont('helvetica', 'normal').setFontSize(8.5);
    }
    if (n % 2 === 1) {
      riempi(doc, COLORI.riga);
      doc.rect(MM.left, y - 4.2, contentWidth(), ALTA, 'F');
    }
    let x = MM.left + 1.8;
    r.forEach((cella, i) => {
      const testo = String(cella == null ? '' : cella);
      const dx = i >= allineaDa ? widths[i] - 3.6 : 0;
      doc.text(testo, x + dx, y, i >= allineaDa ? { align: 'right' } : undefined);
      x += widths[i];
    });
    y += ALTA;
  });

  if (totale) {
    if (y + ALTA > PAGE_H - MM.bottom) { doc.addPage(); y = intestazione(MM.top + 2); }
    riempi(doc, [226, 231, 240]);
    doc.rect(MM.left, y - 4.2, contentWidth(), ALTA, 'F');
    doc.setFont('helvetica', 'bold').setFontSize(8.5);
    let x = MM.left + 1.8;
    totale.forEach((cella, i) => {
      const testo = String(cella == null ? '' : cella);
      const dx = i >= allineaDa ? widths[i] - 3.6 : 0;
      doc.text(testo, x + dx, y, i >= allineaDa ? { align: 'right' } : undefined);
      x += widths[i];
    });
    y += ALTA;
    doc.setFont('helvetica', 'normal');
  }

  traccia(doc, COLORI.linea);
  doc.setLineWidth(0.3).line(MM.left, y - 4.2, PAGE_W - MM.right, y - 4.2);
  return y + 1;
}

/* Riquadri affiancati con un numero grande e un'etichetta sotto: sul foglio
   fanno lo stesso mestiere che fanno a schermo, cioe' farsi leggere senza
   essere cercati. */
export function drawTiles(doc, voci, y) {
  if (!voci || voci.length === 0) return y;
  y = pageBreakIfNeeded(doc, y, 20);
  const larga = contentWidth() / voci.length;
  voci.forEach((v, i) => {
    const x = MM.left + i * larga;
    riempi(doc, COLORI.riga);
    doc.roundedRect(x + (i ? 1.2 : 0), y - 4, larga - 2.4, 15, 1.4, 1.4, 'F');
    scrivi(doc, v.tono === 'rosso' ? COLORI.rosso : (v.tono === 'verde' ? COLORI.verde : COLORI.bluScuro));
    doc.setFont('helvetica', 'bold').setFontSize(13);
    doc.text(String(v.valore), x + larga / 2, y + 2.5, { align: 'center' });
    scrivi(doc, COLORI.tenue);
    doc.setFont('helvetica', 'normal').setFontSize(7.5);
    doc.text(String(v.etichetta), x + larga / 2, y + 7.6, { align: 'center', maxWidth: larga - 4 });
    scrivi(doc, COLORI.testo);
  });
  doc.setFontSize(10);
  return y + 17;
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

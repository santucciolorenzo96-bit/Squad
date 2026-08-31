// Documenti amministrativi generati in PDF a partire dai dati già in archivio.
import { createDoc, drawHeader, drawParagraph, drawField, drawBlankField, drawTable, drawSignature, save } from '../utils/pdf.js';

function fmtDate(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('it-IT') : '';
}
function fmtMoney(n) {
  return (n ?? 0).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
function slug(s) {
  return (s || '').trim().replace(/\s+/g, '_');
}

/**
 * Dichiarazione delle quote versate, da allegare alla dichiarazione dei redditi
 * per la detrazione delle spese sportive dei ragazzi. Certifica quanto
 * effettivamente incassato nell'anno solare, non quanto dovuto.
 */
export async function generateTaxDeclaration({ team, player, payments, year, guardianName }) {
  const doc = await createDoc();
  let y = drawHeader(doc, team, `Dichiarazione delle quote versate — anno ${year}`);

  const rep = team.legal_rep || '________________________________';
  y = drawParagraph(doc,
    `Il sottoscritto ${rep}, in qualità di legale rappresentante di ${team.name || ''}` +
    `${team.fiscal_code ? `, codice fiscale ${team.fiscal_code}` : ''}, sotto la propria responsabilità`,
    y);
  y += 2;
  doc.setFont('helvetica', 'bold');
  y = drawParagraph(doc, 'DICHIARA', y, { size: 11 });
  doc.setFont('helvetica', 'normal');
  y += 2;

  y = drawParagraph(doc,
    `che per l'atleta di seguito indicato sono state versate a questa associazione, nel corso dell'anno ${year}, ` +
    `le somme elencate a titolo di quota di iscrizione e frequenza dell'attività sportiva dilettantistica.`,
    y);
  y += 4;

  y = drawField(doc, 'Atleta', player.name, y);
  if (player.birth_date) y = drawField(doc, 'Data di nascita', fmtDate(player.birth_date), y);
  if (player.fiscal_code) y = drawField(doc, 'Codice fiscale', player.fiscal_code, y);
  if (guardianName) y = drawField(doc, 'Versamenti a cura di', guardianName, y);
  y += 4;

  const total = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  if (payments.length) {
    y = drawTable(doc,
      ['Data', 'Causale', 'Modalità', 'Importo'],
      payments.map(p => [
        fmtDate(p.paid_at),
        (p.finance_entries && p.finance_entries.description) || 'Quota',
        p.method || '',
        fmtMoney(p.amount)
      ]),
      [26, 78, 34, 32], y);
    y += 3;
    doc.setFont('helvetica', 'bold');
    y = drawField(doc, 'Totale versato', fmtMoney(total), y, { labelWidth: 34 });
    doc.setFont('helvetica', 'normal');
  } else {
    y = drawParagraph(doc, `Nessun versamento registrato per l'anno ${year}.`, y);
  }

  y += 4;
  y = drawParagraph(doc,
    'La presente dichiarazione è rilasciata ai fini della detrazione prevista per le spese di iscrizione e ' +
    'abbonamento ad associazioni sportive dilettantistiche, palestre e piscine destinate ai ragazzi. ' +
    'Si invita a verificare requisiti e limiti previsti dalla normativa vigente al momento della dichiarazione dei redditi.',
    y, { size: 9, gap: 4.2 });

  drawSignature(doc, y, { place: team.city || '' });
  save(doc, `dichiarazione_${year}_${slug(player.name)}.pdf`);
}

/**
 * Modulo d'iscrizione. Con `player` valorizzato i campi noti arrivano
 * precompilati; senza, esce il modulo in bianco da distribuire.
 */
export async function generateEnrollmentForm({ team, player, sectorName, season }) {
  const doc = await createDoc();
  let y = drawHeader(doc, team, `Modulo di iscrizione${season ? ` — stagione ${season}` : ''}`);

  y = drawParagraph(doc,
    'Il sottoscritto genitore o esercente la potestà genitoriale chiede l\'iscrizione del minore indicato ' +
    'alle attività sportive organizzate dall\'associazione, dichiarando di aver preso visione dello statuto ' +
    'e dei regolamenti interni.', y, { size: 9.5, gap: 4.5 });
  y += 5;

  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Dati dell\'atleta', 20, y); y += 7;
  doc.setFont('helvetica', 'normal');

  const field = (label, value) => {
    y = value ? drawField(doc, label, value, y) : drawBlankField(doc, label, y);
  };
  field('Cognome e nome', player && player.name);
  field('Data di nascita', player && fmtDate(player.birth_date));
  field('Luogo di nascita', null);
  field('Codice fiscale', player && player.fiscal_code);
  field('Residenza', null);
  field('Categoria', sectorName);
  field('Numero di maglia', player && player.number && player.number !== '-' ? player.number : null);

  y += 4;
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Genitore o tutore', 20, y); y += 7;
  doc.setFont('helvetica', 'normal');
  y = drawBlankField(doc, 'Cognome e nome', y);
  y = drawBlankField(doc, 'Codice fiscale', y);
  y = player && player.guardian_phone
    ? drawField(doc, 'Telefono', player.guardian_phone, y)
    : drawBlankField(doc, 'Telefono', y);
  y = player && player.email
    ? drawField(doc, 'Email', player.email, y)
    : drawBlankField(doc, 'Email', y);

  y += 4;
  y = drawParagraph(doc,
    'Allegare: certificato medico agonistico in corso di validità, documento di identità del genitore, ' +
    'fototessera dell\'atleta.', y, { size: 9, gap: 4.2 });
  y += 2;
  y = drawParagraph(doc,
    'Autorizzo il trattamento dei dati personali per le finalità connesse all\'attività sportiva e agli ' +
    'adempimenti federali, ai sensi del Regolamento UE 2016/679.', y, { size: 9, gap: 4.2 });

  drawSignature(doc, y, { label: 'Firma del genitore o tutore' });
  save(doc, player ? `iscrizione_${slug(player.name)}.pdf` : 'modulo_iscrizione_vuoto.pdf');
}

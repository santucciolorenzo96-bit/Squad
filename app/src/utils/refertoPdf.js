import { createDoc, drawHeader, drawParagraph, drawTable, save } from './pdf.js';
import { refertoPartita, tabellaTabellino, quota } from './referto.js';

/* Il referto in PDF.
 *
 * Una pagina, nell'ordine in cui la si legge: il risultato, i set, le due fasi,
 * le rotazioni, il tabellino. Chi lo apre cerca prima com'è finita e poi perché,
 * e le due cose stanno in quest'ordine anche sul foglio.
 *
 * Nessun colore e nessun riquadro: è un documento che finisce stampato e
 * infilato in una cartellina, non una schermata.
 */

function fmtData(d) {
  if (!d) return '';
  const x = new Date(d);
  return isNaN(x) ? '' : x.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

function pulisci(s) {
  return String(s || '').trim().replace(/\s+/g, '_').replace(/[^\w\-]/g, '');
}

export async function generaRefertoPdf({ team, game, sport, sectorName }) {
  const r = refertoPartita(game, sport);
  const doc = await createDoc();
  const nostri = (team && team.name) || 'Noi';

  const titolo = `${nostri} — ${game.oppName}`;
  let y = drawHeader(doc, team || {}, titolo);

  const riga = [
    sectorName,
    fmtData(game.date || game.ended_at || game.started_at),
    game.friendly ? 'amichevole' : 'campionato'
  ].filter(Boolean).join(' · ');
  y = drawParagraph(doc, riga, y);
  y += 2;

  // Il risultato, grande: è la prima cosa che si cerca.
  doc.setFont('helvetica', 'bold').setFontSize(16);
  doc.text(`${game.teamScore ?? 0} – ${game.oppScore ?? 0}`, 20, y + 4);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  y += 12;

  // ------------------------------------------------------------------ i set
  if (r.set.length) {
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('I set', 20, y); y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10);

    y = drawTable(doc,
      ['Set', 'Punteggio', 'Cambio palla', 'Break'],
      r.set.map(s => [
        String(s.n),
        `${s.us}-${s.them}`,
        quota(s.so) == null ? '—' : `${quota(s.so)}%  (${s.so.v}/${s.so.t})`,
        quota(s.bp) == null ? '—' : `${quota(s.bp)}%  (${s.bp.v}/${s.bp.t})`
      ]),
      [22, 34, 52, 52], y);
    y += 4;

    if (r.fasi.so.t || r.fasi.bp.t) {
      y = drawParagraph(doc,
        `In tutta la partita: cambio palla ${quota(r.fasi.so) ?? '—'}% ` +
        `(${r.fasi.so.v} su ${r.fasi.so.t}), break ${quota(r.fasi.bp) ?? '—'}% ` +
        `(${r.fasi.bp.v} su ${r.fasi.bp.t}).`, y);
      y += 3;
    }
  }

  // ----------------------------------------------------------- le rotazioni
  if (r.rotazioni.length) {
    doc.setFont('helvetica', 'bold').setFontSize(11);
    doc.text('Le rotazioni', 20, y); y += 6;
    doc.setFont('helvetica', 'normal').setFontSize(10);

    y = drawTable(doc,
      ['Rotazione', 'Punti fatti', 'Punti subiti', 'Saldo'],
      r.rotazioni.map(x => [
        'R' + x.n,
        String(x.f),
        String(x.s),
        (x.saldo > 0 ? '+' : '') + x.saldo
      ]),
      [34, 38, 38, 30], y);
    y += 6;
  }

  // ------------------------------------------------------------ il tabellino
  const t = tabellaTabellino(r, sport);
  doc.setFont('helvetica', 'bold').setFontSize(11);
  doc.text('Il tabellino', 20, y); y += 6;
  doc.setFont('helvetica', 'normal').setFontSize(10);

  /* Le larghezze si calcolano, non si scrivono a mano.
   *
   * Ogni sport dichiara le sue colonne, e la pallacanestro ne ha il doppio
   * della pallavolo: con larghezze fisse il tabellino del basket usciva dal
   * foglio, e le ultime colonne finivano stampate nel nulla. Qui la prima
   * resta stretta, il nome prende quello che gli serve, e il resto si divide
   * in parti uguali dentro il margine. */
  const DISPONIBILE = 170;             // A4 meno i due margini da 20
  const nStat = Math.max(1, t.intestazioni.length - 2);
  const nome = nStat > 8 ? 34 : 44;
  const larghezze = t.intestazioni.map((_, i) =>
    i === 0 ? 9 : i === 1 ? nome : (DISPONIBILE - 9 - nome) / nStat
  );
  const righe = t.totale ? [...t.righe, t.totale] : t.righe;
  y = drawTable(doc, t.intestazioni, righe, larghezze, y);

  if (sport.seasonLegend) {
    y += 3;
    doc.setFontSize(8);
    y = drawParagraph(doc, sport.seasonLegend, y, { size: 8 });
  }

  save(doc, `referto_${pulisci(nostri)}_${pulisci(game.oppName)}.pdf`);
}

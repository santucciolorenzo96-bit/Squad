import { createDoc, drawHeader, drawParagraph, drawTable, drawSection, drawScore, drawTiles, save } from './pdf.js';
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
  // «I set» nella pallavolo, «I periodi» nel basket: la parola la dice lo sport.
  const per = (sport.scout.period.label || 'periodo').toLowerCase();
  const nomePeriodi = per === 'set' ? 'I set' : 'I ' + per + 'i';
  let y = drawHeader(doc, team || {}, titolo);

  const riga = [
    sectorName,
    fmtData(game.date || game.ended_at || game.started_at),
    game.friendly ? 'amichevole' : 'campionato'
  ].filter(Boolean).join(' · ');
  y = drawParagraph(doc, riga, y);
  y += 2;

  // Il risultato, grande e dentro un riquadro con i due nomi ai lati: e' la
  // prima cosa che si cerca aprendo il foglio, e su carta non si puo'
  // toccare niente per scoprirla.
  y = drawScore(doc, nostri, game.oppName || 'Avversari', game.teamScore, game.oppScore, y);

  // ------------------------------------------------------------------ i set
  if (r.set.length) {
    y = drawSection(doc, nomePeriodi, y);

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
    y = drawSection(doc, 'Le rotazioni', y);

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

  // ------------------------------------------------------ da dove si e' tirato
  // Sul foglio le zone in cifre e non il disegno: una mappa di pallini
  // stampata in bianco e nero non si legge, e tre righe di numeri si'.
  if (r.tiri) {
    y = drawSection(doc, 'Da dove abbiamo tirato', y);
    y = drawTable(
      doc,
      ['Zona', 'Segnati', 'Tentati', '%'],
      r.tiri.zone.map(z => [z.label, String(z.fatti), String(z.tentati), z.quota + '%']),
      [60, 30, 30, 30],
      y
    );
    y += 6;
  }

  // ------------------------------------------------ come abbiamo attaccato
  if (sport.scout.possessi && r.attacco) {
    y = drawSection(doc, 'Come abbiamo attaccato', y);
    y = drawTiles(doc, [
      { valore: r.attacco.ppp.toFixed(2).replace('.', ','), etichetta: 'punti per possesso' },
      { valore: r.attacco.possessi, etichetta: 'possessi giocati' },
      { valore: r.attacco.perse == null ? '\u2014' : r.attacco.perse + '%', etichetta: 'possessi persi',
        tono: r.attacco.perse != null && r.attacco.perse > 20 ? 'rosso' : null },
      { valore: r.attacco.liberi == null ? '\u2014' : r.attacco.liberi + '%', etichetta: 'liberi per 100 tiri' }
    ], y);
    y += 2;
  }

  // ------------------------------------------------------- i quintetti
  if (r.quintetti.length > 0) {
    y = drawSection(doc, 'I quintetti', y);
    y = drawTable(
      doc,
      ['Saldo', 'Cinque in campo', 'Fatti', 'Subiti'],
      r.quintetti.map(q => [
        (q.saldo > 0 ? '+' : '') + q.saldo,
        q.nomi.join(' '),
        String(q.f),
        String(q.s)
      ]),
      [18, 104, 24, 24],
      y
    );
    y += 6;
  }

  // ------------------------------------------------------------ il tabellino
  const t = tabellaTabellino(r, sport);
  y = drawSection(doc, 'Il tabellino', y);

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
  y = drawTable(doc, t.intestazioni, t.righe, larghezze, y, { totale: t.totale });

  if (sport.seasonLegend) {
    y += 3;
    doc.setFontSize(8);
    y = drawParagraph(doc, sport.seasonLegend, y, { size: 8 });
  }

  save(doc, `referto_${pulisci(nostri)}_${pulisci(game.oppName)}.pdf`);
}

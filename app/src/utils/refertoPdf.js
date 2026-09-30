import {
  createDoc, drawHeader, drawParagraph, drawTable, drawSection, drawScore, drawTiles,
  drawDonut, drawMiniDonut, drawShotChart, contentWidth, spazioPagina, caricaLogo, MARGINE, TINTE, save
} from './pdf.js';
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
  // Il logo si carica prima di cominciare: se non arriva, il referto esce
  // senza. Un documento senza logo e' un documento; un documento che non si
  // genera non e' niente.
  const logo = await caricaLogo((team || {}).logo_url);
  let y = drawHeader(doc, team || {}, titolo, logo);

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

  /* ------------------------------------------------------- i fondamentali
   *
   * Quali siano lo dice lo sport, non il referto: nel basket sono le quattro
   * percentuali al tiro, nella pallavolo sono attacco, ricezione, difesa e
   * servizio. Prima questo blocco leggeva i campi del basket e basta, e sul
   * referto di una partita di pallavolo comparivano quattro anelli vuoti e i
   * rimbalzi a zero — il referto di un altro gioco.
   *
   * Due ciambelle per riga e non quattro: con quattro, l'etichetta e i due
   * conteggi accanto non ci starebbero e resterebbe solo la percentuale. Il
   * rapporto e' meta' dell'informazione.
   */
  if (r.ciambelle) {
    y = drawSection(doc, sport.key === 'basket' ? 'Come abbiamo tirato' : 'I fondamentali', y);
    const meta = contentWidth() / 2;
    for (let i = 0; i < r.ciambelle.length; i += 2) {
      y = spazioPagina(doc, y, 26);
      let sotto = y;
      for (let k = 0; k < 2 && r.ciambelle[i + k]; k++) {
        const fine = drawDonut(doc, MARGINE + k * meta, y, r.ciambelle[i + k]);
        if (fine > sotto) sotto = fine;
      }
      y = sotto + 5;
    }
    y += 1;
  }

  /* --------------------------------------------------- periodo per periodo
   *
   * Serve a rispondere a «dove si e' fermata». Una squadra al 45% in tutta la
   * partita puo' averlo fatto con un terzo quarto al 20%, e quel terzo quarto
   * e' tutta la storia.
   */
  if (r.ciambellePeriodi && r.ciambellePeriodi.some(Boolean)) {
    const modello = r.ciambellePeriodi.find(Boolean);
    const colonne = modello.map(v => v.etichetta);
    const altezza = 17;
    const corsia = 14;
    y = drawSection(doc, per === 'set' ? 'Set per set' : 'Periodo per periodo', y);
    y = spazioPagina(doc, y, altezza + 10);

    const larga = (contentWidth() - corsia) / colonne.length;
    doc.setFont('helvetica', 'bold').setFontSize(7);
    doc.setTextColor(TINTE.tenue[0], TINTE.tenue[1], TINTE.tenue[2]);
    colonne.forEach((c, i) => {
      doc.text(c, MARGINE + corsia + larga * i + larga / 2, y, { align: 'center' });
    });
    doc.setTextColor(TINTE.testo[0], TINTE.testo[1], TINTE.testo[2]);
    y += 3.5;

    r.ciambellePeriodi.forEach((p, i) => {
      // Una riga di ciambelle che parte a due millimetri dal fondo non finisce
      // sulla pagina dopo: finisce fuori dal foglio.
      y = spazioPagina(doc, y, altezza + 3);
      const cy = y + altezza / 2 - 1;
      doc.setFont('helvetica', 'bold').setFontSize(9);
      doc.text(String(i + 1) + '\u00ba', MARGINE + corsia / 2, cy + 1, { align: 'center' });
      colonne.forEach((c, k) => {
        drawMiniDonut(doc, MARGINE + corsia + larga * k + larga / 2, cy - 1, p ? p[k] : null);
      });
      y += altezza + 2;
    });
    doc.setFont('helvetica', 'normal').setFontSize(10);
    y += 2;
  }

  /* ------------------------------------------------------ i numeri di squadra
   *
   * Otto conteggi, quattro per riga. Anche questi li decide lo sport: rimbalzi
   * e palle perse nel basket, muri e punti regalati nella pallavolo.
   */
  if (r.riepilogo && r.riepilogo.length) {
    y = drawSection(doc, 'I numeri di squadra', y);
    for (let i = 0; i < r.riepilogo.length; i += 4) {
      y = drawTiles(doc, r.riepilogo.slice(i, i + 4), y);
    }
    y += 2;
  }

  /* --------------------------------------------------------- com'e' andata
   *
   * Due numeri che nei totali non esistono. Il massimo vantaggio dice quanto
   * si e' stati avanti davvero; il parziale dice quando la partita e' girata.
   */
  if (r.andamento) {
    const a = r.andamento;
    y = drawSection(doc, 'Com\u2019\u00e8 andata', y);
    y = drawTiles(doc, [
      { valore: '+' + a.maxVantaggio, etichetta: 'massimo vantaggio', tono: a.maxVantaggio > 0 ? 'verde' : null },
      /* Il trattino ASCII e non il segno meno tipografico.
       *
       * Sul foglio usciva una virgoletta: i caratteri predefiniti di jsPDF
       * sono codificati WinAnsi, e il meno \u00abvero\u00bb (U+2212) non ci sta dentro \u2014
       * il disegnatore ci mette quello che trova a quel posto. Sullo schermo
       * il meno tipografico va benissimo ed e' piu' bello; su carta bisogna
       * stare a quello che il carattere conosce. */
      { valore: a.maxSvantaggio ? '-' + a.maxSvantaggio : '0', etichetta: 'massimo svantaggio', tono: a.maxSvantaggio > 0 ? 'rosso' : null },
      { valore: a.parzialeNostro, etichetta: 'parziale nostro' },
      { valore: a.parzialeLoro, etichetta: 'parziale subito' }
    ], y);
    y = drawParagraph(
      doc,
      'Il parziale \u00e8 il numero di punti fatti di fila senza che l\u2019altra squadra rispondesse: '
      + '\u00e8 il momento in cui la partita \u00e8 girata, e nel tabellino non lascia traccia.',
      y, { size: 8 }
    );
    y += 2;
  }

  // ------------------------------------------------------ da dove si e' tirato
  // Le zone in cifre E il disegno: la tabella si legge anche stampata in
  // bianco e nero, la mappa dice in un colpo d'occhio quello che tre righe di
  // numeri dicono in tre letture. Sono due modi di guardare la stessa cosa, e
  // su carta c'e' posto per tutti e due.
  if (r.tiri) {
    y = drawSection(doc, 'Da dove abbiamo tirato', y);
    y = drawTable(
      doc,
      ['Zona', 'Segnati', 'Tentati', '%'],
      r.tiri.zone.map(z => [z.label, String(z.fatti), String(z.tentati), z.quota + '%']),
      [60, 30, 30, 30],
      y
    );
    y += 4;
    y = drawShotChart(doc, r.tiri.punti, y);
    y += 2;
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

  // In fondo anche sul foglio, nello stesso ordine dello schermo: e' la
  // sezione che si legge a mente fredda, non quella che si cerca per prima.
  y += 4;
  // ------------------------------------------------------- i quintetti
  if (r.quintetti.length > 0) {
    y = drawSection(doc, 'Con quali cinque siamo andati meglio', y);
    y = drawTable(
      doc,
      ['Scarto', 'Cinque in campo', 'Fatti', 'Subiti'],
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


  save(doc, `referto_${pulisci(nostri)}_${pulisci(game.oppName)}.pdf`);
}

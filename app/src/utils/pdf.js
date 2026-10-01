// Generazione PDF. jsPDF si importa solo quando si genera un documento, così
// non pesa sull'avvio dell'app (finisce in un chunk separato).

const MM = { left: 20, right: 20, top: 18, bottom: 18 };
// Il margine sinistro, per chi disegna a mano: scriverlo 20 in tre file vuol
// dire tre posti da cambiare il giorno in cui il foglio cambia.
export const MARGINE = 20;
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
export function drawHeader(doc, team, title, logo) {
  // Una fascia di colore in cima, alta quanto basta a dire dove finisce
  // l'intestazione e comincia il documento. Prima era una riga grigia.
  riempi(doc, COLORI.blu);
  doc.rect(0, 0, PAGE_W, 6, 'F');

  /* Il logo a sinistra e il testo accanto, quando c'e'.
   *
   * Il testo si sposta di una quantita' fissa e non «quanto serve»: se
   * dipendesse dal logo, due societa' avrebbero due intestazioni diverse e il
   * documento smetterebbe di essere riconoscibile. Il quadrato e' sempre lo
   * stesso, il logo ci sta dentro come puo'. */
  const lato = 18;
  const rientro = logo ? lato + 5 : 0;
  if (logo) {
    try {
      doc.addImage(logo.dati, 'PNG', MM.left, MM.top - 5, lato, lato);
    } catch (e) { /* un logo che non entra non ferma il referto */ }
  }

  let y = MM.top;
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(14);
  doc.text(team.name || '', MM.left + rientro, y);
  y += 5;

  scrivi(doc, COLORI.tenue);
  doc.setFont('helvetica', 'normal').setFontSize(9);
  const rows = [
    [team.address, team.zip, team.city, team.province ? `(${team.province})` : ''].filter(Boolean).join(' '),
    [team.fiscal_code ? `C.F. ${team.fiscal_code}` : '', team.vat_number ? `P.IVA ${team.vat_number}` : ''].filter(Boolean).join(' — '),
    team.registry_number ? `Registro attività sportive n. ${team.registry_number}` : '',
    [team.contact_email, team.contact_phone].filter(Boolean).join(' — ')
  ].filter(Boolean);
  rows.forEach(r => { doc.text(r, MM.left + rientro, y); y += 4; });

  // La riga non parte mai sopra al logo: con un'anagrafica corta il testo
  // finirebbe prima del quadrato, e la linea gli passerebbe in mezzo.
  y = Math.max(y, MM.top - 5 + (logo ? lato : 0)) + 4;
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

/* Il titolo di una sezione: una barretta di colore e il nome accanto.
 *
 * `serve` non e' il posto che occupa il titolo: e' il posto che serve al
 * titolo E a un pezzo di quello che viene dopo. Con quattordici millimetri —
 * quanto basta alla riga — «Set per set» finiva in fondo alla prima pagina e
 * la sua griglia cominciava sulla seconda: un titolo da solo in coda a un
 * foglio non e' un titolo, e' un orfano. Trenta millimetri sono
 * l'intestazione di una tabella piu' due righe: se non ci stanno, il titolo
 * parte gia' dalla pagina dopo insieme alle sue cose.
 */
export function drawSection(doc, testo, y, { serve = 30 } = {}) {
  y = pageBreakIfNeeded(doc, y, serve);
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
/* QUANTO GRANDE PUO' ESSERE IL TESTO SENZA CHE LE COLONNE SI TOCCHINO.
 *
 * Due celle allineate a destra in colonne vicine distano esattamente
 * `larghezza della colonna meno larghezza del testo`: il rientro non c'entra,
 * si sposta insieme a tutte e due. Nel tabellino della pallavolo la colonna
 * e' larga nove millimetri e «100%» a otto e mezzo ne occupa sette e sei: un
 * millimetro e mezzo di stacco, meno di uno spazio. Sul foglio si leggeva
 * «3 100% 100%» come se fosse una cella sola.
 *
 * Qui si misura per davvero — `getTextWidth` conosce il carattere che
 * disegnera' — la cella piu' larga di ogni colonna, e si rimpicciolisce tutta
 * la tabella quanto serve perche' resti almeno RESPIRO di bianco fra una
 * colonna e l'altra. Tutta, non solo la colonna stretta: due corpi diversi
 * nella stessa riga si vedono, uno piu' piccolo no.
 *
 * Non si ingrandisce mai: una tabella di quattro colonne resta come era.
 */
const RESPIRO = 2.4;      // il bianco minimo fra due colonne, in millimetri
const CORPO_BASE = 8.5;
const CORPO_MINIMO = 6.2; // sotto questo non si legge: meglio stretto che illeggibile

export function misuraTabella(doc, headers, rows, widths, { totale = null } = {}) {
  const corpo = [{ r: headers, grassetto: true }]
    .concat(rows.map(r => ({ r, grassetto: false })))
    .concat(totale ? [{ r: totale, grassetto: true }] : []);

  let scala = 1;
  doc.setFontSize(CORPO_BASE);
  widths.forEach((w, i) => {
    const utile = w - RESPIRO;
    if (utile <= 0) return;
    let largo = 0;
    corpo.forEach(({ r, grassetto }) => {
      const testo = String(r[i] == null ? '' : r[i]);
      if (!testo) return;
      doc.setFont('helvetica', grassetto ? 'bold' : 'normal');
      const m = doc.getTextWidth(testo);
      if (m > largo) largo = m;
    });
    if (largo > utile) scala = Math.min(scala, utile / largo);
  });
  doc.setFont('helvetica', 'normal');

  const corpoFinale = Math.max(CORPO_MINIMO, CORPO_BASE * scala);
  return {
    corpo: corpoFinale,
    // L'altezza della riga segue il testo nella stessa proporzione: una riga
    // alta come prima intorno a un testo piu' piccolo sarebbe aria sprecata,
    // e su quattordici giocatrici l'aria sprecata e' una pagina in piu'.
    alta: Math.max(5.0, 6.2 * (corpoFinale / CORPO_BASE))
  };
}

export function drawTable(doc, headers, rows, widths, y, { totale = null, allineaDa = 2 } = {}) {
  const { corpo: CORPO, alta: ALTA } = misuraTabella(doc, headers, rows, widths, { totale });

  function riga(yy, celle, grassetto) {
    doc.setFont('helvetica', grassetto ? 'bold' : 'normal').setFontSize(CORPO);
    let x = MM.left + 1.8;
    celle.forEach((cella, i) => {
      const testo = String(cella == null ? '' : cella);
      const dx = i >= allineaDa ? widths[i] - 3.6 : 0;
      doc.text(testo, x + dx, yy, i >= allineaDa ? { align: 'right' } : undefined);
      x += widths[i];
    });
  }

  function intestazione(yy) {
    riempi(doc, COLORI.blu);
    doc.rect(MM.left, yy - 4.2, contentWidth(), ALTA, 'F');
    scrivi(doc, [255, 255, 255]);
    riga(yy, headers, true);
    scrivi(doc, COLORI.testo);
    return yy + ALTA;
  }

  y = pageBreakIfNeeded(doc, y, 20);
  y = intestazione(y);

  rows.forEach((r, n) => {
    if (y + ALTA > PAGE_H - MM.bottom) {
      doc.addPage();
      y = intestazione(MM.top + 2);
    }
    if (n % 2 === 1) {
      riempi(doc, COLORI.riga);
      doc.rect(MM.left, y - 4.2, contentWidth(), ALTA, 'F');
    }
    riga(y, r, false);
    y += ALTA;
  });

  if (totale) {
    if (y + ALTA > PAGE_H - MM.bottom) { doc.addPage(); y = intestazione(MM.top + 2); }
    riempi(doc, [226, 231, 240]);
    doc.rect(MM.left, y - 4.2, contentWidth(), ALTA, 'F');
    riga(y, totale, true);
    y += ALTA;
  }

  doc.setFont('helvetica', 'normal').setFontSize(10);
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

/* Il controllo di fine pagina. Esportato perche' chi disegna a mano — le
 * ciambelle dei quarti, la mappa dei tiri — deve poterlo chiedere prima di
 * mettere giu' qualcosa: una riga che parte a due millimetri dal fondo non
 * finisce sulla pagina dopo, finisce fuori dal foglio. */
export function spazioPagina(doc, y, serve) { return pageBreakIfNeeded(doc, y, serve); }

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

/* ======================================================================== */
/* LE CIAMBELLE DEL TIRO                                                    */
/* ======================================================================== */
/*
 * Un anello con la percentuale dentro, e segnati/sbagliati accanto. È la forma
 * con cui Eurolega e NBA raccontano il tiro, e funziona per una ragione sola:
 * la percentuale si legge da lontano e il rapporto si legge da vicino, e in un
 * referto servono tutte e due in momenti diversi.
 *
 * jsPDF non disegna archi, quindi l'anello si costruisce a segmenti: si va a
 * passi di qualche grado con delle linee spesse e la testa tonda. Con
 * `lineCap round` le giunture spariscono, e a questa dimensione nessuno
 * distingue un arco vero da uno fatto di ventiquattro pezzi.
 */
function arco(doc, cx, cy, raggio, gradi, spessore, colore) {
  if (gradi <= 0) return;
  traccia(doc, colore);
  doc.setLineWidth(spessore);
  doc.setLineCap('round');
  const passo = 6;
  const n = Math.max(1, Math.ceil(gradi / passo));
  let a0 = -90;
  for (let i = 0; i < n; i++) {
    const a1 = a0 + Math.min(passo, gradi - i * passo);
    const r0 = (a0 * Math.PI) / 180;
    const r1 = (a1 * Math.PI) / 180;
    doc.line(
      cx + raggio * Math.cos(r0), cy + raggio * Math.sin(r0),
      cx + raggio * Math.cos(r1), cy + raggio * Math.sin(r1)
    );
    a0 = a1;
  }
  doc.setLineCap('butt');
  doc.setLineWidth(0.2);
}

/* Una ciambella con l'etichetta e i due conteggi accanto.
 *
 * `dato` è { v, t, pct }: segnati, tentati, percentuale. La percentuale può
 * essere null — nessun tiro tentato — e allora l'anello resta vuoto e dentro
 * c'è un trattino: uno zero per cento su zero tiri sarebbe un dato falso che
 * sembra vero.
 */
/* Il numeratore dell'anello.
 *
 * Non e' sempre il primo dei due conteggi scritti accanto. Nel servizio
 * l'anello dice la positivita' — ace PIU' servizi buoni sul totale — mentre
 * accanto ci vanno gli ace e gli errori, che sono le due cose che si vogliono
 * leggere. Finche' si e' preso `righe[0][0]` come numeratore, il set con
 * novanta per cento nell'anello aveva scritto sotto «2/21»: due numeri giusti
 * che insieme dicevano una cosa falsa.
 *
 * Da qui in avanti chi definisce la ciambella dichiara `v`. Se non lo fa —
 * ed e' il caso in cui i due coincidono davvero — si ricade sul primo
 * conteggio come prima.
 */
function numeratore(voce) {
  if (!voce) return 0;
  if (voce.v != null) return voce.v;
  return (voce.righe && voce.righe[0]) ? voce.righe[0][0] : 0;
}

export function drawDonut(doc, x, y, voce, { raggio = 9, spessore = 2.6 } = {}) {
  const dato = { v: numeratore(voce), t: voce.tot, pct: voce.pct };
  const etichetta = voce.etichetta;
  const cx = x + raggio + spessore / 2;
  const cy = y + raggio + spessore / 2;

  arco(doc, cx, cy, raggio, 360, spessore, COLORI.riga);
  if (dato.t > 0 && dato.pct != null) {
    arco(doc, cx, cy, raggio, (dato.pct / 100) * 360, spessore, COLORI.verde);
  }

  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(9);
  doc.text(dato.pct != null ? dato.pct + '%' : '—', cx, cy + 1.3, { align: 'center' });

  const xt = cx + raggio + spessore / 2 + 3;
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(7.5);
  doc.text(String(etichetta), xt, cy - 3.4);

  // I due conteggi arrivano gia' scritti dallo sport: «segnati / sbagliati» nel
  // basket, «vincenti / errori» nella pallavolo. Il numero e' allineato a
  // sinistra e la parola comincia sempre nello stesso punto, cosi' le righe di
  // due ciambelle accanto restano incolonnate anche con cifre diverse.
  doc.setFont('helvetica', 'normal').setFontSize(7.5);
  (voce.righe || []).slice(0, 2).forEach((riga, i) => {
    const yr = cy + 1.2 + i * 4.2;
    scrivi(doc, i === 0 ? COLORI.verde : COLORI.testo);
    doc.text(String(riga[0]), xt, yr);
    scrivi(doc, COLORI.tenue);
    doc.text(String(riga[1]), xt + 6, yr);
  });

  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'normal').setFontSize(10);
  return cy + raggio + spessore;
}

// La stessa cosa in piccolo: solo l'anello e la percentuale dentro, con il
// rapporto sotto. Per la griglia dei quarti, dove le ciambelle sono sedici.
export function drawMiniDonut(doc, cx, cy, voce, { raggio = 5, spessore = 1.7 } = {}) {
  arco(doc, cx, cy, raggio, 360, spessore, COLORI.riga);
  if (voce && voce.tot > 0 && voce.pct != null) {
    arco(doc, cx, cy, raggio, (voce.pct / 100) * 360, spessore, COLORI.verde);
  }
  scrivi(doc, COLORI.testo);
  doc.setFont('helvetica', 'bold').setFontSize(6.5);
  doc.text(voce && voce.pct != null ? String(voce.pct) : '—', cx, cy + 0.9, { align: 'center' });
  scrivi(doc, COLORI.tenue);
  doc.setFont('helvetica', 'normal').setFontSize(5.8);
  doc.text(voce && voce.tot ? numeratore(voce) + '/' + voce.tot : '—', cx, cy + raggio + 3, { align: 'center' });
  scrivi(doc, COLORI.testo);
  doc.setFontSize(10);
}

/* LA MAPPA DEI TIRI.
 *
 * Mezzo campo visto dall'alto, con un pallino per ogni tiro: pieno se è
 * entrato, vuoto se no. Le proporzioni sono quelle del campo vero, e i punti
 * arrivano già in percentuale — zero è il fondo del campo sotto canestro,
 * cento è la metà campo.
 *
 * Disegnata a mano e non copiata dall'SVG dell'app: qui servono tre righe (il
 * perimetro, l'arco da tre, l'area) e ridisegnarle costa meno che portarsi
 * dietro un convertitore.
 */
export function drawShotChart(doc, tiri, y, { larghezza = 78, soloSegnati = false } = {}) {
  if (!tiri || tiri.length === 0) return y;
  const altezza = larghezza * (110 / 90);
  y = pageBreakIfNeeded(doc, y, altezza + 10);
  const x0 = MM.left + (contentWidth() - larghezza) / 2;
  const y0 = y;

  // Il campo. Il canestro sta in basso al centro; l'asse y del dato cresce
  // andando verso meta' campo, quindi si ribalta.
  traccia(doc, COLORI.linea);
  doc.setLineWidth(0.3);
  doc.rect(x0, y0, larghezza, altezza);

  const cx = x0 + larghezza / 2;
  const fondo = y0 + altezza;
  // L'area: 4,9 m su 5,8 m in un campo di 9 x 11 (mezzo campo piu' la zona).
  const areaL = larghezza * (4.9 / 9);
  const areaH = altezza * (5.8 / 11);
  doc.rect(cx - areaL / 2, fondo - areaH, areaL, areaH);
  // Il ferro.
  riempi(doc, COLORI.linea);
  doc.circle(cx, fondo - altezza * (1.575 / 11), 0.9, 'F');

  tiri.forEach(t => {
    if (t.x == null || t.y == null) return;
    const px = x0 + (t.x / 100) * larghezza;
    const py = fondo - (t.y / 100) * altezza;
    if (t.dentro) {
      riempi(doc, COLORI.verde);
      doc.circle(px, py, 1.1, 'F');
    } else {
      traccia(doc, COLORI.rosso);
      doc.setLineWidth(0.4);
      doc.circle(px, py, 1.1, 'S');
    }
  });

  doc.setLineWidth(0.2);
  scrivi(doc, COLORI.tenue);
  doc.setFontSize(7.5);
  const dentro = tiri.filter(t => t.dentro).length;
  // Con i soli canestri non c'e' niente da mettere a rapporto: dire
  // «venti su venti» sarebbe un cento per cento che non esiste.
  doc.text(
    soloSegnati
      ? `${dentro} canestri, da dove sono partiti`
      : `${dentro} segnati (pieni) su ${tiri.length} tirati`,
    cx, fondo + 4.5, { align: 'center' }
  );
  scrivi(doc, COLORI.testo);
  doc.setFontSize(10);
  return fondo + 9;
}

/* ======================================================================== */
/* IL LOGO DELLA SOCIETA'                                                   */
/* ======================================================================== */
/*
 * jsPDF vuole i pixel, non un indirizzo: l'immagine va scaricata e convertita
 * prima di poterla mettere sul foglio. Passa da un canvas e non direttamente
 * dai byte perche' il logo puo' essere un PNG, un JPG o un WebP, e il canvas
 * li legge tutti e ne restituisce uno solo.
 *
 * Se non si carica — rete assente, indirizzo scaduto, formato che il browser
 * non apre — si torna null e il referto esce senza. Un documento senza logo e'
 * un documento; un documento che non si genera non e' niente.
 */
export async function caricaLogo(url) {
  if (!url) return null;
  try {
    const img = await new Promise((risolvi, rifiuta) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => risolvi(i);
      i.onerror = rifiuta;
      i.src = url;
    });
    const lato = 256;
    const tela = document.createElement('canvas');
    tela.width = lato;
    tela.height = lato;
    const c = tela.getContext('2d');
    // Dentro un quadrato, senza deformare: un logo stirato e' peggio di un
    // logo assente.
    const scala = Math.min(lato / img.width, lato / img.height);
    const w = img.width * scala;
    const h = img.height * scala;
    c.drawImage(img, (lato - w) / 2, (lato - h) / 2, w, h);
    return { dati: tela.toDataURL('image/png'), proporzione: img.width / img.height };
  } catch (e) {
    return null;
  }
}

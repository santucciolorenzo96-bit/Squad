import { describe, test, is, ok } from './run.mjs';
import { readFileSync } from 'node:fs';

/* I CARATTERI CHE IL PDF SA DISEGNARE.
 *
 * Sul referto stampato, al posto di «−9» usciva «" 9». Non era un errore di
 * calcolo: i caratteri predefiniti di jsPDF sono codificati WinAnsi, e il
 * segno meno tipografico (U+2212) non ci sta dentro — il disegnatore mette
 * quello che trova a quel posto nella tabella, e quello che trova è una
 * virgoletta.
 *
 * È un errore che non si vede scrivendo il codice, non lo prende il
 * compilatore, e si scopre solo guardando un foglio stampato. Sullo schermo lo
 * stesso carattere è perfetto, e questo lo rende peggio: si copia una stringa
 * da un componente al generatore del PDF e sembra tutto a posto.
 *
 * Qui si guardano i due file che disegnano il documento, carattere per
 * carattere. Chi ne aggiunge uno fuori tabella lo scopre adesso e non su
 * carta.
 */

// WinAnsi (CP1252): tutto Latin-1, più i venticinque segni che stanno nella
// fascia 0x80-0x9F. Virgolette curve, trattini lunghi e puntini ci sono; il
// meno matematico, le frecce e i simboli non ci sono.
const FASCIA_ALTA = [
  0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022,
  0x2013, 0x2014, 0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178
];

const FILE = ['src/utils/refertoPdf.js', 'src/utils/pdf.js'];

function fuoriTabella(percorso) {
  const testo = readFileSync(new URL('../' + percorso, import.meta.url), 'utf8');
  const fuori = new Set();
  for (const ch of testo) {
    const c = ch.codePointAt(0);
    if (c < 0x100) continue;
    if (FASCIA_ALTA.includes(c)) continue;
    fuori.add('U+' + c.toString(16).toUpperCase() + ' (' + ch + ')');
  }
  return Array.from(fuori);
}

/* LE PAROLE CHE ARRIVANO DA FUORI.
 *
 * Il controllo sui due file che disegnano non bastava. La sigla della colonna
 * del piu'/meno era scritta in `basket.js` — «+/−», con il meno
 * tipografico — e da li` finiva nell'intestazione del tabellino stampato e
 * nella legenda sotto. Nessun test guardava quel file, perche' non e` un file
 * che disegna: e` un file che descrive uno sport.
 *
 * Quindi qui non si guardano piu` i file, si guardano le STRINGHE che il
 * referto mette sul foglio: le sigle delle colonne, il glossario, le etichette
 * degli anelli e dei riquadri, il nome dei periodi. Chiunque ne aggiunga una
 * con un carattere fuori tabella lo scopre adesso.
 */
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { CALCIO } from '../src/utils/sports/calcio.js';

function fuoriTabellaNelTesto(testo) {
  const fuori = [];
  for (const ch of String(testo)) {
    const c = ch.codePointAt(0);
    if (c < 0x100 || FASCIA_ALTA.includes(c)) continue;
    fuori.push('U+' + c.toString(16).toUpperCase() + ' (' + ch + ')');
  }
  return fuori;
}

// Tutto quello che di uno sport finisce scritto sul PDF.
function paroleStampate(sport) {
  const parole = [];
  const aggiungi = (dove, t) => { if (t) parole.push([dove, String(t)]); };

  (sport.seasonColumns || []).forEach(c => {
    aggiungi('colonna', c.short || c.label);
    aggiungi('colonna.avg', c.avg);
  });
  Object.keys(sport.glossario || {}).forEach(k => {
    aggiungi('glossario.sigla', k);
    aggiungi('glossario.spiegazione', sport.glossario[k]);
  });
  aggiungi('seasonLegend', sport.seasonLegend);
  aggiungi('periodo', (sport.scout || {}).period && sport.scout.period.label);
  aggiungi('periodo.plurale', (sport.scout || {}).period && sport.scout.period.plural);
  aggiungi('inCampo', (sport.field || {}).onFieldLabel);

  // Anelli e riquadri: le etichette nascono da una funzione, quindi si chiama.
  const stats = sport.newStats ? sport.newStats() : {};
  const pieni = Object.assign({}, stats);
  Object.keys(pieni).forEach(k => { if (typeof pieni[k] === 'number') pieni[k] = 3; });
  if (sport.ciambelle) {
    (sport.ciambelle(pieni) || []).forEach(v => {
      aggiungi('ciambella', v.etichetta);
      (v.righe || []).forEach(r => aggiungi('ciambella.riga', r[1]));
    });
  }
  if (sport.riepilogo) {
    (sport.riepilogo(pieni) || []).forEach(v => {
      aggiungi('riquadro', v.etichetta);
      aggiungi('riquadro.valore', v.valore);
    });
  }
  return parole;
}

describe('le parole degli sport stanno tutte nella tabella del carattere', () => {
  [PALLAVOLO, BASKET, CALCIO].forEach(sport => {
    test(sport.key + ': sigle, glossario ed etichette', () => {
      const guai = [];
      paroleStampate(sport).forEach(([dove, testo]) => {
        const fuori = fuoriTabellaNelTesto(testo);
        if (fuori.length) guai.push(dove + ' «' + testo + '»: ' + fuori.join(', '));
      });
      ok(guai.length === 0,
        'su carta questi diventano segni a caso: ' + guai.join(' / '));
    });
  });

  /* IL DIFETTO CHE C'ERA DAVVERO, come promemoria: la colonna del piu'/meno
   * usava il meno tipografico, e sul tabellino stampato del basket uscivano
   * un'intestazione e una legenda con una virgoletta al posto del segno. */
  test('la colonna del piu meno usa il trattino ASCII', () => {
    const c = BASKET.seasonColumns.find(x => x.key === 'plusMinus');
    is(c.short, '+/-');
    is(c.short.includes('−'), false);
  });
});

describe('il PDF usa solo caratteri che il suo carattere conosce', () => {
  FILE.forEach(f => {
    test(f + ' non ha caratteri fuori tabella', () => {
      const fuori = fuoriTabella(f);
      ok(fuori.length === 0,
        'su carta questi diventano segni a caso: ' + fuori.join(', '));
    });
  });

  test('il meno tipografico e proprio uno di quelli fuori', () => {
    // La prova che il controllo controlla davvero qualcosa.
    ok(!FASCIA_ALTA.includes(0x2212));
  });

  test('mentre il trattino lungo e le virgolette curve ci sono', () => {
    ok(FASCIA_ALTA.includes(0x2014));
    ok(FASCIA_ALTA.includes(0x2019));
  });
});

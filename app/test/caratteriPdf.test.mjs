import { describe, test, ok } from './run.mjs';
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

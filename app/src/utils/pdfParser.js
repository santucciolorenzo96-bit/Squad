import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { parseMatchesFromLines } from './calendarioTesto.js';

/* IL LETTORE DI PDF.
 *
 * Qui resta solo quello che ha bisogno di un browser: aprire il documento e
 * ricavarne le righe di testo. La REGOLA che da quelle righe ricava le partite
 * sta in `calendarioTesto.js`, senza nessun import, dove si puo' provare.
 *
 * `parseMatchesFromLines` si riesporta perche' chi legge un PDF vuole tutte e
 * due le cose, e perche' la vecchia schermata importa da qui.
 */

// In un browser il worker c'e'; in Node — nei test — `GlobalWorkerOptions` non
// esiste, e assegnarci sopra lanciava prima che qualunque funzione fosse
// raggiungibile. Una guardia di tre parole al posto di un modulo inservibile.
if (pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
}

/* Le righe di un PDF, ricostruite.
 *
 * Un PDF non ha righe: ha pezzi di testo con una posizione. Si raggruppano per
 * coordinata verticale e si ordinano per quella orizzontale, che e' il modo in
 * cui un umano legge la pagina.
 */
export async function extractTextLines(arrayBuffer) {
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const lines = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const byY = new Map();
    content.items.forEach(item => {
      const y = Math.round(item.transform[5]);
      if (!byY.has(y)) byY.set(y, []);
      byY.get(y).push(item);
    });
    const ys = [...byY.keys()].sort((a, b) => b - a);
    ys.forEach(y => {
      const items = byY.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
      const text = items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim();
      if (text) lines.push(text);
    });
  }
  return lines;
}

export { parseMatchesFromLines };

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

const DATE_RE = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/;
const TIME_RE = /\b(\d{1,2})[:.](\d{2})\b/;
const GIORNATA_RE = /giornata\s*n?\.?\s*(\d+)|(\d+)\s*[ªa°]?\s*giornata/i;
const LOCATION_RE = /\s+(?:presso|c\/o)\s+(.+)$/i;
const PAIR_RE = /^(.+?)\s+[-–]\s+(.+)$/;

function normalizeDate(d, m, y) {
  if (y.length === 2) y = (Number(y) < 70 ? '20' : '19') + y;
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

async function extractTextLines(arrayBuffer) {
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

function parseMatchesFromLines(lines, teamName) {
  const teamLower = (teamName || '').trim().toLowerCase();
  const matches = [];
  lines.forEach(line => {
    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) return;
    const timeMatch = line.match(TIME_RE);
    const giornataMatch = line.match(GIORNATA_RE);

    let rest = line.replace(DATE_RE, ' ').replace(TIME_RE, ' ');
    if (giornataMatch) rest = rest.replace(giornataMatch[0], ' ');
    rest = rest.replace(/\s+/g, ' ').trim();
    rest = rest.replace(/^[-–]+\s*/, '').replace(/\s*[-–]+$/, '').trim();

    const locationMatch = rest.match(LOCATION_RE);
    let location = null;
    if (locationMatch) { location = locationMatch[1].trim(); rest = rest.replace(LOCATION_RE, '').trim(); }

    const pairMatch = rest.match(PAIR_RE);
    if (!pairMatch) return;
    const teamA = pairMatch[1].trim();
    const teamB = pairMatch[2].trim();
    if (!teamA || !teamB) return;

    let home = null;
    let opponent = null;
    if (teamLower && teamA.toLowerCase().includes(teamLower)) { home = true; opponent = teamB; }
    else if (teamLower && teamB.toLowerCase().includes(teamLower)) { home = false; opponent = teamA; }
    else { opponent = teamB; }

    matches.push({
      giornata: giornataMatch ? parseInt(giornataMatch[1] || giornataMatch[2], 10) : null,
      date: normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]),
      time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
      opponent,
      home,
      location,
      sourceLine: line
    });
  });
  return matches;
}

export { extractTextLines, parseMatchesFromLines };

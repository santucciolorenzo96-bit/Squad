/* LEGGERE UN CALENDARIO SCRITTO PER GLI UMANI.
 *
 * Una riga di calendario federale e' una frase: «1ª giornata 12/10/2026 18:30
 * Cestistica Etnea - Azzurra Belpasso presso Palestra Nesima». Qui dentro si
 * ricava la partita che contiene.
 *
 * STAVA INSIEME AL LETTORE DI PDF, e non si poteva provare: quel file, al
 * momento di caricarsi, assegna il percorso del worker di pdf.js — una cosa
 * che esiste solo in un browser — quindi importarlo in un test lanciava prima
 * di arrivare a qualunque funzione. Una regola che non si puo' chiamare non si
 * puo' provare, ed e' per questo che la funzione da cui dipende il
 * caricamento di un intero calendario non aveva un test.
 *
 * Qui dentro non si importa niente. Prende righe di testo e restituisce
 * partite: le righe possono venire da un PDF o da un testo incollato, e per
 * lei sono la stessa cosa — il che vuol dire anche che incollare un calendario
 * non costa il caricamento di pdf.js.
 *
 * QUELLO CHE NON FA, e che conta piu' di quello che fa: non inventa. Una riga
 * senza data, o senza due squadre separate da un trattino, viene saltata; e se
 * il nostro nome non compare, «casa o trasferta» resta NON DETTO invece di
 * diventare «casa». Una partita inventata finisce in calendario e qualcuno ci
 * va; dieci righe da aggiungere a mano no.
 */

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


export function parseMatchesFromLines(lines, teamName) {
  if (!Array.isArray(lines)) return [];
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

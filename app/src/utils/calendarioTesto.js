/* LEGGERE UN CALENDARIO SCRITTO PER GLI UMANI.
 *
 * Prende righe di testo e restituisce partite. Le righe possono venire da un
 * PDF o da un testo incollato, e per questo file sono la stessa cosa — il che
 * vuol dire anche che incollare un calendario non costa il caricamento di
 * pdf.js.
 *
 * Qui dentro non si importa niente, e non è un vezzo: stava insieme al lettore
 * di PDF, che al caricamento del modulo assegna il percorso del worker di
 * pdf.js — una cosa che esiste solo in un browser — quindi importarlo in un
 * test lanciava prima di arrivare a qualunque funzione. La regola da cui
 * dipende il caricamento di un intero calendario non si poteva provare.
 *
 * DUE FORME, perché ce ne sono due in circolazione.
 *
 * La prima è quella che si scrive a mano o si copia da un sito:
 *
 *     12/10/2026 18:30 Cestistica Etnea - Basket Point presso Palestra Nesima
 *
 * Due squadre separate da un trattino. Era l'unica che questo file conosceva.
 *
 * La seconda è quella dei PDF della FEDERAZIONE, ed è la forma in cui un
 * calendario arriva davvero:
 *
 *     1 Giornata - andata del 2026-11-15
 *     CESTISTICA ETNEA BASKET ASD BP BASKET POINT ACI SANT'A 15/11/26 - 17:00
 *     002614
 *     PALACATANIA - Corso Indipendenza CATANIA (CT)
 *
 * Tre differenze, e ognuna da sola bastava a non riconoscere niente:
 *
 *   1. FRA LE DUE SQUADRE NON C'È NESSUN SEPARATORE. L'unico trattino della
 *      riga sta fra la data e l'ora. Cercando «SquadraA - SquadraB» non si
 *      trovava nessuna partita in un calendario intero;
 *   2. la GIORNATA sta su una riga a sé, e la riga della partita non ce l'ha;
 *   3. il CAMPO sta due righe sotto, dopo il numero della gara.
 *
 * COME SI SPEZZA UNA COPPIA SENZA SEPARATORE: col nostro nome. Se è all'inizio
 * giochiamo in casa e il resto è l'avversario; se è alla fine siamo in
 * trasferta e l'avversario è quello che viene prima. Delle partite fra altre
 * due squadre, in questa forma, non si può sapere dove finisca un nome e
 * cominci l'altro — e si lasciano stare: il calendario sono le NOSTRE partite,
 * e i risultati delle altre si inseriscono da «Risultati».
 *
 * E IL NOSTRO NOME PER INTERO LO IMPARA DAL DOCUMENTO. In anagrafica la
 * società si chiama «Cestistica Etnea», nel PDF «CESTISTICA ETNEA BASKET»:
 * spezzando sul nome breve, l'avversario si porterebbe dietro «BASKET». Ma
 * nelle partite in TRASFERTA il nostro nome è in fondo, quindi tutto quello che
 * sta dal nome breve alla fine della coppia È il nostro nome per intero, come
 * lo scrive quel documento. Lo si impara da quelle righe e si usa su tutte.
 *
 * QUELLO CHE NON FA, e che conta più di quello che fa: non inventa. Una riga
 * senza data, o senza un modo di spezzare la coppia, viene saltata; e se il
 * nostro nome non compare, «casa o trasferta» resta NON DETTO invece di
 * diventare «casa». Una partita inventata finisce in calendario e qualcuno ci
 * va; dieci righe da aggiungere a mano no.
 */

const DATE_RE = /\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})\b/;
const TIME_RE = /\b(\d{1,2})[:.](\d{2})\b/;
const GIORNATA_RE = /giornata\s*n?\.?\s*(\d+)|(\d+)\s*[ªa°]?\s*giornata/i;
const LOCATION_RE = /\s+(?:presso|c\/o)\s+(.+)$/i;
const PAIR_RE = /^(.+?)\s+[-–]\s+(.+)$/;

/* La riga che annuncia una giornata nel PDF federale: «1 Giornata - andata del
 * 2026-11-15». Interessa il numero e se è andata o ritorno. */
const GIORNATA_FIP = /^\s*(\d+)\s*[ªa°]?\s*giornata\b[^\n]*?\b(andata|ritorno)\b/i;

// Il numero della gara, su una riga da solo, e il piè di pagina: stanno fra la
// partita e il campo, e non sono né l'una né l'altro.
const NUMERO_GARA = /^\d{4,10}$/;
const PIE_DI_PAGINA = /^pag\b|^pagina\b/i;

// La giornata di riposo, scritta accanto al nome di chi riposa: non e' un
// avversario, e una partita contro «Riposa» non si gioca in nessun posto.
const RIPOSO = /^ripos[ao]$/i;

function normalizeDate(d, m, y) {
  if (y.length === 2) y = (Number(y) < 70 ? '20' : '19') + y;
  const dd = d.padStart(2, '0');
  const mm = m.padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

const pulisci = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/* La coppia di squadre: la riga senza data, senza ora, senza giornata e senza
 * il campo, ripulita dai trattini agli estremi — che nel formato federale sono
 * quello che separava la data dall'ora. */
function coppiaDi(line) {
  const giornataMatch = line.match(GIORNATA_RE);
  let rest = line.replace(DATE_RE, ' ').replace(TIME_RE, ' ');
  if (giornataMatch) rest = rest.replace(giornataMatch[0], ' ');
  rest = pulisci(rest);
  return rest.replace(/^[-–]+\s*/, '').replace(/\s*[-–]+$/, '').trim();
}

/* IL NOSTRO NOME COME LO SCRIVE QUESTO DOCUMENTO.
 *
 * Si impara dalle righe in cui il nome breve NON è all'inizio: là tutto quello
 * che va dal nome breve alla fine della coppia è il nostro nome per intero.
 * Si prende quello che compare più volte, perché un documento lo scrive sempre
 * allo stesso modo e la ripetizione è la prova.
 */
function nomeCompletoNelDocumento(righe, nomeBreve) {
  const breve = nomeBreve.toLowerCase();
  const conteggio = new Map();

  righe.forEach(line => {
    if (!DATE_RE.test(line)) return;
    const coppia = coppiaDi(line);
    if (PAIR_RE.test(coppia)) return;        // ha il separatore: altra forma
    const i = coppia.toLowerCase().indexOf(breve);
    if (i <= 0) return;                      // assente, o già all'inizio
    const candidato = coppia.slice(i).trim();
    conteggio.set(candidato, (conteggio.get(candidato) || 0) + 1);
  });

  let vincitore = nomeBreve;
  let quante = 0;
  conteggio.forEach((n, nome) => {
    // A pari merito vince il più lungo: è quello che porta via dall'avversario
    // tutti i pezzi del nostro nome.
    if (n > quante || (n === quante && nome.length > vincitore.length)) {
      vincitore = nome; quante = n;
    }
  });
  return vincitore;
}

/* Il campo, quando sta su una riga successiva.
 *
 * Si salta il numero della gara e il piè di pagina, e si rifiuta una riga che
 * è a sua volta una partita o una giornata: in quel caso il campo non c'è, e
 * una riga sbagliata al posto del campo è peggio di un campo vuoto.
 */
function campoDopo(righe, i) {
  for (let k = i + 1; k < righe.length && k <= i + 3; k++) {
    const r = pulisci(righe[k]);
    if (!r) continue;
    if (NUMERO_GARA.test(r) || PIE_DI_PAGINA.test(r)) continue;
    if (DATE_RE.test(r) || GIORNATA_FIP.test(r)) return null;
    return r;
  }
  return null;
}

export function parseMatchesFromLines(lines, teamName) {
  if (!Array.isArray(lines)) return [];
  const righe = lines.map(l => String(l == null ? '' : l));
  const nomeBreve = pulisci(teamName);
  const breve = nomeBreve.toLowerCase();
  const completo = nomeBreve ? nomeCompletoNelDocumento(righe, nomeBreve) : '';
  const completoBasso = completo.toLowerCase();

  const matches = [];

  /* La giornata corrente, dalle righe che la annunciano.
   *
   * Nel ritorno la numerazione RICOMINCIA da uno, e due righe di calendario con
   * la stessa giornata e lo stesso avversario non si distinguono piu' — ne' per
   * chi legge, ne' per il codice che collega un risultato alla sua partita.
   * Quindi il ritorno continua a contare da dove l'andata ha finito: la nona di
   * andata e' la nona, la prima di ritorno e' la decima. E' anche il modo in cui
   * una classifica numera le giornate. */
  let giornataCorrente = null;
  let ultimaAndata = 0;
  let nelRitorno = false;

  righe.forEach((line, i) => {
    const fip = line.match(GIORNATA_FIP);
    if (fip) {
      const n = parseInt(fip[1], 10);
      if (/ritorno/i.test(fip[2])) {
        nelRitorno = true;
        giornataCorrente = ultimaAndata + n;
      } else {
        nelRitorno = false;
        if (n > ultimaAndata) ultimaAndata = n;
        giornataCorrente = n;
      }
      return;
    }

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) return;
    const timeMatch = line.match(TIME_RE);
    const giornataMatch = line.match(GIORNATA_RE);

    let rest = coppiaDi(line);

    const locationMatch = rest.match(LOCATION_RE);
    let location = null;
    if (locationMatch) { location = locationMatch[1].trim(); rest = rest.replace(LOCATION_RE, '').trim(); }

    let home = null;
    let opponent = null;

    const pairMatch = rest.match(PAIR_RE);
    if (pairMatch) {
      /* LA FORMA COL SEPARATORE. Resta com'era, anche per le partite fra altre
       * due squadre: la` i due nomi si distinguono, e una riga in piu` da
       * controllare non fa danno. */
      const teamA = pairMatch[1].trim();
      const teamB = pairMatch[2].trim();
      if (!teamA || !teamB) return;
      if (breve && teamA.toLowerCase().includes(breve)) { home = true; opponent = teamB; }
      else if (breve && teamB.toLowerCase().includes(breve)) { home = false; opponent = teamA; }
      else { opponent = teamB; }
    } else {
      /* LA FORMA FEDERALE, senza separatore: si spezza sul nostro nome.
       * Senza il nostro nome la coppia non si puo` dividere, e si lascia
       * stare: meglio una partita in meno da aggiungere a mano che due nomi
       * tagliati nel punto sbagliato. */
      if (!completoBasso) return;
      const basso = rest.toLowerCase();
      let i0 = basso.indexOf(completoBasso);
      let lungo = completoBasso.length;
      if (i0 < 0) { i0 = basso.indexOf(breve); lungo = breve.length; }
      if (i0 < 0) return;

      home = i0 === 0;
      opponent = (home ? rest.slice(i0 + lungo) : rest.slice(0, i0)).trim();
      // Un trattino rimasto attaccato all'avversario: capita nel testo
      // incollato, dove la coppia e` «Noi - Loro» e il nostro nome se ne porta
      // via una meta`.
      opponent = opponent.replace(/^[-–]+\s*/, '').replace(/\s*[-–]+$/, '').trim();
      if (!opponent) return;
      /* «RIPOSA» NON E` UNA SQUADRA.
       * Nei gironi dispari una squadra per giornata riposa, e la riga lo
       * scrive accanto al suo nome. Spezzata sul nostro nome diventerebbe una
       * trasferta contro una societa` che non esiste — e quella partita
       * finisce in calendario, qualcuno ci va, e nessuno la trova sul posto. */
      if (RIPOSO.test(opponent)) return;
      if (!location) location = campoDopo(righe, i);
    }

    if (!opponent) return;

    matches.push({
      giornata: giornataMatch
        ? parseInt(giornataMatch[1] || giornataMatch[2], 10)
        : giornataCorrente,
      date: normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]),
      time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
      opponent,
      home,
      location,
      ritorno: nelRitorno,
      sourceLine: line
    });
  });

  return matches;
}

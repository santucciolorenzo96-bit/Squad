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
export function nostroNomeNelDocumento(righe, nomeBreve) {
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
/* LA FORMA DI UN CAMPO.
 *
 * «PALACATANIA - Corso Indipendenza CATANIA (CT)»: un impianto, un indirizzo,
 * e la provincia fra parentesi. Serve una forma perche` in questo documento
 * sotto la riga di una partita puo` capitarci il NOME DI UNA SQUADRA — quando
 * la coppia e` andata a capo — e un nome di squadra scritto come luogo manda
 * la squadra a giocare in una palestra che non esiste.
 */
function sembraUnCampo(r) {
  return /\s[-–]\s/.test(r) || /\([A-Za-z]{2}\)\s*$/.test(r);
}

function campoDopo(righe, i) {
  for (let k = i + 1; k < righe.length && k <= i + 3; k++) {
    const r = pulisci(righe[k]);
    if (!r) continue;
    if (NUMERO_GARA.test(r) || PIE_DI_PAGINA.test(r)) continue;
    if (DATE_RE.test(r) || GIORNATA_FIP.test(r)) return null;
    return sembraUnCampo(r) ? r : null;
  }
  return null;
}

export function parseMatchesFromLines(lines, teamName) {
  if (!Array.isArray(lines)) return [];
  const righe = lines.map(l => String(l == null ? '' : l));
  const nomeBreve = pulisci(teamName);
  const breve = nomeBreve.toLowerCase();
  const completo = nomeBreve ? nostroNomeNelDocumento(righe, nomeBreve) : '';
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


/* ========================================================================= */
/* TUTTE LE PARTITE DEL GIRONE, NON SOLO LE NOSTRE                           */
/* ========================================================================= */
/*
 * Il calendario sono le nostre partite, e per quelle basta il nostro nome. Ma
 * LA CLASSIFICA si fa coi risultati di tutti, e inserire a mano gli
 * accoppiamenti di un girone da nove squadre — settantadue partite fra andata
 * e ritorno — e` esattamente il pomeriggio che caricare un calendario doveva
 * far risparmiare. Senza di loro, durante la stagione, bisognerebbe scrivere
 * ogni domenica due nomi, la data e la giornata prima di poter scrivere due
 * numeri.
 *
 * IL PROBLEMA ERA CHE NON SI POSSONO SPEZZARE. «A.S.D. KALKIS A.S.D. MENS SANA
 * MASCALUCIA» sono due squadre senza niente in mezzo, e non c'e` modo di sapere
 * dove finisca la prima.
 *
 * LA SOLUZIONE ERA NEL DOCUMENTO. In un girone all'italiana noi incontriamo
 * tutte le altre, quindi dalle NOSTRE partite — che si spezzano, perche` il
 * nostro nome lo conosciamo — escono i nomi di tutte le squadre del girone. Con
 * quel vocabolario ogni coppia si spezza: si cerca quale nome conosciuto apre
 * la riga, e quello che resta e` l'altra squadra.
 *
 * Sul calendario vero: 72 righe-partita, 71 spezzate al primo colpo e zero
 * nomi incerti. La settantaduesima era andata a capo — la seconda squadra sulla
 * riga sotto — ed e` l'ultimo caso qui sotto.
 *
 * I nomi piu` lunghi si provano per primi: «A.S.D. MENS SANA MASCALUCIA» e
 * «A.S.D. KALKIS» cominciano uguali, e provando il corto per primo si
 * taglierebbe nel posto sbagliato ogni volta che giocano in casa.
 */

/* IMPARARE LE SQUADRE CHE NON ABBIAMO ANCORA INCONTRATO.
 *
 * Dalle nostre partite escono i nomi di chi abbiamo giocato. In un girone
 * all'italiana completo sono tutti — ma un PDF puo` essere parziale, o
 * contenere un girone in cui non siamo, e allora il vocabolario resta a meta`
 * e le coppie delle altre non si spezzano.
 *
 * Si impara di piu` con una regola sola, applicata finche` serve: SE DI UNA
 * COPPIA CONOSCO UNA DELLE DUE SQUADRE, L'ALTRA E` QUELLO CHE RESTA. Il nome
 * noto puo` stare davanti — e allora la nuova squadra e` la coda — oppure in
 * fondo, e allora e` la testa. Ogni nome imparato permette di spezzare altre
 * coppie, quindi si ripassa fino a quando non si impara piu` niente: un giro
 * per ogni squadra, al massimo.
 *
 * Il nome imparato deve essere lungo almeno tre caratteri e contenere una
 * lettera: una coda di due caratteri o un numero rimasto appeso non sono una
 * societa`, e una squadra inventata in classifica e` peggio di una mancante.
 */
function imparaSquadre(righe, iniziali) {
  const squadre = [...iniziali];
  const ha = (n) => squadre.some(x => x.toUpperCase() === n.toUpperCase());
  const vale = (n) => n.length >= 3 && /[A-Za-z]/.test(n) && !NUMERO_GARA.test(n);

  const coppie = [];
  righe.forEach(line => {
    if (!DATE_RE.test(line)) return;
    const c = coppiaDi(line);
    if (c && !PAIR_RE.test(c)) coppie.push(c);
  });

  for (let giro = 0; giro < 40; giro++) {
    let imparato = false;
    coppie.forEach(c => {
      const su = c.toUpperCase();
      // in ordine di lunghezza: il nome piu` lungo che combacia e` quello vero
      const ordinate = [...squadre].sort((a, b) => b.length - a.length);
      for (let i = 0; i < ordinate.length; i++) {
        const noto = ordinate[i].toUpperCase();
        if (su.startsWith(noto)) {
          const resto = c.slice(noto.length).trim();
          if (resto && vale(resto) && !ha(resto) && !RIPOSO.test(resto)) {
            squadre.push(resto); imparato = true;
          }
          return;
        }
        if (su.endsWith(noto)) {
          const resto = c.slice(0, c.length - noto.length).trim();
          if (resto && vale(resto) && !ha(resto) && !RIPOSO.test(resto)) {
            squadre.push(resto); imparato = true;
          }
          return;
        }
      }
    });
    if (!imparato) break;
  }

  return squadre;
}

function spezzaCoppia(coppia, vocabolario) {
  const su = coppia.toUpperCase();
  for (let i = 0; i < vocabolario.length; i++) {
    const casa = vocabolario[i];
    if (!su.startsWith(casa.toUpperCase())) continue;
    const resto = coppia.slice(casa.length).trim();
    if (!resto) return { casa, fuori: null };     // forse andata a capo
    const noto = vocabolario.find(x => resto.toUpperCase() === x.toUpperCase());
    // Se il secondo nome non e` nel vocabolario si prende com'e`: con un PDF
    // parziale il vocabolario e` incompleto, e un nome da correggere a mano e`
    // meglio di una partita che non c'e`.
    return { casa, fuori: noto || resto };
  }
  return null;
}

/* Il nome di squadra finito su una riga sua, quando la coppia e` andata a capo.
 * Si cerca nelle due righe intorno, e deve essere ESATTAMENTE un nome noto:
 * una riga che «somiglia» a un nome di squadra non basta per inventare una
 * partita. */
function nomeVicino(righe, i, vocabolario) {
  const candidate = [righe[i + 1], righe[i + 2], righe[i - 1]];
  for (let k = 0; k < candidate.length; k++) {
    const r = pulisci(candidate[k]);
    if (!r) continue;
    const noto = vocabolario.find(x => r.toUpperCase() === x.toUpperCase());
    if (noto) return noto;
  }
  return null;
}

/**
 * Tutte le partite del girone, pronte per `league_matches`.
 *
 * @returns {{partite: Array, squadre: Array, nostroNome: string, nonLette: Array}}
 *   `partite` ha la forma del database — `home_team`, `away_team` — perche` la
 *   classifica non ragiona per «noi e loro»: ragiona per casa e trasferta.
 *   `nonLette` sono le coppie che non si sono potute spezzare: si restituiscono
 *   invece di sparire, perche` chi carica un calendario deve poter sapere che
 *   tre partite non ci sono.
 */
export function leggiGirone(lines, teamName) {
  if (!Array.isArray(lines)) return { partite: [], squadre: [], nostroNome: '', nonLette: [] };
  const righe = lines.map(l => String(l == null ? '' : l));

  const nostre = parseMatchesFromLines(righe, teamName);
  const nostroNome = pulisci(teamName)
    ? nostroNomeNelDocumento(righe, pulisci(teamName))
    : '';

  const squadre = [];
  const aggiungi = (n) => {
    const v = pulisci(n);
    if (v && !squadre.some(x => x.toUpperCase() === v.toUpperCase())) squadre.push(v);
  };
  if (nostroNome) aggiungi(nostroNome);
  nostre.forEach(m => aggiungi(m.opponent));

  /* E poi si impara dal resto del documento: le squadre che non abbiamo
   * incontrato si ricavano dalle coppie in cui l'altra e` nota. */
  const tutte = squadre.length ? imparaSquadre(righe, squadre) : [];

  // Dal piu` lungo al piu` corto: due nomi che cominciano uguali si
  // distinguono solo provando il lungo per primo.
  const vocabolario = [...tutte].sort((a, b) => b.length - a.length);

  const partite = [];
  const nonLette = [];
  let giornataCorrente = null;
  let ultimaAndata = 0;

  righe.forEach((line, i) => {
    const fip = line.match(GIORNATA_FIP);
    if (fip) {
      const n = parseInt(fip[1], 10);
      if (/ritorno/i.test(fip[2])) giornataCorrente = ultimaAndata + n;
      else { if (n > ultimaAndata) ultimaAndata = n; giornataCorrente = n; }
      return;
    }

    const dateMatch = line.match(DATE_RE);
    if (!dateMatch) return;
    const giornataMatch = line.match(GIORNATA_RE);
    const coppia = coppiaDi(line);
    if (!coppia) return;

    let casa = null;
    let fuori = null;

    const conSeparatore = coppia.match(PAIR_RE);
    if (conSeparatore) {
      casa = conSeparatore[1].trim();
      fuori = conSeparatore[2].trim();
    } else {
      const s = spezzaCoppia(coppia, vocabolario);
      if (!s) { nonLette.push(coppia); return; }
      casa = s.casa;
      fuori = s.fuori || nomeVicino(righe, i, vocabolario);
      if (!fuori) { nonLette.push(coppia); return; }
    }

    if (!casa || !fuori || casa.toUpperCase() === fuori.toUpperCase()) {
      nonLette.push(coppia);
      return;
    }
    if (RIPOSO.test(casa) || RIPOSO.test(fuori)) return;

    const timeMatch = line.match(TIME_RE);
    partite.push({
      giornata: giornataMatch
        ? parseInt(giornataMatch[1] || giornataMatch[2], 10)
        : giornataCorrente,
      date: normalizeDate(dateMatch[1], dateMatch[2], dateMatch[3]),
      time: timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null,
      home_team: casa,
      away_team: fuori,
      sourceLine: line
    });
  });

  return { partite, squadre: tutte, nostroNome, nonLette };
}

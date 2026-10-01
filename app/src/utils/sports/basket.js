// Pallacanestro. È lo sport con cui l'app è nata: questo descrittore deve
// riprodurre esattamente il comportamento precedente, non "quasi".

// Posizioni fisse dei 5 slot sul mezzo campo: il canestro è in alto, quindi
// playmaker arretrato in basso, ali a metà, lunghi vicino all'area. Non
// dipendono dal ruolo testuale del giocatore, spesso libero o mancante.
const SLOTS = [
  { top: '84%', left: '50%' },
  { top: '58%', left: '16%' },
  { top: '58%', left: '84%' },
  { top: '30%', left: '27%' },
  { top: '30%', left: '73%' }
];

// Mezzo campo FIBA in scala (15m × 14m → viewBox 150×140, canestro in alto).
// Volutamente sbiadito: deve leggersi come contesto, non competere coi giocatori.
const FIELD_SVG = `
<svg class="court-lines" viewBox="0 0 150 140" preserveAspectRatio="none" fill="none"
     stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="0.6" y="0.6" width="148.8" height="138.8" rx="1"/>
  <rect x="50.5" y="0.6" width="49" height="57.4"/>
  <circle cx="75" cy="58" r="18"/>
  <path d="M9 0.6V29.9"/><path d="M141 0.6V29.9"/>
  <path d="M9 29.9A67.5 67.5 0 0 0 141 29.9"/>
  <path d="M62.5 15.75A12.5 12.5 0 0 0 87.5 15.75"/>
  <path d="M66 12h18"/><path d="M75 12v1.5"/>
  <circle cx="75" cy="15.75" r="2.25"/>
  <path d="M57 139.4A18 18 0 0 1 93 139.4"/>
</svg>`;

/* DA DOVE È PARTITO IL TIRO: UNDICI ZONE.
 *
 * Erano tre — sotto, media, tre — ed era un riassunto, non una mappa: «da
 * tre» metteva insieme l'angolo e il centro, che sono due tiri diversi
 * giocati da persone diverse. Un allenatore che guarda dove segna la sua
 * squadra ha bisogno di sapere QUALE tre.
 *
 * Undici: cinque da tre, cinque da due, e l'area. È la divisione con cui si
 * leggono le mappe di calore, e serve a quello — ogni zona avrà la sua
 * percentuale, e il colore verrà da lì.
 *
 * COME SI DIVIDE. Il tocco sul campo sa una cosa sola: in che punto del
 * riquadro è caduto, in percentuale. Qui quella percentuale torna a essere il
 * campo vero — mezzo campo FIBA in scala, 150 x 140 unità da dieci centimetri
 * l'una, canestro a (75, 15.75) — e tutto si misura dall'ANGOLO rispetto al
 * canestro: cinque spicchi da trentasei gradi, dal fondo destro al fondo
 * sinistro. Dentro ogni spicchio il raggio dice se era da due o da tre, e
 * l'area dei tre secondi si stacca per conto suo — un tiro da sotto non è un
 * tiro dalla media comunque lo si guardi.
 *
 * Destra e sinistra sono quelle di CHI GUARDA LO SCHERMO, non quelle del
 * giocatore. Chi segna ha il tablet in mano e il campo davanti: dirgli
 * «sinistra» intendendo la sua destra sarebbe un modo elegante di far
 * sbagliare tutti.
 *
 * L'arco da tre ha raggio 67.5 — 6,75 metri — e negli angoli, sopra la quota
 * 29.9, diventa una retta a 6,60 dal centro: è il motivo per cui la tripla
 * d'angolo è più corta. Va rispettato, altrimenti ogni tiro dal fondo
 * risulterebbe da due.
 *
 * Le zone NON si registrano: si deducono dal punto, ogni volta. Così il
 * giorno in cui si corregge dove passa l'arco si correggono anche tutte le
 * partite già archiviate, invece di lasciarle sbagliate per sempre.
 */

// I cinque spicchi, da destra a sinistra di chi guarda. Trentasei gradi
// ciascuno, misurati dal canestro.
const SPICCHI = ['_dx2', '_dx1', '_c', '_sx1', '_sx2'];

export function zonaTiro(x, y) {
  if (x == null || y == null) return null;
  const cx = (x / 100) * 150;
  const cy = (y / 100) * 140;
  const dx = cx - 75;
  const dy = cy - 15.75;
  const r = Math.sqrt(dx * dx + dy * dy);

  const tre = cy < 29.9 ? Math.abs(dx) >= 66 : r >= 67.5;

  /* L'AREA DEI TRE SECONDI, prima di tutto il resto: dal fondo alla lunetta.
   * È la zona che si legge da sola, e dividerla in spicchi non direbbe niente
   * che non si veda già. */
  if (!tre && cx >= 50.5 && cx <= 99.5 && cy <= 58) return 'area';

  /* L'angolo: zero verso il fondo destro, centottanta verso il fondo
   * sinistro. `dy` cresce allontanandosi dal canestro, e si taglia a zero —
   * dietro al fondo non c'è nessun angolo da misurare. */
  const gradi = (Math.atan2(Math.max(0, dy), dx) * 180) / Math.PI;
  const i = Math.min(4, Math.max(0, Math.floor(gradi / 36)));

  return (tre ? 'tre' : 'due') + SPICCHI[i];
}

/* L'elenco, nell'ordine in cui si guarda una mappa: prima l'area, poi la
 * media da destra a sinistra, poi i tre da destra a sinistra. */
export const ZONE_TIRO = [
  { key: 'area', label: 'Area', punti: 2 },

  { key: 'due_dx2', label: 'Fondo destro', punti: 2 },
  { key: 'due_dx1', label: 'Gomito destro', punti: 2 },
  { key: 'due_c', label: 'Lunetta', punti: 2 },
  { key: 'due_sx1', label: 'Gomito sinistro', punti: 2 },
  { key: 'due_sx2', label: 'Fondo sinistro', punti: 2 },

  { key: 'tre_dx2', label: 'Angolo destro', punti: 3 },
  { key: 'tre_dx1', label: 'Ala destra', punti: 3 },
  { key: 'tre_c', label: 'Tre centrale', punti: 3 },
  { key: 'tre_sx1', label: 'Ala sinistra', punti: 3 },
  { key: 'tre_sx2', label: 'Angolo sinistro', punti: 3 }
];

function newStats() {
  return {
    fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0,
    tov: 0, tovTypes: { generica: 0, palleggio: 0, passaggio: 0, passi: 0 },
    blk: 0, blkAgainst: 0, pf: 0, pfDrawn: 0, plusMinus: 0, seconds: 0,
    // Il TIPO dei falli. `pf` resta il totale — è il numero da cui dipende
    // l'uscita per falli — e qui dentro c'è di che spiegarlo.
    pfTypes: { personale: 0, tecnico: 0, antisportivo: 0 },
    // I tiri con il punto da cui sono partiti: { x, y, act, dentro, q }.
    // Stanno dentro il giocatore, e non in un elenco a parte, perche' sono
    // suoi — e perche' cosi' viaggiano gia' con il tabellino, senza bisogno
    // di una colonna nuova sul database.
    tiri: []
  };
}

function score(s) {
  return (s.fgm2 || 0) * 2 + (s.fgm3 || 0) * 3 + (s.ftm || 0);
}

export const BASKET = {
  key: 'basket',
  label: 'Pallacanestro',
  federazione: 'FIP',
  short: 'Basket',
  description: 'Quintetto, periodi e tabellino completo con tiri, rimbalzi e valutazione.',

  positions: ['Playmaker', 'Guardia', 'Ala piccola', 'Ala grande', 'Centro'],
  positionPlaceholder: 'Es. Guardia',

  // La proporzione e' quella del viewBox, cioe' quella del campo vero: senza,
  // il disegno si stira per riempire il riquadro e l'arco da tre diventa
  // un'ellisse. Un campo disegnato male e' peggio di nessun campo, perche' chi
  // lo guarda ci cerca dentro delle distanze.
  field: { svg: FIELD_SVG, slots: SLOTS, ratio: 150 / 140, onFieldLabel: 'Quintetto', benchLabel: 'Panchina' },

  // Le tre medie mostrate sul campo in Rosa e nella Scheda evolutiva.
  headline: [
    { key: 'pts', short: 'PT', label: 'Punti' },
    { key: 'ast', short: 'AS', label: 'Assist' },
    { key: 'reb', short: 'RB', label: 'Rimbalzi' }
  ],

  // Come si ricava ogni voce stagionale dal tabellino di una partita.
  // computeSeasonStats non sa nulla di basket: itera queste chiavi.
  aggregate: {
    pts: (p) => (p.pts != null ? p.pts : score(p.stats || {})),
    reb: (p) => ((p.stats || {}).orb || 0) + ((p.stats || {}).drb || 0),
    ast: (p) => (p.stats || {}).ast || 0,
    stl: (p) => (p.stats || {}).stl || 0,
    blk: (p) => (p.stats || {}).blk || 0,
    tov: (p) => (p.stats || {}).tov || 0,
    seconds: (p) => (p.stats || {}).seconds || 0,

    /* I TIRI: SEGNATI E TENTATI.
     *
     * Erano gia' tutti nel tabellino — ogni tocco su "Canestro" e ogni tocco
     * su "Errore" li scrive da sempre — e finivano solo dentro la valutazione,
     * che li mescola a tutto il resto. Fuori di li' non li vedeva nessuno.
     *
     * Cosi' l'app raccoglieva l'unica cosa che nel basket si guarda per prima
     * — quanto tira bene una squadra — e non la diceva mai. Qui tentati e
     * segnati diventano totali di stagione, e da loro nascono le percentuali. */
    fgm2: (p) => (p.stats || {}).fgm2 || 0,
    fga2: (p) => (p.stats || {}).fga2 || 0,
    fgm3: (p) => (p.stats || {}).fgm3 || 0,
    fga3: (p) => (p.stats || {}).fga3 || 0,
    ftm: (p) => (p.stats || {}).ftm || 0,
    fta: (p) => (p.stats || {}).fta || 0,
    // Rimbalzi divisi: `reb` resta il totale, ma offensivi e difensivi sono
    // due gesti diversi, e il tabellino federale li tiene separati.
    orb: (p) => (p.stats || {}).orb || 0,
    drb: (p) => (p.stats || {}).drb || 0,
    pf: (p) => (p.stats || {}).pf || 0,
    /* I falli tecnici e gli antisportivi, a parte.
     *
     * `pf` resta il totale — è il numero che decide chi sta in campo e quando
     * l'altra squadra va in bonus — ma un tecnico non è un fallo in più
     * qualunque, e un referto che non lo distingue non spiega perché quel
     * giocatore è uscito.
     *
     * Sono due conteggi e non un contenitore perché così si sommano da soli:
     * su una partita, nella riga della squadra, e su tutta la stagione. */
    pfTech: (p) => (((p.stats || {}).pfTypes) || {}).tecnico || 0,
    pfUnsp: (p) => (((p.stats || {}).pfTypes) || {}).antisportivo || 0,
    // Il piu'/meno: quanti punti di scarto ha prodotto la squadra mentre lui
    // era in campo. Lo scrive il registro dei quintetti, a ogni cambio.
    plusMinus: (p) => (p.stats || {}).plusMinus || 0
  },

  /* Le colonne della tabella Statistiche. `avg` aggiunge la media a partita.
   *
   * Sono nell'ordine in cui si legge un tabellino di carta: quanto ha
   * fatto, come ha tirato, e poi tutto il resto.
   *
   * Le tre percentuali e la percentuale effettiva sono RAPPORTI: non si
   * sommano, si ricalcolano dai totali. Due partite al 40% non fanno l'80%,
   * e per questo hanno una funzione al posto di una chiave. `frazione` e' il
   * "5/12" che va letto accanto: senza, un 100% tirato una volta sola sembra
   * una serata memorabile. */
  seasonColumns: [
    { key: 'pts', short: 'PT', label: 'Punti', avg: 'PPG' },
    { key: 't2', short: '2P', label: 'Tiri da due', suffisso: '%',
      calc: (r) => (r.fga2 ? Math.round((r.fgm2 / r.fga2) * 100) : null),
      frazione: (r) => (r.fga2 ? r.fgm2 + '/' + r.fga2 : null) },
    { key: 't3', short: '3P', label: 'Tiri da tre', suffisso: '%',
      calc: (r) => (r.fga3 ? Math.round((r.fgm3 / r.fga3) * 100) : null),
      frazione: (r) => (r.fga3 ? r.fgm3 + '/' + r.fga3 : null) },
    { key: 'tl', short: 'TL', label: 'Tiri liberi', suffisso: '%',
      calc: (r) => (r.fta ? Math.round((r.ftm / r.fta) * 100) : null),
      frazione: (r) => (r.fta ? r.ftm + '/' + r.fta : null) },
    // La percentuale effettiva tiene conto che un canestro da tre vale una
    // volta e mezza uno da due. E' il modo giusto di confrontare chi tira da
    // fuori con chi gioca sotto canestro: con la percentuale secca, l'ala che
    // mette 4 triple su 10 risulta peggiore del centro che ne segna 5 su 10
    // da sotto, e in realta' ha prodotto piu' punti con gli stessi palloni.
    { key: 'efg', short: 'eFG', label: 'Percentuale effettiva al tiro', suffisso: '%',
      calc: (r) => {
        const tentati = (r.fga2 || 0) + (r.fga3 || 0);
        if (!tentati) return null;
        return Math.round((((r.fgm2 || 0) + (r.fgm3 || 0) + 0.5 * (r.fgm3 || 0)) / tentati) * 100);
      } },
    { key: 'reb', short: 'REB', label: 'Rimbalzi', avg: 'RPG' },
    { key: 'ast', short: 'AST', label: 'Assist', avg: 'APG' },
    { key: 'tov', short: 'PP', label: 'Palle perse' },
    { key: 'stl', short: 'ST', label: 'Palle rubate' },
    { key: 'blk', short: 'STP', label: 'Stoppate fatte' },
    { key: 'pf', short: 'F', label: 'Falli commessi' },
    // Il piu'/meno non e' una prestazione, e' un effetto: dice come e' andata
    // la squadra mentre c'era lui. Un ragazzo che segna poco e ha il miglior
    // piu'/meno della squadra sta facendo qualcosa che le altre colonne non
    // vedono, e questa e' l'unica che glielo riconosce.
    //
    // `segno` lo fa scrivere con il piu' davanti quando e' positivo: +6 e 6
    // si leggono in due modi diversi, e qui il segno E' l'informazione.
    //
    // `nonSommare` lo tiene fuori dalla riga della squadra: sommare il
    // piu'/meno di dodici giocatori darebbe cinque volte lo scarto vero,
    // perche' ogni punto e' contato una volta per ciascuno dei cinque in
    // campo. Lo scarto della squadra e' il risultato, ed e' gia' in cima.
    //
    // Il trattino e' quello ASCII e non il segno meno tipografico. Questa
    // sigla finisce nell'intestazione del tabellino stampato, e i caratteri
    // predefiniti di jsPDF sono codificati WinAnsi: il meno «vero» (U+2212)
    // non ci sta dentro e sul foglio esce una virgoletta. A schermo la
    // differenza non si vede.
    { key: 'plusMinus', short: '+/-', label: 'Scarto prodotto dalla squadra mentre era in campo',
      segno: true, nonSommare: true }
  ],

  /* LA LEGENDA, UNA SIGLA ALLA VOLTA.
   *
   * Prima era una frase sola, scritta per la tabella della STAGIONE, e
   * finiva stampata anche sotto il tabellino di una PARTITA — dove spiegava
   * «PG = partite giocate» accanto a una tabella senza la colonna PG. Un
   * foglio che spiega una colonna che non c'e' fa dubitare di tutte le
   * altre.
   *
   * Qui ogni sigla sta per conto suo e chi disegna prende solo quelle che ha
   * davvero messo in tabella. Le ovvie non ci sono: PT non ha bisogno di
   * nessuno che dica che sono i punti.
   */
  glossario: {
    PG: 'partite giocate',
    PPG: 'punti a partita',
    RPG: 'rimbalzi a partita',
    APG: 'assist a partita',
    '2P': 'tiri da due, segnati su tentati',
    '3P': 'tiri da tre, segnati su tentati',
    TL: 'tiri liberi, segnati su tentati',
    eFG: 'percentuale effettiva, conta il canestro da tre una volta e mezza',
    REB: 'rimbalzi',
    PP: 'palle perse',
    ST: 'palle rubate',
    STP: 'stoppate fatte',
    F: 'falli commessi',
    '+/-': 'punti di scarto prodotti dalla squadra mentre era in campo'
  },
  seasonLegend: 'PG = partite giocate · PPG/RPG/APG = medie a partita · 2P/3P/TL = percentuali al tiro, con segnati su tentati · eFG = percentuale effettiva, conta il canestro da tre una volta e mezza · PP = palle perse · ST = palle rubate · STP = stoppate fatte · F = falli commessi · +/- = punti di scarto prodotti dalla squadra mentre era in campo',
  showMinutes: false,

  ratingLabel: 'Valutazione',
  rating(p) {
    const s = p.stats || {};
    const pts = p.pts != null ? p.pts : score(s);
    const missed = ((s.fga2 || 0) - (s.fgm2 || 0)) + ((s.fga3 || 0) - (s.fgm3 || 0)) + ((s.fta || 0) - (s.ftm || 0));
    return pts + ((s.orb || 0) + (s.drb || 0)) + (s.ast || 0) + (s.stl || 0) + (s.blk || 0)
      + (s.pfDrawn || 0) - missed - (s.tov || 0) - (s.pf || 0) - (s.blkAgainst || 0);
  },

  score,
  newStats,

  // La geometria del campo viaggia con lo sport: il referto non deve sapere
  // dove passa l'arco da tre, deve solo poterlo chiedere.
  zonaTiro,
  zoneTiro: ZONE_TIRO,

  // ------------------------------------------------------------------ SCOUT
  // Il basket è l'unico dei tre in cui si segna un evento ogni pochi secondi:
  // qui conta il numero di tocchi. Due soli — giocatore, poi azione — con i
  // comandi che si aprono sotto il pollice invece che in fondo alla pagina.
  //
  // Niente cronometro, e quindi niente minuti giocati. Nel basket il tempo si
  // ferma di continuo, ed è l'unica statistica che si corrompe da sola: scorre
  // anche quando nessuno la guarda. Una pausa dimenticata durante due tiri
  // liberi regala novanta secondi fantasma a cinque giocatori insieme, in
  // silenzio. Ogni altro dato nasce da un tocco, quindi se manca è un buco che
  // si vede. Riattivarlo un domani è una riga: hasClock e trackSeconds.
  /* IL REFERTO DELLA SQUADRA.
   *
   * Due blocchi, e li dichiara lo sport perche' sono lo sport. Un referto di
   * pallavolo con i rimbalzi a zero non e' un referto incompleto: e' il
   * referto di un altro gioco.
   *
   * `ciambelle` sono le percentuali che si guardano per prime, quelle da
   * disegnare come un anello. `riepilogo` sono i conteggi, che si leggono come
   * numeri e basta.
   */
  ciambelle: (t) => {
    const q = (v, tot) => (tot ? Math.round((v / tot) * 100) : null);
    // `v` e' il numeratore dell'anello: qui coincide sempre con i segnati,
    // ma si dichiara lo stesso perche' e' quello che il disegnatore legge.
    const voce = (etichetta, v, tot) => ({
      etichetta, pct: q(v, tot), tot, v,
      righe: [[v, 'segnati'], [Math.max(0, tot - v), 'sbagliati']]
    });
    const campo = voce('Dal campo', (t.fgm2 || 0) + (t.fgm3 || 0), (t.fga2 || 0) + (t.fga3 || 0));
    const voci = [
      campo,
      voce('Da due', t.fgm2 || 0, t.fga2 || 0),
      voce('Da tre', t.fgm3 || 0, t.fga3 || 0),
      voce('Tiri liberi', t.ftm || 0, t.fta || 0)
    ];
    // Nessun tiro tentato in nessuna categoria: non c'e' niente da disegnare,
    // e quattro anelli vuoti sarebbero peggio di niente.
    return voci.some(v => v.tot > 0) ? voci : null;
  },

  riepilogo: (t) => [
    { valore: (t.orb || 0) + (t.drb || 0), etichetta: 'rimbalzi' },
    { valore: t.orb || 0, etichetta: 'offensivi' },
    { valore: t.drb || 0, etichetta: 'difensivi' },
    { valore: t.ast || 0, etichetta: 'assist' },
    { valore: t.tov || 0, etichetta: 'palle perse' },
    { valore: t.stl || 0, etichetta: 'palle rubate' },
    { valore: t.blk || 0, etichetta: 'stoppate' },
    { valore: t.pf || 0, etichetta: 'falli' }
  ],

  scout: {
    period: {
      label: 'Periodo', plural: 'Periodi', short: 'P', count: 4, minutes: null,
      askCount: true,
      hasClock: false, direction: null,
      allowExtra: true, extraLabel: 'Supplementare'
    },
    ourScore: 'fromActions',
    opponentScore: 'perPeriod',
    scoreDisplay: 'sum',
    trackSeconds: false,
    teamFouls: true,
    teamFoulBonus: 5,
    /* AL QUINTO SI ESCE.
     *
     * È la regola FIBA, ed è il motivo per cui sotto il gettone di ogni
     * giocatore in campo ci sono cinque trattini: chi segna deve poter
     * vedere con la coda dell'occhio chi è vicino a uscire, senza aprire
     * niente e senza contare a mente. Un allenatore che scopre il quinto
     * fallo dall'arbitro ha già perso il cambio. */
    falliPerUscire: 5,

    /* Una tripla avversaria costava tre tocchi, e il segnapunti li faceva
     * mentre il gioco era gia' ripartito. Uno, due o tre: come li fanno. */
    manoPunti: [1, 2, 3],

    /* Il registro dei quintetti. I cambi si segnano gia' e il punteggio si
     * muove gia': ricordare com'era il tabellone quando quei cinque sono
     * entrati non costa nessun tocco in piu', e risponde alla domanda che un
     * allenatore si fa davvero a fine partita. Non nella pallavolo, dove la
     * struttura del gioco e' la rotazione e i cambi sono un'altra cosa. */
    quintetti: true,

    /* I possessi. Non si contano, si ricavano da quello che gia' c'e': un
     * possesso finisce con un tiro, con una palla persa o in lunetta. Sono
     * l'unita' con cui due partite giocate a ritmi diversi diventano
     * confrontabili. Nella pallavolo non servono: li' ogni scambio e' un
     * punto, e i palloni giocati sono per definizione uguali per le due
     * squadre. */
    possessi: true,

    /* LA MAPPA DEI TIRI, spenta di serie.
     *
     * Ce l'hanno tutti — FIBA LiveStats, Easy Stats, CourtBook, le due
     * italiane — ed e' l'unica cosa di questo scout che costa un tocco in
     * piu'. Uno su ogni tiro, e in una partita di tiri ce ne sono cento.
     *
     * Per un allenatore che studia da dove segna la sua squadra vale quel
     * tocco. Per un genitore che tiene il tabellino la prima volta e' il
     * tocco che gli fa perdere l'azione dopo. Non si sceglie per tutti: si
     * accende dal pannello, e la scelta resta sul dispositivo di chi segna. */
    mappaTiri: true,
    periodPrompt: 'Quanti punti ha segnato l\u2019avversario in questo periodo?',
    groups: [
      // `zona` dice che questo tiro ha un punto di partenza: con la mappa
      // accesa, prima di registrarlo l'app chiede da dove. I tiri liberi no,
      // si tirano sempre dallo stesso posto.
      /* L'ERRORE AL TIRO CHIEDE UNA COSA SOLA: CHI HA PRESO IL RIMBALZO.
       *
       * Ne chiedeva due — anche da dove era partito il tiro — ed erano
       * troppe: due domande di fila su un'azione che arriva ogni quaranta
       * secondi, mentre il gioco è già ripartito. La posizione è rimasta solo
       * sul canestro, che è l'azione per cui vale la pena fermarsi mezzo
       * secondo.
       *
       * Il rimbalzo invece torna, perché è l'altra metà del tiro sbagliato:
       * senza, quel pallone sparisce dal referto. E la domanda ha già la via
       * d'uscita giusta — «agli avversari» — che è la risposta in metà dei
       * casi, e si prende con un tocco solo.
       *
       * Conseguenza della posizione solo sui canestri: la mappa dice DOVE SI
       * SEGNA e non più le percentuali per zona. Il referto lo dice, invece di
       * stampare cento per cento dappertutto.
       */
      { label: 'Tiro da 2', layout: 'pair', actions: [
        { act: 'fg2_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm2: 1, fga2: 1 }, score: 2, zona: true, dentro: true, poi: 'assist' },
        { act: 'fg2_miss', label: '\u2717 Errore', tone: 'miss', apply: { fga2: 1 }, poi: 'rimbalzo' }
      ]},
      { label: 'Tiro da 3', layout: 'pair', actions: [
        { act: 'fg3_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm3: 1, fga3: 1 }, score: 3, zona: true, dentro: true, poi: 'assist' },
        { act: 'fg3_miss', label: '\u2717 Errore', tone: 'miss', apply: { fga3: 1 }, poi: 'rimbalzo' }
      ]},
      { label: 'Tiro libero', layout: 'pair', actions: [
        { act: 'ft_made', label: '\u2713 Segnato', tone: 'made', apply: { ftm: 1, fta: 1 }, score: 1 },
        { act: 'ft_miss', label: '\u2717 Sbagliato', tone: 'miss', apply: { fta: 1 }, poi: 'rimbalzo' }
      ]},
      { label: 'Rimbalzo', layout: 'pair', actions: [
        { act: 'orb', label: 'Offensivo', tone: 'neutral', apply: { orb: 1 } },
        { act: 'drb', label: 'Difensivo', tone: 'neutral', apply: { drb: 1 } }
      ]},
      { label: 'Playmaking e difesa', actions: [
        { act: 'ast', label: 'Assist', tone: 'neutral', apply: { ast: 1 } },
        { act: 'stl', label: 'Palla rubata', tone: 'neutral', apply: { stl: 1 } },
        { act: 'blk', label: 'Stoppata', tone: 'neutral', apply: { blk: 1 } }
      ]},
      { label: 'Palla persa', actions: [
        { act: 'tov_generica', label: 'Generica', tone: 'warn', apply: { tov: 1 }, nested: { tovTypes: 'generica' } },
        { act: 'tov_palleggio', label: 'Palleggio', tone: 'warn', apply: { tov: 1 }, nested: { tovTypes: 'palleggio' } },
        { act: 'tov_passaggio', label: 'Passaggio', tone: 'warn', apply: { tov: 1 }, nested: { tovTypes: 'passaggio' } },
        { act: 'tov_passi', label: 'Passi/Sup.', tone: 'warn', apply: { tov: 1 }, nested: { tovTypes: 'passi' } }
      ]},
      /* I TRE FALLI CHE SI SEGNANO AL TAVOLO.
       *
       * Personale, tecnico, antisportivo. Li distingue chi tiene il referto
       * ufficiale, e finora qui erano un «fallo commesso» solo: un referto
       * che non dice se quello era un tecnico racconta un'altra partita, e
       * soprattutto non spiega perché quel giocatore è uscito.
       *
       * TUTTI E TRE CONTANO UNO. Contano uno nei falli del giocatore — al
       * quinto si esce, e ci si arriva sommando i tre tipi — e contano uno
       * nei falli di squadra del periodo, che è quello che manda l'altra
       * squadra in bonus. È il regolamento FIBA, non una semplificazione.
       *
       * Il TIPO sta in un contenitore dentro le statistiche, come i tipi di
       * palla persa: `pf` resta il totale, che è il numero da cui dipende
       * tutto il resto. */
      { label: 'Falli e stoppate subite', actions: [
        { act: 'pf', label: 'Fallo', tone: 'warn', apply: { pf: 1 },
          nested: { pfTypes: 'personale' }, teamFoul: true },
        { act: 'pf_tecnico', label: 'Tecnico', tone: 'warn', apply: { pf: 1 },
          nested: { pfTypes: 'tecnico' }, teamFoul: true },
        { act: 'pf_antisportivo', label: 'Antisportivo', tone: 'warn', apply: { pf: 1 },
          nested: { pfTypes: 'antisportivo' }, teamFoul: true },
        { act: 'pfDrawn', label: 'Fallo subito', tone: 'neutral', apply: { pfDrawn: 1 } },
        { act: 'blkAgainst', label: 'Stoppata subita', tone: 'warn', apply: { blkAgainst: 1 } }
      ]}
    ],

    // ------------------------------------------------------------- catene
    // Nel basket certi eventi ne chiamano un altro quasi sempre: dopo un
    // errore al tiro c'e' un rimbalzo, dopo un canestro spesso un assist.
    // Invece di far ricominciare da capo — giocatore, azione — l'app fa la
    // domanda successiva da sola, e per rispondere basta un tocco.
    //
    // Il TIPO del rimbalzo non si chiede: se l'errore e' nostro, un nostro
    // rimbalzo e' offensivo per definizione. Il contesto sa gia' la risposta,
    // e una domanda la cui risposta e' deducibile e' una domanda di troppo.
    chains: {
      rimbalzo: {
        titolo: 'Chi prende il rimbalzo?',
        azione: { act: 'orb', label: 'Rimbalzo', apply: { orb: 1 } },
        altro: 'Agli avversari',
        includiAutore: true
      },
      assist: {
        titolo: 'Assist di chi?',
        azione: { act: 'ast', label: 'Assist', apply: { ast: 1 } },
        altro: 'Nessun assist',
        includiAutore: false
      }
    },
    // Il riquadro del giocatore in campo mostra questa voce: e' quella che il
    // segnapunti controlla di continuo per accorgersi di aver sbagliato persona.
    tileStat: { key: 'pts', short: 'PT' }
  },

  match: {
    liveTracker: true,
    periodLabel: 'Periodo',
    defaultPeriods: 4,
    defaultPeriodMinutes: 10,
    scoreLabel: 'Punti',
    minOnField: 5
  },

  standings: {
    hasDraws: false,
    winLabel: 'V', lossLabel: 'S',
    pointsHint: 'Due punti a vittoria, zero a sconfitta.',
    extras: [
      { key: 'pf', short: 'PF', label: 'Punti fatti', role: 'scored' },
      { key: 'ps', short: 'PS', label: 'Punti subiti', role: 'conceded' }
    ],
    // Punti di classifica guadagnati da chi ha segnato  contro .
    pointsFor: (scored, conceded) => (scored > conceded ? 2 : 0)
  }
};

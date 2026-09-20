// Pallavolo. Sei in campo nella disposizione delle zone: zona 1 in basso a
// destra (chi serve), poi in senso antiorario fino alla 6. È l'unico sport dei
// tre in cui la posizione sul campo ha un nome che l'allenatore usa davvero.
const SLOTS = [
  { top: '76%', left: '78%' },  // zona 1
  { top: '30%', left: '78%' },  // zona 2
  { top: '30%', left: '50%' },  // zona 3
  { top: '30%', left: '22%' },  // zona 4
  { top: '76%', left: '22%' },  // zona 5
  { top: '76%', left: '50%' }   // zona 6
];

// Metà campo da pallavolo (9m × 9m più la zona di servizio → viewBox 90×110,
// rete in alto). La linea dei 3 metri è quella che si riconosce a colpo d'occhio.
const FIELD_SVG = `
<svg class="court-lines" viewBox="0 0 90 110" preserveAspectRatio="none" fill="none"
     stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
  <!-- Il campo: nove metri per nove, rete in alto, zona di servizio sotto. -->
  <rect x="0.6" y="0.6" width="88.8" height="88.8" rx="1"/>

  <!-- La rete, con le sue bande: e' il bordo alto, e va visto come un muro. -->
  <path d="M0.6 0.6h88.8" stroke-width="1.8"/>
  <path d="M0.6 3.2h88.8" stroke-opacity="0.35"/>

  <!-- La linea dei tre metri: quella che si riconosce a colpo d'occhio, e che
       divide chi puo' attaccare da chi no. -->
  <path d="M0.6 30.6h88.8" stroke-width="0.7"/>

  <!-- Il fondo campo e la zona di servizio dietro. -->
  <path d="M0.6 89.4h88.8" stroke-width="0.7"/>
  <path d="M0.6 106h88.8" stroke-dasharray="3 3" stroke-opacity="0.5"/>
  <path d="M0.6 89.4v16.6M89.4 89.4v16.6" stroke-dasharray="3 3" stroke-opacity="0.5"/>

  <!-- I numeri di zona, scritti dove stanno davvero. Sono il nome che
       l'allenatore usa per parlare: "sta in quattro", "gira in uno". -->
  <g fill="currentColor" fill-opacity="0.3" stroke="none"
     font-family="inherit" font-size="7" font-weight="700" text-anchor="middle">
    <text x="70" y="86">1</text>
    <text x="70" y="20">2</text>
    <text x="45" y="20">3</text>
    <text x="20" y="20">4</text>
    <text x="20" y="86">5</text>
    <text x="45" y="86">6</text>
  </g>
</svg>`;

/* IL CAMPO INTERO, VISTO DI FIANCO.
 *
 * Quello del sestetto e' mezzo campo: basta, perche' li' si dispongono sei
 * giocatrici. Una traiettoria no: parte da casa nostra e finisce da loro, e
 * mezzo campo non la puo' contenere.
 *
 * DI FIANCO e non in piedi, con la rete verticale e noi a sinistra. In piedi
 * un campo da 9 per 18 diventa una striscia alta e stretta: su un telefono
 * larga centocinquanta pixel, dove un gesto preciso non si fa. Di fianco
 * prende tutta la larghezza, e l'attacco si disegna con una passata del dito
 * da sinistra a destra — che e' anche la direzione in cui va la palla.
 */
export const CAMPO_INTERO = `
<svg class="court-lines" viewBox="0 0 200 90" preserveAspectRatio="none" fill="none"
     stroke="currentColor" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round">
  <!-- I due campi: diciotto metri per nove, dieci unita' al metro. -->
  <rect x="10" y="0.7" width="180" height="88.6" rx="1"/>

  <!-- La rete, in mezzo: e' il muro, e si vede che lo e'. -->
  <path d="M100 0.7v88.6" stroke-width="2.4"/>

  <!-- Le due linee dei tre metri. -->
  <path d="M70 0.7v88.6" stroke-width="0.9"/>
  <path d="M130 0.7v88.6" stroke-width="0.9"/>

  <!-- Le zone di servizio, tratteggiate perche' non sono campo. -->
  <path d="M10 0.7H0.6v88.6H10" stroke-dasharray="3 3" stroke-opacity="0.45"/>
  <path d="M190 0.7h9.4v88.6H190" stroke-dasharray="3 3" stroke-opacity="0.45"/>

  <!-- Chi sta di qua e chi di la'. Senza, una traiettoria disegnata al
       contrario sembra giusta. -->
  <g fill="currentColor" fill-opacity="0.26" stroke="none"
     font-family="inherit" font-size="9" font-weight="700" text-anchor="middle">
    <text x="40" y="49">NOI</text>
    <text x="160" y="49">LORO</text>
  </g>
</svg>`;

function newStats() {
  return {
    // `attacks` sono gli attacchi TENTATI, vincenti ed errori compresi. Senza
    // di loro l'efficienza non esiste: si avrebbero i numeratori e non il
    // denominatore, cioe' i punti di un'attaccante ma non quanti palloni le
    // sono serviti per farli.
    points: 0,

    // SERVIZIO: ace, errore, positiva.
    aces: 0, serveErrors: 0, servePos: 0,

    // ATTACCO: punto, errore, positivo, negativo. `attacks` e' la somma dei
    // quattro, cioe' i palloni attaccati: senza il totale l'efficienza non
    // esiste — si avrebbero i numeratori e non il denominatore.
    kills: 0, attackErrors: 0, attackPos: 0, attackNeg: 0, attacks: 0,
    // Com'e' finito l'errore. Due numeri diversi che dicono due cose
    // diverse: fuori e' una scelta di tiro, murata e' una lettura del muro.
    attackOut: 0, attackBlocked: 0,

    // DIFESA: positiva, negativa, errore.
    digs: 0, digNeg: 0, digErrors: 0,

    // RICEZIONE a quattro livelli, come la chiamano in campo: ++ perfetta
    // (l'alzatrice puo' fare tutto), + positiva (opzioni ridotte), - resta
    // solo la palla spinta, errore.
    recPerf: 0, recPos: 0, recNeg: 0, receptionErrors: 0,

    blocks: 0, assists: 0, setsPlayed: 0,

    // Le traiettorie dei punti: { x1, y1, x2, y2, q } in percentuale del
    // campo intero. Da dove e' partita la palla e dove e' caduta.
    traiettorie: []
  };
}

export const PALLAVOLO = {
  key: 'pallavolo',
  label: 'Pallavolo',
  federazione: 'FIPAV',
  short: 'Volley',
  description: 'Sei in campo per zone, set invece dei periodi, punti e muri.',

  positions: ['Palleggiatore', 'Opposto', 'Schiacciatore', 'Centrale', 'Libero'],
  positionPlaceholder: 'Es. Centrale',

  field: { svg: FIELD_SVG, slots: SLOTS, ratio: 90 / 110, onFieldLabel: 'Sestetto', benchLabel: 'Panchina' },

  headline: [
    { key: 'points', short: 'PT', label: 'Punti' },
    { key: 'kills', short: 'AT', label: 'Attacchi vincenti' },
    { key: 'blocks', short: 'MU', label: 'Muri' }
  ],

  aggregate: {
    points: (p) => (p.stats || {}).points || 0,
    kills: (p) => (p.stats || {}).kills || 0,
    attacks: (p) => (p.stats || {}).attacks || 0,
    attackPos: (p) => (p.stats || {}).attackPos || 0,
    attackNeg: (p) => (p.stats || {}).attackNeg || 0,
    attackBlocked: (p) => (p.stats || {}).attackBlocked || 0,
    attackOut: (p) => (p.stats || {}).attackOut || 0,
    digNeg: (p) => (p.stats || {}).digNeg || 0,
    digErrors: (p) => (p.stats || {}).digErrors || 0,
    blocks: (p) => (p.stats || {}).blocks || 0,
    aces: (p) => (p.stats || {}).aces || 0,
    attackErrors: (p) => (p.stats || {}).attackErrors || 0,
    serveErrors: (p) => (p.stats || {}).serveErrors || 0,
    digs: (p) => (p.stats || {}).digs || 0,
    servePos: (p) => (p.stats || {}).servePos || 0,
    recPerf: (p) => (p.stats || {}).recPerf || 0,
    recPos: (p) => (p.stats || {}).recPos || 0,
    recNeg: (p) => (p.stats || {}).recNeg || 0,
    receptionErrors: (p) => (p.stats || {}).receptionErrors || 0,
    assists: (p) => (p.stats || {}).assists || 0,
    setsPlayed: (p) => (p.stats || {}).setsPlayed || 0
  },

  seasonColumns: [
    { key: 'points', short: 'PT', label: 'Punti', avg: 'P/S' },
    { key: 'kills', short: 'AT', label: 'Attacchi vincenti' },
    { key: 'attacks', short: 'TOT', label: 'Attacchi tentati' },
    // L'efficienza non si somma, si ricalcola: e' un rapporto, e sommare due
    // percentuali di due partite diverse non vuol dire niente. Per questo ha
    // una funzione al posto di una chiave.
    { key: 'eff', short: 'EFF', label: 'Efficienza in attacco', suffisso: '%',
      calc: (r) => (r.attacks ? Math.round(((r.kills - r.attackErrors) / r.attacks) * 100) : null) },
    { key: 'blocks', short: 'MU', label: 'Muri punto' },
    { key: 'aces', short: 'ACE', label: 'Ace' },
    { key: 'digs', short: 'DIF', label: 'Difese positive' },
    // La positivita' in difesa, come quella in ricezione: quante palle
    // restano giocabili sul totale di quelle toccate.
    { key: 'difPos', short: 'DIF%', label: 'Positivit\u00e0 in difesa', suffisso: '%',
      calc: (r) => {
        const tot = (r.digs || 0) + (r.digNeg || 0) + (r.digErrors || 0);
        return tot ? Math.round(((r.digs || 0) / tot) * 100) : null;
      } },
    // La positivita' in ricezione: quante palle tornano giocabili sul totale
    // di quelle ricevute. E' il secondo numero della pallavolo dopo
    // l'efficienza, e come quello e' un rapporto che si ricalcola.
    { key: 'ricPos', short: 'RIC', label: 'Positivit\u00e0 in ricezione', suffisso: '%',
      calc: (r) => {
        const tot = (r.recPerf || 0) + (r.recPos || 0) + (r.recNeg || 0) + (r.receptionErrors || 0);
        return tot ? Math.round((((r.recPerf || 0) + (r.recPos || 0)) / tot) * 100) : null;
      } },
    { key: 'assists', short: 'ALZ', label: 'Alzate vincenti' },
    { key: 'attackErrors', short: 'EA', label: 'Errori in attacco' },
    { key: 'attackBlocked', short: 'MUS', label: 'Attacchi murati' },
    { key: 'serveErrors', short: 'ES', label: 'Errori al servizio' },
    { key: 'setsPlayed', short: 'SET', label: 'Set giocati' }
  ],
  seasonLegend: 'PG = partite giocate · P/S = punti a partita · TOT = palloni attaccati · EFF = (vincenti meno errori) diviso gli attacchi · RIC = ricezioni ++ e + sul totale ricevuto · DIF% = difese positive sul totale difeso · MUS = attacchi finiti sul muro avversario · ALZ = alzate che hanno prodotto un punto · EA/ES = errori in attacco e al servizio',
  showMinutes: false,

  ratingLabel: 'Efficienza',
  // Punti fatti meno errori commessi: è la lettura più diffusa negli spogliatoi.
  rating(p) {
    const s = p.stats || {};
    return (s.points || 0) - (s.attackErrors || 0) - (s.serveErrors || 0) - (s.receptionErrors || 0);
  },

  score: (s) => (s.points || 0),
  newStats,

  // Il campo intero serve solo alla traiettoria: il descrittore lo porta con
  // se', cosi' lo scout non deve sapere com'e' fatto un campo da pallavolo.
  campoIntero: CAMPO_INTERO,
  campoInteroRatio: 200 / 90,

  // ------------------------------------------------------------------ SCOUT
  // La pallavolo non ha cronometro, e il punteggio del set non si ricava dai
  // soli punti dei nostri: dentro ci sono gli errori avversari, che non si
  // assegnano a nessuno. Quindi a fine set si scrivono i due punteggi.
  scout: {
    period: {
      label: 'Set', short: 'S', count: 3, minutes: null,
      hasClock: false, direction: null,
      // Non si chiede quanti: al meglio dei cinque se ne giocano tre, quattro
      // o cinque, e lo si scopre giocando. Si parte dal minimo e i successivi
      // si aggiungono da soli chiudendo quello in corso.
      askCount: false,
      allowExtra: true, extraLabel: 'Set'
    },
    /* Il regolamento FIPAV, ridotto a quello che serve a chi segna.
     *
     * Un set a 25 con due punti di scarto; il quinto — quello che si gioca solo
     * se si è 2-2 — a 15, sempre con due di scarto. Vince chi arriva a tre set.
     *
     * Scritto qui e non nel tracker perché è una regola di QUESTO sport: il
     * basket non ce l'ha, e il giorno che si aggiunge un altro sport che ce
     * l'ha, si aggiunge qui. */
    regolamento: {
      periodiPerVincere: 3,
      periodiMassimi: 5,
      scarto: 2,
      sogliaPeriodo: (n) => (n >= 5 ? 15 : 25),
      etichettaPalla: 'set point',
      etichettaMatch: 'match point'
    },
    /* OGNI PUNTO CHIUDE UNO SCAMBIO, E OGNI SCAMBIO HA UN BATTITORE.
     *
     * E' la regola che il basket non ha, ed e' quella da cui discende meta'
     * della statistica della pallavolo. Sapendo chi serviva si sa se un punto
     * e' un cambio palla o un break; sommandoli si ha il sideout, che e' il
     * numero con cui si vincono i campionati; e si sa quando girare, perche' si
     * gira esattamente quando si conquista il servizio.
     *
     * Una domanda sola a inizio set — chi batte — e il resto lo deduce l'app:
     * chi vince lo scambio serve il successivo. */
    scambi: {
      domanda: 'Chi batte?',
      noi: 'Noi',
      loro: 'Loro',
      etichettaCambioPalla: 'Cambio palla',
      etichettaBreak: 'Break'
    },
    ourScore: 'perPeriod',
    opponentScore: 'perPeriod',
    scoreDisplay: 'setsWon',
    trackSeconds: false,
    teamFouls: false,
    periodPrompt: 'Come è finito questo set?',
    /* I QUATTRO FONDAMENTALI, NELL'ORDINE IN CUI SI GIOCANO.
     *
     * Servizio, attacco, difesa, ricezione: e' la scansione con cui un
     * allenatore di pallavolo guarda uno scambio, ed e' anche l'ordine in cui
     * le voci si cercano su un foglio di scout federale. Ogni fondamentale
     * ha i suoi esiti, e ogni esito e' un tocco.
     *
     * Niente piu' opzionale: la ricezione era spenta di serie perche'
     * costava un tocco in piu' su meta' degli scambi, e per un genitore alla
     * prima volta era il tocco che faceva perdere lo scambio dopo. Adesso e'
     * un fondamentale come gli altri, sempre a schermo — e' una scelta
     * diversa, e vuol dire che questo scout e' per chi lo sa tenere.
     */
    groups: [
      { label: 'Servizio', actions: [
        { act: 'ace', label: 'Ace', tone: 'made', apply: { points: 1, aces: 1 } },
        { act: 'serve_err', label: 'Errore', etichettaBreve: 'Errore al servizio', tone: 'miss',
          apply: { serveErrors: 1 }, puntoLoro: true },
        { act: 'serve_pos', label: 'Positiva', etichettaBreve: 'Servizio positivo', tone: 'neutral',
          apply: { servePos: 1 } }
      ]},

      { label: 'Attacco', actions: [
        // Dopo un attacco vincente la domanda successiva e' sempre la stessa,
        // e in panchina la fanno ad alta voce: chi ha alzato.
        { act: 'kill', label: 'Punto', etichettaBreve: 'Attacco vincente', tone: 'made',
          apply: { points: 1, kills: 1, attacks: 1 }, poi: 'alzata', traiettoria: true },
        // L'errore chiede com'e' finito: fuori e' una scelta di tiro, murata
        // e' una lettura del muro avversario. Due correzioni diverse in
        // allenamento, e finora erano lo stesso numero.
        { act: 'attack_err', label: 'Errore', etichettaBreve: 'Errore in attacco', tone: 'miss',
          apply: { attackErrors: 1, attacks: 1 }, puntoLoro: true, poi: 'comeErrore' },
        { act: 'attack_pos', label: 'Positivo', etichettaBreve: 'Attacco positivo', tone: 'neutral',
          apply: { attackPos: 1, attacks: 1 } },
        { act: 'attack_neg', label: 'Negativo', etichettaBreve: 'Attacco negativo', tone: 'warn',
          apply: { attackNeg: 1, attacks: 1 } }
      ]},

      { label: 'Difesa', actions: [
        { act: 'dig_err', label: 'Errore', etichettaBreve: 'Errore in difesa', tone: 'miss',
          apply: { digErrors: 1 }, puntoLoro: true },
        { act: 'dig', label: 'Positiva', etichettaBreve: 'Difesa positiva', tone: 'made',
          apply: { digs: 1 } },
        { act: 'dig_neg', label: 'Negativa', etichettaBreve: 'Difesa negativa', tone: 'warn',
          apply: { digNeg: 1 } }
      ]},

      { label: 'Ricezione', actions: [
        { act: 'rec_perf', label: '++', etichettaBreve: 'Ricezione perfetta', tone: 'made',
          apply: { recPerf: 1 } },
        { act: 'rec_pos', label: '+', etichettaBreve: 'Ricezione positiva', tone: 'neutral',
          apply: { recPos: 1 } },
        { act: 'rec_neg', label: '\u2212', etichettaBreve: 'Ricezione slash', tone: 'warn',
          apply: { recNeg: 1 } },
        { act: 'recept_err', label: 'Errore', etichettaBreve: 'Errore in ricezione', tone: 'miss',
          apply: { receptionErrors: 1 }, puntoLoro: true }
      ]},

      /* IL MURO NON E' NEI QUATTRO, E SERVE LO STESSO.
       *
       * Un muro punto e' un punto: senza un pulsante, chi segna dovrebbe
       * aggiungerlo a mano col + sotto al punteggio, e quel punto non
       * sarebbe di nessuno. Resta qui, da solo, perche' e' l'unico
       * fondamentale che chiude uno scambio senza passare dall'attacco. */
      { label: 'Muro', actions: [
        { act: 'block', label: 'Muro punto', tone: 'made', apply: { points: 1, blocks: 1 } }
      ]}
    ],
    chains: {
      /* COM'E' FINITO L'ERRORE.
       *
       * Non chiede CHI, come le altre catene: chiede COSA, e la risposta va
       * sullo stesso giocatore che ha appena sbagliato. Due esiti, perche' in
       * allenamento si correggono in due modi diversi — fuori e' una scelta
       * di tiro, murata e' una lettura del muro.
       *
       * «Non lo so» c'e' apposta: chi segna guarda la palla, non sempre il
       * muro, e un dato messo a caso vale meno di un dato mancante. */
      comeErrore: {
        titolo: 'Com\u2019\u00e8 finito?',
        opzioni: [
          { act: 'att_out', label: 'Fuori o a rete', apply: { attackOut: 1 } },
          { act: 'att_blocked', label: 'Murata', apply: { attackBlocked: 1 } }
        ],
        altro: 'Non lo so'
      },
      alzata: {
        titolo: 'Chi ha alzato?',
        azione: { act: 'assist', label: 'Alzata', apply: { assists: 1 } },
        altro: 'Nessuna alzata',
        // Chi ha attaccato non puo' essersi alzato la palla da solo.
        includiAutore: false
      }
    },
    // La rotazione e' un gesto solo, e va fatto a mano: la si fa quando si
    // conquista il servizio, e chi segna lo sa prima dell'app. Automatizzarla
    // vorrebbe dire dedurre chi serviva, e un errore di deduzione a inizio set
    // sposta tutti i sei per tutto il set senza che nessuno se ne accorga.
    rotazione: { etichetta: 'Ruota', descrizione: 'Zona 1 va in 6, e tutti girano' },
    tileStat: { key: 'points', short: 'PT' }
  },

  match: {
    liveTracker: true,
    periodLabel: 'Set',
    defaultPeriods: 5,
    defaultPeriodMinutes: null,
    scoreLabel: 'Set vinti',
    minOnField: 6
  },

  standings: {
    hasDraws: false,
    winLabel: 'V', lossLabel: 'P',
    pointsHint: '3 punti se vinci 3-0 o 3-1, 2 se vinci 3-2, 1 se perdi 2-3.',
    extras: [
      { key: 'sv', short: 'SV', label: 'Set vinti', role: 'scored' },
      { key: 'sp', short: 'SP', label: 'Set persi', role: 'conceded' }
    ],
    // Nella pallavolo i punti dipendono da quanto e' stata combattuta: chi
    // vince 3-2 ne prende due, chi perde 2-3 ne prende comunque uno.
    pointsFor: (scored, conceded) => (scored > conceded
      ? (conceded <= 1 ? 3 : 2)
      : (scored === 2 ? 1 : 0))
  }
};

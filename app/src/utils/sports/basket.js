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

function newStats() {
  return {
    fgm2: 0, fga2: 0, fgm3: 0, fga3: 0, ftm: 0, fta: 0, orb: 0, drb: 0, ast: 0, stl: 0,
    tov: 0, tovTypes: { generica: 0, palleggio: 0, passaggio: 0, passi: 0 },
    blk: 0, blkAgainst: 0, pf: 0, pfDrawn: 0, plusMinus: 0, seconds: 0
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
    { key: 'plusMinus', short: '+/−', label: 'Scarto prodotto dalla squadra mentre era in campo',
      segno: true, nonSommare: true }
  ],
  seasonLegend: 'PG = partite giocate · PPG/RPG/APG = medie a partita · 2P/3P/TL = percentuali al tiro, con segnati su tentati · eFG = percentuale effettiva, conta il canestro da tre una volta e mezza · PP = palle perse · ST = palle rubate · STP = stoppate fatte · F = falli commessi · +/− = punti di scarto prodotti dalla squadra mentre era in campo',
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
  scout: {
    period: {
      label: 'Periodo', short: 'P', count: 4, minutes: null,
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

    /* Una tripla avversaria costava tre tocchi, e il segnapunti li faceva
     * mentre il gioco era gia' ripartito. Uno, due o tre: come li fanno. */
    manoPunti: [1, 2, 3],

    /* Il registro dei quintetti. I cambi si segnano gia' e il punteggio si
     * muove gia': ricordare com'era il tabellone quando quei cinque sono
     * entrati non costa nessun tocco in piu', e risponde alla domanda che un
     * allenatore si fa davvero a fine partita. Non nella pallavolo, dove la
     * struttura del gioco e' la rotazione e i cambi sono un'altra cosa. */
    quintetti: true,
    periodPrompt: 'Quanti punti ha segnato l\u2019avversario in questo periodo?',
    groups: [
      { label: 'Tiro da 2', layout: 'pair', actions: [
        { act: 'fg2_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm2: 1, fga2: 1 }, score: 2, poi: 'assist' },
        { act: 'fg2_miss', label: '\u2717 Errore', tone: 'miss', apply: { fga2: 1 }, poi: 'rimbalzo' }
      ]},
      { label: 'Tiro da 3', layout: 'pair', actions: [
        { act: 'fg3_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm3: 1, fga3: 1 }, score: 3, poi: 'assist' },
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
      { label: 'Falli e stoppate subite', actions: [
        { act: 'pf', label: 'Fallo commesso', tone: 'warn', apply: { pf: 1 }, teamFoul: true },
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

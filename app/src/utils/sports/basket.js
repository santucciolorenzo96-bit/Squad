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
  short: 'Basket',
  description: 'Quintetto, periodi e tabellino completo con tiri, rimbalzi e valutazione.',

  positions: ['Playmaker', 'Guardia', 'Ala piccola', 'Ala grande', 'Centro'],
  positionPlaceholder: 'Es. Guardia',

  field: { svg: FIELD_SVG, slots: SLOTS, onFieldLabel: 'Quintetto', benchLabel: 'Panchina' },

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
    seconds: (p) => (p.stats || {}).seconds || 0
  },

  // Colonne della tabella Statistiche stagionali. `avg` aggiunge la media a partita.
  seasonColumns: [
    { key: 'pts', short: 'PT', label: 'Punti', avg: 'PPG' },
    { key: 'reb', short: 'REB', label: 'Rimbalzi', avg: 'RPG' },
    { key: 'ast', short: 'AST', label: 'Assist', avg: 'APG' },
    { key: 'stl', short: 'ST', label: 'Palle rubate' },
    { key: 'blk', short: 'STP', label: 'Stoppate fatte' },
    { key: 'tov', short: 'PP', label: 'Palle perse' }
  ],
  seasonLegend: 'PG = partite giocate · PPG/RPG/APG = medie a partita · STP = stoppate fatte · PP = palle perse',
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
      hasClock: false, direction: null,
      allowExtra: true, extraLabel: 'Supplementare'
    },
    ourScore: 'fromActions',
    opponentScore: 'perPeriod',
    scoreDisplay: 'sum',
    trackSeconds: false,
    teamFouls: true,
    teamFoulBonus: 5,
    periodPrompt: 'Quanti punti ha segnato l\u2019avversario in questo periodo?',
    groups: [
      { label: 'Tiro da 2', layout: 'pair', actions: [
        { act: 'fg2_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm2: 1, fga2: 1 }, score: 2 },
        { act: 'fg2_miss', label: '\u2717 Errore', tone: 'miss', apply: { fga2: 1 } }
      ]},
      { label: 'Tiro da 3', layout: 'pair', actions: [
        { act: 'fg3_made', label: '\u2713 Canestro', tone: 'made', apply: { fgm3: 1, fga3: 1 }, score: 3 },
        { act: 'fg3_miss', label: '\u2717 Errore', tone: 'miss', apply: { fga3: 1 } }
      ]},
      { label: 'Tiro libero', layout: 'pair', actions: [
        { act: 'ft_made', label: '\u2713 Segnato', tone: 'made', apply: { ftm: 1, fta: 1 }, score: 1 },
        { act: 'ft_miss', label: '\u2717 Sbagliato', tone: 'miss', apply: { fta: 1 } }
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

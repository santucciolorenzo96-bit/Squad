// Calcio. Undici in campo in un 4-3-3, il modulo più leggibile a colpo d'occhio:
// la disposizione qui serve a riconoscere i giocatori, non a impostare tattica.
const SLOTS = [
  { top: '90%', left: '50%' },                                   // portiere
  { top: '70%', left: '16%' }, { top: '72%', left: '38%' },      // difesa
  { top: '72%', left: '62%' }, { top: '70%', left: '84%' },
  { top: '48%', left: '26%' }, { top: '45%', left: '50%' },      // centrocampo
  { top: '48%', left: '74%' },
  { top: '22%', left: '20%' }, { top: '18%', left: '50%' },      // attacco
  { top: '22%', left: '80%' }
];

// Metà campo da calcio in scala (52,5m × 68m → viewBox 136×105, porta in alto).
const FIELD_SVG = `
<svg class="court-lines" viewBox="0 0 136 105" preserveAspectRatio="none" fill="none"
     stroke="currentColor" stroke-width="0.5" stroke-linecap="round" stroke-linejoin="round">
  <rect x="0.6" y="0.6" width="134.8" height="103.8" rx="1"/>
  <rect x="27.4" y="0.6" width="81.2" height="33"/>
  <rect x="49.4" y="0.6" width="37.2" height="11"/>
  <rect x="60.4" y="0.1" width="15.2" height="2"/>
  <circle cx="68" cy="22" r="0.9" fill="currentColor" stroke="none"/>
  <path d="M50.6 33.6A18.3 18.3 0 0 0 85.4 33.6"/>
  <circle cx="68" cy="104.4" r="18.3"/>
  <path d="M0.6 6A5.4 5.4 0 0 0 6 0.6"/>
  <path d="M135.4 6A5.4 5.4 0 0 1 130 0.6"/>
</svg>`;

function newStats() {
  return {
    goals: 0, assists: 0, shots: 0, shotsOnTarget: 0,
    yellow: 0, red: 0, saves: 0, goalsAgainst: 0, minutes: 0
  };
}

export const CALCIO = {
  key: 'calcio',
  label: 'Calcio',
  short: 'Calcio',
  description: 'Undici in campo, gol e assist, classifica con i pareggi.',

  positions: ['Portiere', 'Terzino destro', 'Difensore centrale', 'Terzino sinistro',
    'Mediano', 'Centrocampista', 'Trequartista', 'Ala destra', 'Ala sinistra', 'Attaccante'],
  positionPlaceholder: 'Es. Centrocampista',

  field: { svg: FIELD_SVG, slots: SLOTS, onFieldLabel: 'Formazione', benchLabel: 'Panchina' },

  headline: [
    { key: 'goals', short: 'GL', label: 'Gol' },
    { key: 'assists', short: 'AS', label: 'Assist' },
    { key: 'minutes', short: 'MIN', label: 'Minuti' }
  ],

  aggregate: {
    goals: (p) => (p.stats || {}).goals || 0,
    assists: (p) => (p.stats || {}).assists || 0,
    shots: (p) => (p.stats || {}).shots || 0,
    shotsOnTarget: (p) => (p.stats || {}).shotsOnTarget || 0,
    yellow: (p) => (p.stats || {}).yellow || 0,
    red: (p) => (p.stats || {}).red || 0,
    saves: (p) => (p.stats || {}).saves || 0,
    minutes: (p) => (p.stats || {}).minutes || 0
  },

  seasonColumns: [
    { key: 'goals', short: 'GL', label: 'Gol', avg: 'G/P' },
    { key: 'assists', short: 'AS', label: 'Assist', avg: 'A/P' },
    { key: 'shots', short: 'TIR', label: 'Tiri' },
    { key: 'shotsOnTarget', short: 'IPS', label: 'Tiri in porta' },
    { key: 'saves', short: 'PAR', label: 'Parate' },
    { key: 'yellow', short: 'AMM', label: 'Ammonizioni' },
    { key: 'red', short: 'ESP', label: 'Espulsioni' },
    { key: 'minutes', short: 'MIN', label: 'Minuti giocati' }
  ],
  seasonLegend: 'PG = partite giocate · G/P = gol a partita · IPS = tiri nello specchio · AMM/ESP = cartellini',
  showMinutes: false,

  ratingLabel: 'Contributo',
  // Non esiste una "valutazione" ufficiale nel calcio: qui è dichiaratamente
  // una sintesi del contributo offensivo, non un voto alla prestazione.
  rating(p) {
    const s = p.stats || {};
    return (s.goals || 0) * 3 + (s.assists || 0) * 2 + (s.saves || 0) * 0.5
      - (s.yellow || 0) - (s.red || 0) * 3;
  },

  score: (s) => (s.goals || 0),
  newStats,

  // ------------------------------------------------------------------ SCOUT
  // Nel calcio gli eventi da segnare sono pochi e distanti fra loro: non serve
  // velocità, serve che a fine primo tempo si ricordi cosa è successo. Undici
  // in campo, quindi i riquadri vanno a griglia e non in fila.
  //
  // Il cronometro qui sarebbe accurato — non si ferma mai — ma resta una cosa
  // da ricordarsi di far partire, e dimenticarla produce un dato peggiore di
  // non averlo. Se servono i minuti giocati per il minutaggio giovanile,
  // bastano hasClock, direction 'up' e trackSeconds.
  scout: {
    period: {
      label: 'Tempo', short: 'T', count: 2, minutes: null,
      hasClock: false, direction: null,
      allowExtra: true, extraLabel: 'Supplementare'
    },
    ourScore: 'fromActions',
    opponentScore: 'perPeriod',
    scoreDisplay: 'sum',
    trackSeconds: false,
    teamFouls: false,
    periodPrompt: 'Quanti gol ha segnato l\u2019avversario in questo tempo?',
    groups: [
      { label: 'Attacco', actions: [
        { act: 'goal', label: 'Gol', tone: 'made', apply: { goals: 1, shots: 1, shotsOnTarget: 1 }, score: 1 },
        { act: 'assist', label: 'Assist', tone: 'neutral', apply: { assists: 1 } },
        { act: 'shot_on', label: 'Tiro in porta', tone: 'neutral', apply: { shots: 1, shotsOnTarget: 1 } },
        { act: 'shot_off', label: 'Tiro fuori', tone: 'miss', apply: { shots: 1 } }
      ]},
      { label: 'Portiere', layout: 'pair', actions: [
        { act: 'save', label: 'Parata', tone: 'made', apply: { saves: 1 } },
        { act: 'conceded', label: 'Gol subito', tone: 'warn', apply: { goalsAgainst: 1 } }
      ]},
      { label: 'Disciplina', layout: 'pair', actions: [
        { act: 'yellow', label: 'Ammonizione', tone: 'warn', apply: { yellow: 1 } },
        { act: 'red', label: 'Espulsione', tone: 'miss', apply: { red: 1 } }
      ]}
    ],
    tileStat: { key: 'goals', short: 'GL' }
  },

  match: {
    liveTracker: true,
    periodLabel: 'Tempo',
    defaultPeriods: 2,
    defaultPeriodMinutes: 45,
    scoreLabel: 'Gol',
    minOnField: 11
  },

  standings: {
    hasDraws: true,
    winLabel: 'V', drawLabel: 'N', lossLabel: 'P',
    pointsHint: '3 punti a vittoria, 1 a pareggio, 0 a sconfitta.',
    extras: [
      { key: 'gf', short: 'GF', label: 'Gol fatti', role: 'scored' },
      { key: 'gs', short: 'GS', label: 'Gol subiti', role: 'conceded' }
    ],
    pointsFor: (scored, conceded) => (scored > conceded ? 3 : (scored === conceded ? 1 : 0))
  }
};

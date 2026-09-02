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
  <rect x="0.6" y="0.6" width="88.8" height="88.8" rx="1"/>
  <path d="M0.6 30.6h88.8"/>
  <path d="M0.6 0.6h88.8" stroke-width="1.4"/>
  <path d="M0.6 100h88.8" stroke-dasharray="3 3"/>
  <path d="M6 0.6v-0" />
</svg>`;

function newStats() {
  return {
    points: 0, kills: 0, attackErrors: 0, blocks: 0,
    aces: 0, serveErrors: 0, digs: 0, receptionErrors: 0, setsPlayed: 0
  };
}

export const PALLAVOLO = {
  key: 'pallavolo',
  label: 'Pallavolo',
  short: 'Volley',
  description: 'Sei in campo per zone, set invece dei periodi, punti e muri.',

  positions: ['Palleggiatore', 'Opposto', 'Schiacciatore', 'Centrale', 'Libero'],
  positionPlaceholder: 'Es. Centrale',

  field: { svg: FIELD_SVG, slots: SLOTS, onFieldLabel: 'Sestetto', benchLabel: 'Panchina' },

  headline: [
    { key: 'points', short: 'PT', label: 'Punti' },
    { key: 'kills', short: 'AT', label: 'Attacchi vincenti' },
    { key: 'blocks', short: 'MU', label: 'Muri' }
  ],

  aggregate: {
    points: (p) => (p.stats || {}).points || 0,
    kills: (p) => (p.stats || {}).kills || 0,
    blocks: (p) => (p.stats || {}).blocks || 0,
    aces: (p) => (p.stats || {}).aces || 0,
    attackErrors: (p) => (p.stats || {}).attackErrors || 0,
    serveErrors: (p) => (p.stats || {}).serveErrors || 0,
    digs: (p) => (p.stats || {}).digs || 0,
    setsPlayed: (p) => (p.stats || {}).setsPlayed || 0
  },

  seasonColumns: [
    { key: 'points', short: 'PT', label: 'Punti', avg: 'P/S' },
    { key: 'kills', short: 'AT', label: 'Attacchi vincenti' },
    { key: 'blocks', short: 'MU', label: 'Muri' },
    { key: 'aces', short: 'ACE', label: 'Ace' },
    { key: 'digs', short: 'DIF', label: 'Difese' },
    { key: 'attackErrors', short: 'EA', label: 'Errori in attacco' },
    { key: 'serveErrors', short: 'ES', label: 'Errori al servizio' },
    { key: 'setsPlayed', short: 'SET', label: 'Set giocati' }
  ],
  seasonLegend: 'PG = partite giocate · P/S = punti a partita · EA/ES = errori in attacco e al servizio',
  showMinutes: false,

  ratingLabel: 'Efficienza',
  // Punti fatti meno errori commessi: è la lettura più diffusa negli spogliatoi.
  rating(p) {
    const s = p.stats || {};
    return (s.points || 0) - (s.attackErrors || 0) - (s.serveErrors || 0) - (s.receptionErrors || 0);
  },

  score: (s) => (s.points || 0),
  newStats,

  // ------------------------------------------------------------------ SCOUT
  // La pallavolo non ha cronometro, e il punteggio del set non si ricava dai
  // soli punti dei nostri: dentro ci sono gli errori avversari, che non si
  // assegnano a nessuno. Quindi a fine set si scrivono i due punteggi.
  scout: {
    period: {
      label: 'Set', short: 'S', count: 5, minutes: null,
      hasClock: false, direction: null,
      allowExtra: false
    },
    ourScore: 'perPeriod',
    opponentScore: 'perPeriod',
    scoreDisplay: 'setsWon',
    trackSeconds: false,
    teamFouls: false,
    periodPrompt: 'Come \u00e8 finito questo set?',
    groups: [
      { label: 'Punto fatto', actions: [
        { act: 'kill', label: 'Attacco vincente', tone: 'made', apply: { points: 1, kills: 1 } },
        { act: 'block', label: 'Muro punto', tone: 'made', apply: { points: 1, blocks: 1 } },
        { act: 'ace', label: 'Ace', tone: 'made', apply: { points: 1, aces: 1 } }
      ]},
      { label: 'Errore', actions: [
        { act: 'attack_err', label: 'In attacco', tone: 'warn', apply: { attackErrors: 1 } },
        { act: 'serve_err', label: 'Al servizio', tone: 'warn', apply: { serveErrors: 1 } },
        { act: 'recept_err', label: 'In ricezione', tone: 'warn', apply: { receptionErrors: 1 } }
      ]},
      { label: 'Difesa', actions: [
        { act: 'dig', label: 'Difesa', tone: 'neutral', apply: { digs: 1 } }
      ]}
    ],
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

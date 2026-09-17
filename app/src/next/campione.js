/* Dati di esempio per l'anteprima.
 *
 * Servono solo quando non c'è nessuna sessione: con una sessione aperta
 * l'anteprima usa i dati veri, che restano il metro di giudizio migliore.
 * Ma un'anteprima che non si apre non serve a niente, e chiedere di accedere
 * prima di poter anche solo guardare com'è fatta era una barriera messa dove
 * non serviva.
 *
 * Sono scelti per mettere il disegno in difficoltà, non per farlo bello:
 * un nome lungo il doppio degli altri, un numero a due cifre accanto a uno a
 * una, un certificato scaduto e uno mancante, una sottocategoria, una partita
 * senza orario. Un campione tutto ordinato non dimostrerebbe niente.
 */

const oggi = new Date();
const fra = (giorni) => {
  const d = new Date(oggi);
  d.setDate(d.getDate() + giorni);
  return d.toISOString().slice(0, 10);
};

const SETTORI = [
  { id: 's-u15', name: 'Under 15', sort_order: 0, parent_id: null },
  { id: 's-u15-blu', name: 'Blu', sort_order: 0, parent_id: 's-u15' },
  { id: 's-u15-bianca', name: 'Bianca', sort_order: 1, parent_id: 's-u15' },
  { id: 's-prima', name: 'Prima squadra', sort_order: 1, parent_id: null }
];

const ROSA = [
  { id: 'p1', number: '4', name: 'Lorenzo Bertolotti Massaro', birth_date: '2011-02-14', role_position: 'Playmaker', guardian_phone: '347 118 2290' },
  { id: 'p2', number: '7', name: 'Matteo Fanti', birth_date: '2011-06-30', role_position: 'Guardia', guardian_phone: '333 907 4412' },
  { id: 'p3', number: '10', name: 'Samuele Ricci', birth_date: '2010-11-02', role_position: 'Ala piccola', email: 'famiglia.ricci@example.it' },
  { id: 'p4', number: '11', name: 'Nicolò Abbagnale', birth_date: '2011-04-19', role_position: 'Ala grande', guardian_phone: '340 552 1108' },
  { id: 'p5', number: '13', name: 'Youssef El Amrani', birth_date: '2011-01-08', role_position: 'Centro', guardian_phone: '328 441 9075' },
  { id: 'p6', number: '15', name: 'Pietro Gallo', birth_date: '2011-09-21', role_position: 'Guardia' },
  { id: 'p7', number: '21', name: 'Andrea Vitiello', birth_date: '2010-12-05', role_position: 'Ala piccola', guardian_phone: '351 220 6634' },
  { id: 'p8', number: '23', name: 'Filippo Serra', birth_date: '2011-07-17', role_position: 'Playmaker', guardian_phone: '349 776 3312' }
];

// Un certificato per ciascuno, con tutti gli stati che l'interfaccia deve
// saper dire: valido, in scadenza, scaduto, in verifica, respinto, mancante.
const DOCUMENTI = {
  p1: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(210), uploaded_at: '2026-01-12T09:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p2: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(18), uploaded_at: '2025-09-30T09:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p3: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(-9), uploaded_at: '2025-06-02T09:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p4: [{ doc_type: 'certificato_medico', status: 'in_review', expires_at: fra(340), uploaded_at: fra(-2) + 'T18:20:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p5: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(150), uploaded_at: '2026-02-01T09:00:00Z' }],
  p6: [{ doc_type: 'certificato_medico', status: 'rejected', expires_at: fra(200), uploaded_at: fra(-11) + 'T10:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p7: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(95), uploaded_at: '2026-01-20T09:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }],
  p8: [{ doc_type: 'certificato_medico', status: 'approved', expires_at: fra(60), uploaded_at: '2026-01-05T09:00:00Z' },
       { doc_type: 'tesseramento_fip', status: 'approved', expires_at: fra(300), uploaded_at: '2026-01-12T09:00:00Z' }]
};

export const DOCUMENTI_CAMPIONE = DOCUMENTI;

// Le schermate devono sapere se stanno guardando dati veri o d'esempio: in
// campione non c'e' nessun server a cui chiedere i documenti.
let campione = false;
export function inCampione() { return campione; }


/* La finanza d'esempio.
 *
 * Scelta per mostrare i casi che contano, non per far tornare bei numeri: un
 * conto in rosso, una quota scaduta da un mese, una parzialmente incassata,
 * uscite distribuite su piu' mesi e su piu' categorie. Con dati tutti a posto
 * il quadro non direbbe niente di quello che sa dire.
 */
function meseFa(n) {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

export function FINANZA_CAMPIONE() {
  const conti = [
    { id: 'c1', name: 'Conto corrente', kind: 'banca' },
    { id: 'c2', name: 'Cassa contanti', kind: 'cassa' }
  ];
  const saldi = { c1: 7420, c2: -180 };

  const cat = (n) => ({ name: n });
  const stato = (previsto, pagato, scadenza) => {
    const residuo = previsto - pagato;
    let st;
    if (pagato === 0) st = (scadenza && scadenza < fra(0)) ? 'scaduto' : 'previsto';
    else if (pagato >= previsto) st = 'pagato';
    else st = 'parzialmente_pagato';
    return { paid_amount: pagato, residual_amount: residuo, status: st, planned_amount: previsto };
  };

  const entrate = [
    { id: 'e1', kind: 'income', description: 'Quote associative U15', planned_amount: 5600, accrual_date: meseFa(3), due_date: fra(-32), finance_categories: cat('Quote associative'), _status: { paid_amount: 4100, residual_amount: 1500, status: 'parzialmente_incassato' } },
    { id: 'e2', kind: 'income', description: 'Sponsor Bar Centrale', planned_amount: 1500, accrual_date: meseFa(2), due_date: fra(12), finance_categories: cat('Sponsorizzazioni'), _status: { paid_amount: 0, residual_amount: 1500, status: 'previsto' } },
    { id: 'e3', kind: 'income', description: 'Torneo di Natale', planned_amount: 800, accrual_date: meseFa(1), finance_categories: cat('Eventi'), _status: { paid_amount: 800, residual_amount: 0, status: 'incassato' } },
    { id: 'e4', kind: 'income', description: 'Quote Prima squadra', planned_amount: 3200, accrual_date: meseFa(5), finance_categories: cat('Quote associative'), _status: { paid_amount: 3200, residual_amount: 0, status: 'incassato' } }
  ];

  const uscite = [
    { id: 'u1', kind: 'expense', description: 'Affitto palestra', planned_amount: 3600, accrual_date: meseFa(4), finance_categories: cat('Impianti'), _status: { paid_amount: 3600, residual_amount: 0, status: 'pagato' } },
    { id: 'u2', kind: 'expense', description: 'Affitto palestra', planned_amount: 900, accrual_date: meseFa(0), due_date: fra(-6), finance_categories: cat('Impianti'), _status: { paid_amount: 0, residual_amount: 900, status: 'scaduto' } },
    { id: 'u3', kind: 'expense', description: 'Arbitraggi girone di andata', planned_amount: 740, accrual_date: meseFa(2), due_date: fra(4), finance_categories: cat('Arbitraggi'), _status: { paid_amount: 300, residual_amount: 440, status: 'parzialmente_pagato' } },
    { id: 'u4', kind: 'expense', description: 'Iscrizione campionato', planned_amount: 1250, accrual_date: meseFa(6), finance_categories: cat('Tesseramenti'), _status: { paid_amount: 1250, residual_amount: 0, status: 'pagato' } },
    { id: 'u5', kind: 'expense', description: 'Divise da gioco', planned_amount: 1680, accrual_date: meseFa(5), finance_categories: cat('Materiale'), _status: { paid_amount: 1680, residual_amount: 0, status: 'pagato' } },
    { id: 'u6', kind: 'expense', description: 'Assicurazione', planned_amount: 420, accrual_date: meseFa(1), due_date: fra(40), finance_categories: cat('Tesseramenti'), _status: { paid_amount: 0, residual_amount: 420, status: 'previsto' } }
  ];

  const scadenze = [...entrate, ...uscite].filter(e =>
    e.due_date && !['incassato', 'pagato', 'annullato'].includes(e._status.status));

  const esercizi = [
    { id: 'f1', name: '2026/27', start_date: fra(-70), end_date: fra(295), closed: false }
  ];

  return { conti, saldi, entrate, uscite, scadenze, esercizi };
}

export function caricaCampione(state) {
  campione = true;
  state.teamProfile = {
    id: 't-demo', name: 'Pallacanestro Aurora', city: 'Cesena',
    category: 'Under 15 Gold', sport: 'basket', invite_code: 'AUR7K2'
  };
  state.currentUser = {
    id: 'u-demo', team_id: 't-demo', display_name: 'Lorenzo Santucci',
    role: 'admin', email: 'demo@squad.app', finance_role: 'admin'
  };
  state.sectors = SETTORI;
  state.activeSectorId = 's-u15-blu';
  state.staffSectors = { 'u-demo': SETTORI.map(s => s.id) };
  state.familySectorIds = [];
  state.linkedPlayers = [];
  state.roster = ROSA.map(p => ({ ...p, player_sectors: [{ sector_id: 's-u15-blu' }] }));

  state.calendar = [
    { id: 'm0', giornata: 8, date: fra(-6), time: '18:00', opponent: 'Basket Riccione', home: false, location: 'PalaRiccione', played: false },
    { id: 'm1', giornata: 9, date: fra(3), time: '18:30', opponent: 'Virtus Forlimpopoli', home: true, location: 'Palestra Comunale', played: false },
    { id: 'm2', giornata: 10, date: fra(10), time: '17:00', opponent: 'Nuova Pallacanestro Imola', home: false, location: 'PalaRuggi', played: false },
    { id: 'm3', giornata: 11, date: fra(17), time: '', opponent: 'Bellaria Basket', home: true, location: 'Palestra Comunale', played: false },
    // Un'amichevole senza giornata: e' il caso che l'anteprima deve mostrare,
    // perche' e' quello in cui il risultato non entra nelle medie.
    { id: 'm4', giornata: null, date: fra(24), time: '18:00', opponent: 'Libertas Cesena', home: true, location: 'Palestra Comunale', played: false, friendly: true }
  ];
  // Le ultime due partite hanno il tabellino, le altre no: e' la situazione di
  // una societa' vera, dove lo scout si comincia a tenere a stagione iniziata.
  // Senza almeno un tabellino, Statistiche e il referto restano due schermate
  // che dicono «niente da mostrare», ed e' un modo pessimo di presentarsi.
  /* I tiri con la loro posizione, per far vedere la mappa.
   *
   * Sparsi in modo ripetibile invece che a caso: un'anteprima che cambia a
   * ogni ricaricamento e' un'anteprima di cui non ci si fida. `giro` e'
   * un'onda, quindi i tiri si distribuiscono sul campo come li
   * distribuirebbe una squadra vera — i lunghi sotto, le guardie da fuori.
   *
   * I punti li mettiamo dove il tiro poteva partire davvero: da due dentro
   * l'arco, da tre fuori. La mappa e' una dimostrazione, non un'invenzione. */
  const giro = (n) => (Math.sin(n * 2.3) + 1) / 2;   // sempre fra 0 e 1
  const tiriDi = (i, fgm2, fga2, fgm3, fga3) => {
    const t = [];
    const vicino = i >= 3;                 // gli ultimi della rosa sono i lunghi
    for (let k = 0; k < fga2; k++) {
      const a = giro(i * 7 + k);
      t.push({
        x: Math.round((vicino ? 38 + a * 24 : 22 + a * 56) * 10) / 10,
        y: Math.round((vicino ? 6 + a * 22 : 18 + a * 28) * 10) / 10,
        act: k < fgm2 ? 'fg2_made' : 'fg2_miss', dentro: k < fgm2, q: (k % 4) + 1
      });
    }
    for (let k = 0; k < fga3; k++) {
      const a = giro(i * 5 + k + 1);
      t.push({
        x: Math.round((6 + a * 88) * 10) / 10,
        y: Math.round((a > 0.15 && a < 0.85 ? 62 + a * 26 : 6 + a * 12) * 10) / 10,
        act: k < fgm3 ? 'fg3_made' : 'fg3_miss', dentro: k < fgm3, q: (k % 4) + 1
      });
    }
    return t;
  };

  const tabellino = (punti, extra) => ROSA.map((p, i) => ({
    id: p.id, number: p.number, name: p.name, onCourt: i < 5,
    stats: {
      fgm2: punti[i][0], fga2: punti[i][1], fgm3: punti[i][2], fga3: punti[i][3],
      ftm: punti[i][4], fta: punti[i][5],
      orb: extra[i][0], drb: extra[i][1], ast: extra[i][2], stl: extra[i][3],
      tov: extra[i][4], blk: extra[i][5], blkAgainst: 0, pf: extra[i][6], pfDrawn: 0,
      tovTypes: { generica: extra[i][4], palleggio: 0, passaggio: 0, passi: 0 },
      // Il piu'/meno lo scrive il registro dei quintetti a ogni cambio: qui
      // e' scritto a mano, come se quella partita fosse stata segnata cosi'.
      plusMinus: [6, 4, -2, 8, 1, -5, 0, 3][i] || 0, seconds: 0,
      tiri: tiriDi(i, punti[i][0], punti[i][1], punti[i][2], punti[i][3])
    }
  }));

  state.history = [
    { teamScore: 68, oppScore: 54 }, { teamScore: 61, oppScore: 70 },
    { teamScore: 75, oppScore: 59 }, { teamScore: 66, oppScore: 63 },
    { teamScore: 58, oppScore: 72 },
    {
      teamScore: 81, oppScore: 64, date: fra(-10), quarter: 4, chiusi: 4,
      periodScores: [{ us: 22, them: 15 }, { us: 19, them: 18 }, { us: 21, them: 16 }, { us: 19, them: 15 }],
      players: tabellino(
        [[7, 12, 2, 5, 2, 2], [5, 10, 1, 4, 1, 2], [4, 7, 2, 4, 0, 0], [5, 9, 0, 1, 2, 3],
         [3, 6, 1, 2, 1, 1], [2, 5, 0, 0, 2, 2], [1, 4, 1, 3, 0, 0], [1, 2, 0, 1, 1, 2]],
        [[1, 4, 5, 2, 3, 0, 2], [0, 3, 3, 1, 2, 0, 1], [2, 6, 1, 0, 1, 2, 3], [3, 7, 2, 1, 2, 1, 4],
         [1, 2, 4, 3, 1, 0, 2], [2, 5, 0, 1, 2, 1, 3], [0, 1, 1, 0, 0, 0, 1], [1, 2, 0, 0, 1, 0, 2]])
    },
    {
      teamScore: 70, oppScore: 66, date: fra(-3), quarter: 4, chiusi: 4,
      quintetti: {
        'p1|p2|p3|p4|p5': { f: 38, s: 30, turni: 6 },
        'p1|p2|p4|p6|p7': { f: 14, s: 19, turni: 3 },
        'p2|p3|p5|p6|p8': { f: 18, s: 17, turni: 4 }
      },
      periodScores: [{ us: 18, them: 14 }, { us: 16, them: 19 }, { us: 20, them: 15 }, { us: 16, them: 18 }],
      players: tabellino(
        [[6, 11, 1, 4, 3, 4], [4, 9, 2, 5, 0, 0], [4, 8, 1, 3, 0, 0], [3, 7, 1, 2, 0, 0],
         [2, 6, 1, 1, 0, 0], [3, 6, 0, 0, 0, 0], [0, 1, 1, 4, 0, 0], [1, 3, 0, 0, 0, 0]],
        [[2, 5, 6, 3, 2, 0, 3], [1, 2, 4, 1, 3, 0, 2], [3, 8, 2, 1, 2, 1, 2], [2, 6, 1, 0, 1, 2, 4],
         [0, 3, 3, 2, 1, 0, 1], [1, 4, 1, 0, 2, 1, 3], [0, 0, 2, 1, 1, 0, 0], [1, 1, 0, 0, 0, 0, 1]])
    }
  ];
  state.standings = [
    { team_name: 'Virtus Forlimpopoli', played: 8, won: 7, lost: 1, points: 14 },
    { team_name: 'Pallacanestro Aurora', played: 7, won: 5, lost: 2, points: 10 },
    { team_name: 'Nuova Pallacanestro Imola', played: 8, won: 4, lost: 4, points: 8 },
    { team_name: 'Bellaria Basket', played: 8, won: 2, lost: 6, points: 4 },
    { team_name: 'Basket Riccione', played: 7, won: 1, lost: 6, points: 2 }
  ];
  state.trainings = [
    { id: 't1', sector_id: 's-u15-blu', title: 'Tecnica individuale', date: fra(1), start_time: '19:00', end_time: '20:30', location: 'Palestra Comunale' },
    { id: 't2', sector_id: 's-u15-blu', title: 'Situazioni di gara', date: fra(4), start_time: '19:00', end_time: '20:30', location: 'Palestra Comunale' }
  ];
  state.trainingRecurrences = [];
  // Qualche notifica vera: una campanella vuota durante una dimostrazione non
  // mostra la funzione, mostra solo che c'e' un'icona.
  state.notifications = [
    { id: 'n1', type: 'training_changed', sector_id: 's-u15-blu', actor_id: 'altro',
      title: 'Situazioni di gara', body: 'Orario: 19:00 \u2192 19:30 \u00b7 Luogo: Palestra Comunale \u2192 PalaRuggi',
      link_tab: 'allenamenti', read: false, created_at: new Date(oggi.getTime() - 2 * 3600000).toISOString() },
    { id: 'n2', type: 'document_uploaded', sector_id: 's-u15-blu', actor_id: 'altro',
      title: 'Certificato medico di Giulia Baroncini', body: 'Caricato dalla famiglia, in attesa di verifica',
      link_tab: 'anagrafica', read: false, created_at: new Date(oggi.getTime() - 6 * 3600000).toISOString() },
    { id: 'n3', type: 'comunicazione', sector_id: 's-u15-blu', actor_id: 'altro',
      title: 'Trasferta di domenica: ritrovo alle 14:00', body: 'Richiede conferma entro il 20/09',
      link_tab: 'comunicazioni', read: true, created_at: new Date(oggi.getTime() - 26 * 3600000).toISOString() },
    { id: 'n4', type: 'training_created', sector_id: 's-u15-blu', actor_id: 'altro',
      title: 'Tecnica individuale', body: 'domani \u00b7 ore 19:00 \u00b7 Palestra Comunale',
      link_tab: 'allenamenti', read: true, created_at: new Date(oggi.getTime() - 50 * 3600000).toISOString() }
  ];
  state.pendingDocsCount = 1;
  state.expiringDocsCount = 2;
  state.financeAccounts = [];
  state.financeAccountBalances = {};
  state.myAvatarUrl = null;
}

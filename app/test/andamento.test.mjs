import { describe, test, is, ok } from './run.mjs';
import { BASKET } from '../src/utils/sports/basket.js';
import {
  azioneDi, tiroSquadra, contatoriSquadra, statistichePerPeriodo, andamentoPartita
} from '../src/utils/referto.js';

/* IL REGISTRO DELLE AZIONI, E COSA CI SI LEGGE.
 *
 * I totali dicono quanto; il registro dice quando. Da lì escono le tre cose
 * che dai totali non si ricavano: le statistiche quarto per quarto, il massimo
 * vantaggio, e il parziale più lungo.
 *
 * Il parziale è la cosa più facile da sbagliare: si contano i PUNTI di fila,
 * non le azioni. Sette punti con due triple e un libero sono un 7-0, non un
 * 3-0 — e un referto che dicesse 3-0 racconterebbe un'altra partita.
 */

const noi = (act, q) => ({ q: q || 1, a: act, p: 'x' });
const loro = (n, q) => ({ q: q || 1, a: 'loro', n: n });

const partita = (storia) => ({
  oppName: 'Amichevole', quarter: 4, chiusi: 4, teamScore: 0, oppScore: 0,
  periodScores: [], players: [], storia: storia
});

describe('l azione si ritrova nella configurazione', () => {
  test('quelle dei gruppi', () => {
    ok(azioneDi(BASKET, 'fg3_made'));
    is(azioneDi(BASKET, 'fg3_made').apply.fgm3, 1);
  });

  test('e anche quelle che stanno dentro una catena', () => {
    ok(azioneDi(BASKET, 'ast'));
  });

  test('un nome che non esiste non inventa niente', () => {
    is(azioneDi(BASKET, 'canestro_da_quattro'), null);
  });
});

describe('come abbiamo tirato', () => {
  const s = Object.assign(BASKET.newStats(), {
    fgm2: 9, fga2: 20, fgm3: 4, fga3: 10, ftm: 7, fta: 10
  });
  const t = tiroSquadra(s);

  test('da due, da tre e ai liberi', () => {
    is(t.due.pct, 45);
    is(t.tre.pct, 40);
    is(t.liberi.pct, 70);
  });

  test('«dal campo» somma due e tre, e lascia fuori i liberi', () => {
    is(t.campo.v, 13);
    is(t.campo.t, 30);
    is(t.campo.pct, 43);
  });

  test('senza nessun tiro non c e niente da dire', () => {
    is(tiroSquadra(BASKET.newStats()), null);
  });

  test('una categoria senza tentativi resta senza percentuale, non a zero', () => {
    const senzaTre = tiroSquadra(Object.assign(BASKET.newStats(), { fgm2: 2, fga2: 4 }));
    is(senzaTre.tre.pct, null);
  });
});

describe('i contatori', () => {
  const c = contatoriSquadra(Object.assign(BASKET.newStats(), {
    orb: 6, drb: 21, ast: 11, tov: 14, stl: 5, blk: 3, pf: 17
  }));

  test('i rimbalzi si sommano e restano anche divisi', () => {
    is(c.rimbalzi, 27);
    is(c.offensivi, 6);
    is(c.difensivi, 21);
  });

  test('e le cinque voci della riga', () => {
    is(c.assist, 11);
    is(c.perse, 14);
    is(c.rubate, 5);
    is(c.stoppate, 3);
    is(c.falli, 17);
  });
});

describe('quarto per quarto', () => {
  const g = partita([
    noi('fg2_made', 1), noi('fg2_miss', 1), noi('drb', 1),
    noi('fg3_made', 2), noi('fg3_miss', 2), noi('fg3_miss', 2),
    noi('ft_made', 3), noi('ft_made', 3),
    noi('fg2_made', 4), noi('fg2_made', 4), noi('orb', 4)
  ]);
  const per = statistichePerPeriodo(g, BASKET);

  test('c e un contatore per ogni quarto giocato', () => {
    is(per.length, 4);
  });

  test('il primo quarto ha i suoi tiri e non quelli degli altri', () => {
    is(per[0].fga2, 2);
    is(per[0].fgm2, 1);
    is(per[0].fga3, 0);
  });

  test('il secondo e stato tutto da tre', () => {
    is(per[1].fga3, 3);
    is(per[1].fgm3, 1);
    is(tiroSquadra(per[1]).tre.pct, 33);
  });

  test('e nel terzo solo liberi', () => {
    is(per[2].fta, 2);
    is(tiroSquadra(per[2]).campo.t, 0);
  });

  test('anche i rimbalzi finiscono nel quarto giusto', () => {
    is(per[0].drb, 1);
    is(per[3].orb, 1);
  });

  test('una partita senza registro non produce quarti inventati', () => {
    is(statistichePerPeriodo(partita([]), BASKET), null);
    is(statistichePerPeriodo({ players: [] }, BASKET), null);
  });
});

describe('l andamento: vantaggio e parziali', () => {
  /* 0-0 → noi 3 (3-0) → loro 2 (3-2) → noi 2 (5-2) → noi 2 (7-2)
     → loro 2,2,3 (7-9) → noi 1,1 (9-9) → noi 3 (12-9) */
  const g = partita([
    noi('fg3_made', 1),
    loro(2, 1),
    noi('fg2_made', 1), noi('fg2_made', 1),
    loro(2, 2), loro(2, 2), loro(3, 2),
    noi('ft_made', 3), noi('ft_made', 3),
    noi('fg3_made', 4)
  ]);
  const a = andamentoPartita(g, BASKET);

  test('il punteggio ricostruito e quello vero', () => {
    is(a.ricostruito.us, 12);
    is(a.ricostruito.them, 9);
  });

  test('il massimo vantaggio e cinque, non tre', () => {
    // Sul 7-2 eravamo avanti di cinque: e' il momento migliore, e nei totali
    // di fine partita (12-9, +3) non si vede.
    is(a.maxVantaggio, 5);
  });

  test('e il massimo svantaggio e due', () => {
    is(a.maxSvantaggio, 2);
  });

  /* IL TEST CHE CONTA. Il nostro parziale migliore e' 5-0 (due canestri da
   * due sul 3-2), non 2: si contano i punti di fila, non le azioni. */
  test('il parziale si conta in punti, non in azioni', () => {
    is(a.parzialeNostro, 5);
  });

  test('e quello subito e sette: tre azioni di fila', () => {
    is(a.parzialeLoro, 7);
  });

  test('la serie parte da zero a zero e cresce di un passo per canestro', () => {
    is(a.serie[0].us, 0);
    is(a.serie[0].them, 0);
    is(a.serie[a.serie.length - 1].us, 12);
  });

  test('senza registro non c e nessun andamento', () => {
    is(andamentoPartita(partita([]), BASKET), null);
  });
});

describe('le correzioni fatte a mano finiscono nel conto', () => {
  test('i punti aggiunti a mano contano come gli altri', () => {
    const a = andamentoPartita(partita([
      { q: 1, a: 'noi', n: 2 }, loro(3, 1)
    ]), BASKET);
    is(a.ricostruito.us, 2);
    is(a.ricostruito.them, 3);
  });

  /* La chiusura del periodo ricopia il punteggio avversario dal tabellone e
   * annota la DIFFERENZA: senza, il massimo vantaggio verrebbe calcolato su un
   * punteggio mai esistito. */
  test('la correzione di fine periodo si annota come differenza', () => {
    const a = andamentoPartita(partita([
      loro(2, 1), loro(2, 1),
      { q: 1, a: 'loro', n: 5 }     // dal tabellone erano 9, non 4
    ]), BASKET);
    is(a.ricostruito.them, 9);
  });

  test('e una correzione al ribasso toglie davvero', () => {
    const a = andamentoPartita(partita([
      loro(3, 1), { q: 1, a: 'loro', n: -1 }
    ]), BASKET);
    is(a.ricostruito.them, 2);
  });
});

describe('un azione sconosciuta non rompe il referto', () => {
  /* I trigger e la configurazione si aggiornano per conto loro: una partita
   * archiviata puo' contenere un'azione che oggi non esiste piu'. Si salta,
   * non si esplode. */
  test('si salta e il resto torna', () => {
    const a = andamentoPartita(partita([
      noi('fg2_made', 1), { q: 1, a: 'azione_sparita', p: 'x' }, noi('fg2_made', 1)
    ]), BASKET);
    is(a.ricostruito.us, 4);
  });

  test('e nei quarti non conta niente', () => {
    const per = statistichePerPeriodo(partita([
      { q: 1, a: 'azione_sparita', p: 'x' }, noi('fg2_made', 1)
    ]), BASKET);
    is(per[0].fga2, 1);
  });
});

/* ------------------------------------------- le azioni che non ci sono più */
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

/* Il registro è la cronaca di una partita, e una cronaca si rilegge anni dopo.
 * Quando «positivo» e «negativo» in attacco sono diventati un «difeso» solo,
 * le righe già scritte con il vecchio nome hanno smesso di trovare
 * corrispondenza — e i loro numeri sono spariti dalle statistiche set per set,
 * in silenzio, con i primi set che uscivano vuoti. */
describe('una partita segnata prima che un azione fosse ritirata', () => {
  const vecchia = {
    oppName: 'Liotri', status: 'finished', quarter: 3, chiusi: 3,
    periodScores: [{ us: 25, them: 20 }, { us: 20, them: 25 }, { us: 25, them: 18 }],
    players: [],
    storia: [
      { q: 1, a: 'kill', p: 'x' }, { q: 1, a: 'attack_pos', p: 'x' },
      { q: 1, a: 'attack_neg', p: 'x' }, { q: 1, a: 'attack_err', p: 'x' },
      { q: 2, a: 'attack_pos', p: 'x' },
      { q: 3, a: 'attack_dug', p: 'x' }
    ]
  };

  test('le azioni ritirate si ritrovano lo stesso', () => {
    ok(azioneDi(PALLAVOLO, 'attack_pos'));
    ok(azioneDi(PALLAVOLO, 'attack_neg'));
  });

  test('ma non sono pulsanti: dal pannello sono sparite', () => {
    const azioni = PALLAVOLO.scout.groups.find(g => g.label === 'Attacco').actions;
    is(azioni.some(a => a.act === 'attack_pos'), false);
  });

  /* IL SINTOMO SEGNALATO: i primi set vuoti nelle grafiche a cerchio. */
  test('il primo set ha i suoi quattro attacchi, non zero', () => {
    const per = statistichePerPeriodo(vecchia, PALLAVOLO);
    is(per[0].attacks, 4);
    is(per[0].kills, 1);
    is(per[0].attackErrors, 1);
  });

  test('e anche il secondo, che ne aveva uno solo', () => {
    is(statistichePerPeriodo(vecchia, PALLAVOLO)[1].attacks, 1);
  });

  test('il terzo, segnato col nome nuovo, continua a tornare', () => {
    is(statistichePerPeriodo(vecchia, PALLAVOLO)[2].attacks, 1);
  });

  test('i tre esiti si leggono uguali, vecchi e nuovi insieme', () => {
    const tutti = statistichePerPeriodo(vecchia, PALLAVOLO)
      .reduce((n, p) => n + (p.attacks || 0), 0);
    is(tutti, 6);
  });
});

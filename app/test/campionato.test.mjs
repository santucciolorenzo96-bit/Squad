import { describe, test, is, ok, eq } from './run.mjs';
import {
  soloRegolare, giocate, siCalcola, nostraPartita, rigaDiCalendario,
  perGiornata, giornataInCorso
} from '../src/utils/campionato.js';
import { computeStandings } from '../src/utils/standingsCalc.js';
import { BASKET } from '../src/utils/sports/basket.js';

/* I RISULTATI DEL CAMPIONATO, E LA CLASSIFICA CHE NE VIENE.
 *
 * La classifica calcolata esisteva da sempre, ma nella interfaccia nuova non
 * c'era nessun posto da cui inserire un risultato: l'unica usabile era quella
 * digitata a mano, che va riscritta ogni domenica e quindi non si aggiorna.
 */

const NOI = 'Cestistica Etnea';
const p = (patch) => ({
  giornata: 1, phase: 'regular', date: '2026-10-12',
  home_team: 'Cestistica Etnea', away_team: 'Basket Point',
  home_score: 70, away_score: 60, ...patch
});

describe('quali partite fanno classifica', () => {
  test('solo la stagione regolare: i playoff sono un altro tabellone', () => {
    const tutte = [p({}), p({ phase: 'playoff' })];
    is(soloRegolare(tutte).length, 1);
  });

  test('senza `phase` si intende regolare: le righe vecchie contano', () => {
    is(soloRegolare([{ home_team: 'A', away_team: 'B' }]).length, 1);
  });

  test('giocata vuol dire TUTTI E DUE i punteggi', () => {
    // Con uno solo non si sa chi ha vinto, e mezza riga non deve muovere una
    // classifica.
    is(giocate([p({ away_score: null })]).length, 0);
    is(giocate([p({ home_score: null, away_score: null })]).length, 0);
    is(giocate([p({})]).length, 1);
  });
});

describe('quale classifica vale, calcolata o digitata', () => {
  /* Non è una preferenza da chiedere: lo dicono i dati. Così chi aveva già
   * scritto la sua tabella non la perde, e chi inserisce il primo risultato
   * non deve anche ricordarsi di cambiare un interruttore. */
  test('nessun risultato: resta quella digitata', () => {
    is(siCalcola([]), false);
    is(siCalcola([p({ home_score: null, away_score: null })]), false);
  });

  test('un risultato giocato: si calcola', () => {
    is(siCalcola([p({})]), true);
  });

  test('un risultato solo nei playoff non basta', () => {
    // Una classifica di girone fatta con una partita di playoff non esiste in
    // nessun documento della federazione.
    is(siCalcola([p({ phase: 'playoff' })]), false);
  });

  test('senza niente non si lancia', () => {
    is(siCalcola(null), false);
    is(siCalcola(undefined), false);
  });
});

describe('la partita è nostra?', () => {
  test('in casa: avversario e punteggi dal nostro punto di vista', () => {
    const n = nostraPartita(p({}), NOI);
    is(n.inCasa, true);
    is(n.avversario, 'Basket Point');
    is(n.nostriPunti, 70);
    is(n.loroPunti, 60);
  });

  test('in trasferta: i punteggi si girano', () => {
    const n = nostraPartita(p({ home_team: 'Basket Point', away_team: 'Cestistica Etnea' }), NOI);
    is(n.inCasa, false);
    is(n.avversario, 'Basket Point');
    is(n.nostriPunti, 60);
    is(n.loroPunti, 70);
  });

  test('di altre due squadre: null', () => {
    is(nostraPartita(p({ home_team: 'Virtus Ragalna', away_team: 'Basket Point' }), NOI), null);
  });

  test('IL CONFRONTO È ESATTO, non «contiene»', () => {
    /* Con «contiene», una società che si chiama «Basket» riconoscerebbe come
     * propria ogni partita del girone, e si porterebbe in calendario i
     * risultati di tutti. */
    is(nostraPartita(p({ home_team: 'Basket Point', away_team: 'Basket Club' }), 'Basket'), null);
    ok(nostraPartita(p({ home_team: 'Basket', away_team: 'Basket Club' }), 'Basket'));
  });

  test('maiuscole e spazi non contano', () => {
    ok(nostraPartita(p({ home_team: '  CESTISTICA ETNEA ' }), NOI));
  });

  test('senza nome della società non si riconosce niente', () => {
    is(nostraPartita(p({}), ''), null);
    is(nostraPartita(p({}), null), null);
  });
});

describe('la riga di calendario che corrisponde a un risultato', () => {
  const calendario = [
    { id: 'c1', giornata: 1, date: '2026-10-12', opponent: 'Basket Point' },
    { id: 'c2', giornata: 2, date: '2026-10-19', opponent: 'Virtus Ragalna' },
    { id: 'c3', giornata: null, date: '2026-11-02', opponent: 'Basket Point' }
  ];

  test('per giornata e avversario', () => {
    is(rigaDiCalendario(calendario, p({ giornata: 1 }), NOI).id, 'c1');
  });

  test('o per data e avversario, quando la giornata non combacia', () => {
    // Un calendario caricato da un PDF può avere la giornata e non la data —
    // una partita rinviata — o la data e non la giornata.
    is(rigaDiCalendario(calendario, p({ giornata: 9, date: '2026-11-02' }), NOI).id, 'c3');
  });

  test('una partita di altre due squadre non tocca nessuna riga', () => {
    is(rigaDiCalendario(calendario, p({ home_team: 'A', away_team: 'B' }), NOI), null);
  });

  test('SENZA PUNTEGGI NON SI TOCCA NIENTE', () => {
    /* Un accoppiamento inserito in anticipo non deve dichiarare giocata una
     * partita che non si è giocata. */
    is(rigaDiCalendario(calendario, p({ home_score: null, away_score: null }), NOI), null);
    is(rigaDiCalendario(calendario, p({ away_score: null }), NOI), null);
  });

  test('e se in calendario quella partita non c’è, null e non un errore', () => {
    is(rigaDiCalendario(calendario, p({ away_team: 'Sconosciuta', giornata: 7, date: '2027-01-01' }), NOI), null);
    is(rigaDiCalendario(null, p({}), NOI), null);
  });
});

describe('come si raggruppano per giornata', () => {
  const partite = [
    p({ giornata: 1 }), p({ giornata: 3 }), p({ giornata: 3, away_team: 'X' }),
    p({ giornata: null })
  ];
  const gruppi = perGiornata(partite);

  test('dalla più recente: è quella che si sta inserendo', () => {
    is(gruppi[0].giornata, 3);
    is(gruppi[0].partite.length, 2);
    is(gruppi[1].giornata, 1);
  });

  test('quelle senza giornata stanno in fondo, ma CI STANNO', () => {
    // Una riga che non si vede è una riga che si inserisce due volte.
    const ultimo = gruppi[gruppi.length - 1];
    is(ultimo.giornata, null);
    is(ultimo.partite.length, 1);
  });

  test('niente partite, nessun gruppo', () => {
    eq(perGiornata([]), []);
    eq(perGiornata(null), []);
  });
});

describe('su quale giornata si sta lavorando', () => {
  test('la più alta vista finora', () => {
    is(giornataInCorso([p({ giornata: 2 }), p({ giornata: 7 }), p({ giornata: 5 })]), 7);
  });

  test('senza risultati si parte dalla prima', () => {
    is(giornataInCorso([]), 1);
    is(giornataInCorso(null), 1);
    is(giornataInCorso([p({ giornata: null })]), 1);
  });
});

describe('dai risultati alla classifica, per davvero', () => {
  /* Il conto lo fa `computeStandings`, che esisteva già. Qui si prova che le
   * due cose combaciano: le regole punti del basket sono due a vittoria. */
  const partite = [
    p({ giornata: 1, home_team: 'Cestistica Etnea', away_team: 'Basket Point', home_score: 70, away_score: 60 }),
    p({ giornata: 1, home_team: 'Virtus Ragalna', away_team: 'Azzurra Belpasso', home_score: 55, away_score: 80 }),
    p({ giornata: 2, home_team: 'Azzurra Belpasso', away_team: 'Cestistica Etnea', home_score: 61, away_score: 75 })
  ];
  const tabella = computeStandings(soloRegolare(partite), BASKET, NOI);

  test('quattro squadre, e noi riconosciuti', () => {
    is(tabella.length, 4);
    is(tabella.filter(r => r.is_us).length, 1);
  });

  test('due vittorie fanno quattro punti e la prima posizione', () => {
    is(tabella[0].team_name, 'Cestistica Etnea');
    is(tabella[0].points, 4);
    is(tabella[0].wins, 2);
    is(tabella[0].played, 2);
  });

  test('i punti fatti e subiti si sommano dai due lati', () => {
    is(tabella[0].stats.pf, 70 + 75);
    is(tabella[0].stats.ps, 60 + 61);
  });

  test('una partita senza punteggio non conta per nessuno', () => {
    const conVuota = [...partite, p({ giornata: 3, home_team: 'Basket Point', away_team: 'Virtus Ragalna', home_score: null, away_score: null })];
    const t2 = computeStandings(soloRegolare(conVuota), BASKET, NOI);
    is(t2.find(r => r.team_name === 'Basket Point').played, 1);
  });
});

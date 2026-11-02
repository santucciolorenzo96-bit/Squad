import { describe, test, is, ok, eq } from './run.mjs';
import {
  partiteGiocate, rigaDelTabellino, comeRigaDiCalendario, comeTabellini
} from '../src/utils/giocate.js';
import { CASA, TRASFERTA, IGNOTO } from '../src/utils/dove.js';

/* LE PARTITE GIOCATE, UNA VOLTA SOLA.
 *
 * «Calendario → Giocate» e «Classifica → Storico» erano due elenchi diversi
 * della stessa cosa, e non concordavano. Una partita giocata è UN evento con
 * al massimo due corpi: il risultato, che c'è sempre, e il tabellino, che c'è
 * solo se qualcuno l'ha seguita.
 */

const riga = (patch) => ({
  id: 'c1', opponent: 'Basket Point', date: '2026-11-15', giornata: 1,
  home: true, played: true, team_score: 70, opp_score: 60, friendly: false, ...patch
});

const tab = (patch) => ({
  id: 'g1', oppName: 'Basket Point', date: '2026-11-15T20:00:00Z',
  teamScore: 70, oppScore: 60, friendly: false, calendarMatchId: null, ...patch
});

describe('una partita con tutte e due le cose è UNA partita', () => {
  const lista = partiteGiocate([riga({})], [tab({ calendarMatchId: 'c1' })]);

  test('non due', () => is(lista.length, 1));

  test('e porta il tabellino, per aprire il referto', () => {
    ok(lista[0].tabellino, 'manca il tabellino');
    ok(lista[0].rigaCalendario, 'manca la riga di calendario');
  });

  test('con la giornata e il dove, che solo il calendario sa', () => {
    is(lista[0].giornata, 1);
    is(lista[0].dove, CASA);
  });
});

describe('come si riconosce che sono la stessa partita', () => {
  test('per legame, quando il tabellino è stato aperto da quella riga', () => {
    is(rigaDelTabellino([riga({})], tab({ calendarMatchId: 'c1' })).id, 'c1');
  });

  test('e per avversario e data, per i tabellini più vecchi', () => {
    // Il legame non c'era sempre: senza questa seconda via quelle partite
    // comparirebbero due volte.
    is(rigaDelTabellino([riga({})], tab({})).id, 'c1');
  });

  test('un avversario diverso non si lega', () => {
    is(rigaDelTabellino([riga({})], tab({ oppName: 'Altra Squadra' })), null);
  });

  test('una data diversa non si lega', () => {
    is(rigaDelTabellino([riga({})], tab({ date: '2026-12-01T20:00:00Z' })), null);
  });

  test('senza calendario, o senza tabellino, null', () => {
    is(rigaDelTabellino([], tab({})), null);
    is(rigaDelTabellino([riga({})], null), null);
  });
});

describe('le partite che prima si vedevano solo da una parte', () => {
  test('SCOUTATA SENZA RIGA DI CALENDARIO: adesso c’è', () => {
    /* Si apre lo scout, si scrive il nome dell'avversario e si gioca: in
     * «Giocate» non compariva, perché là c'erano solo le righe di calendario. */
    const lista = partiteGiocate([], [tab({})]);
    is(lista.length, 1);
    is(lista[0].rigaCalendario, null);
    is(lista[0].avversario, 'Basket Point');
  });

  test('e non sa dove si è giocata, invece di dire «in casa»', () => {
    // `games` non ha quel campo: resta «da definire».
    is(partiteGiocate([], [tab({})])[0].dove, IGNOTO);
  });

  test('PUNTEGGIO SCRITTO A MANO SENZA SCOUT: adesso c’è anche nello storico', () => {
    const lista = partiteGiocate([riga({})], []);
    is(lista.length, 1);
    is(lista[0].tabellino, null);
    is(lista[0].nostriPunti, 70);
  });

  test('una partita da giocare non è giocata', () => {
    is(partiteGiocate([riga({ played: false, team_score: null, opp_score: null })], []).length, 0);
  });

  test('ma una riga senza risultato CON un tabellino lo è', () => {
    // Capita se la scrittura del risultato in calendario non è riuscita: la
    // partita è stata giocata e il tabellino c'è.
    const lista = partiteGiocate(
      [riga({ played: false, team_score: null, opp_score: null })],
      [tab({ calendarMatchId: 'c1' })]
    );
    is(lista.length, 1);
    is(lista[0].nostriPunti, 70);
  });
});

describe('quando i due punteggi non coincidono', () => {
  /* Vince il tabellino — è il risultato segnato azione per azione — e la
   * discordanza NON si nasconde: l'altro numero esiste ancora da qualche
   * parte, e prima o poi qualcuno lo trova. */
  const lista = partiteGiocate(
    [riga({ team_score: 71, opp_score: 60 })],
    [tab({ calendarMatchId: 'c1', teamScore: 70, oppScore: 60 })]
  );

  test('vince il tabellino', () => {
    is(lista[0].nostriPunti, 70);
  });

  test('e si dice che l’altro numero è diverso', () => {
    is(lista[0].discorde, true);
    eq(lista[0].puntiCalendario, { us: 71, them: 60 });
  });

  test('se coincidono non c’è niente da dire', () => {
    const uguali = partiteGiocate([riga({})], [tab({ calendarMatchId: 'c1' })]);
    is(uguali[0].discorde, false);
  });

  test('e senza tabellino non c’è discordanza possibile', () => {
    is(partiteGiocate([riga({})], [])[0].discorde, false);
  });
});

describe('l’ordine e i casi limite', () => {
  test('dalla più recente', () => {
    const lista = partiteGiocate([
      riga({ id: 'c1', date: '2026-11-15' }),
      riga({ id: 'c2', date: '2026-12-20', opponent: 'Kalkis' }),
      riga({ id: 'c3', date: '2026-10-01', opponent: 'Aretusa' })
    ], []);
    eq(lista.map(x => x.data), ['2026-12-20', '2026-11-15', '2026-10-01']);
  });

  test('un’amichevole si riconosce da una delle due parti', () => {
    is(partiteGiocate([riga({ friendly: true })], [])[0].amichevole, true);
    is(partiteGiocate([], [tab({ friendly: true })])[0].amichevole, true);
  });

  test('senza niente, elenco vuoto e nessun errore', () => {
    eq(partiteGiocate([], []), []);
    eq(partiteGiocate(null, null), []);
    eq(partiteGiocate(undefined, undefined), []);
  });

  test('righe vuote nell’elenco non fanno cadere tutto', () => {
    is(partiteGiocate([null, riga({}), undefined], [null, tab({ calendarMatchId: 'c1' })]).length, 1);
  });

  test('ogni voce ha una chiave diversa, per il disegno', () => {
    const lista = partiteGiocate([riga({})], [tab({ id: 'g9', oppName: 'Altra', date: '2026-10-01' })]);
    is(lista.length, 2);
    ok(lista[0].chiave !== lista[1].chiave, 'due chiavi uguali');
  });
});

describe('in trasferta, e dove non si sa', () => {
  test('la trasferta viene dal calendario', () => {
    is(partiteGiocate([riga({ home: false })], [])[0].dove, TRASFERTA);
  });

  test('e un campo non dichiarato resta non dichiarato', () => {
    is(partiteGiocate([riga({ home: null })], [])[0].dove, IGNOTO);
  });
});

describe('una voce nella forma di una riga di calendario', () => {
  test('con una riga vera dietro è quella riga, più la voce', () => {
    const [v] = partiteGiocate([riga({})], [tab({ calendarMatchId: 'c1' })]);
    const r = comeRigaDiCalendario(v);
    is(r.id, 'c1');
    is(r.soloTabellino, false);
    ok(r.voce.tabellino, 'la voce non porta il tabellino');
  });

  test('senza riga, il tabellino prende quella forma', () => {
    const [v] = partiteGiocate([], [tab({})]);
    const r = comeRigaDiCalendario(v);
    is(r.opponent, 'Basket Point');
    is(r.played, true);
    is(r.team_score, 70);
    is(r.soloTabellino, true);
  });

  test('e il campo resta non dichiarato, non «in casa»', () => {
    const [v] = partiteGiocate([], [tab({})]);
    is(comeRigaDiCalendario(v).home, null);
  });

  test('senza voce, null', () => {
    is(comeRigaDiCalendario(null), null);
  });
});

describe('le voci nella forma dei conti di stagione', () => {
  const voci = partiteGiocate([
    riga({ id: 'c1', date: '2026-11-15', team_score: 70, opp_score: 60 }),
    riga({ id: 'c2', date: '2026-12-20', opponent: 'Kalkis', team_score: 55, opp_score: 61 }),
    riga({ id: 'c3', date: '2026-10-01', opponent: 'Aretusa', team_score: 80, opp_score: 50, friendly: true })
  ], []);

  test('in ordine CRONOLOGICO crescente, non dalla più recente', () => {
    /* `computeStreak` conta la serie partendo dal fondo: con l'ordine
     * rovesciato darebbe la serie più vecchia invece di quella in corso. */
    const t = comeTabellini(voci);
    eq(t.map(x => x.date), ['2026-10-01', '2026-11-15', '2026-12-20']);
  });

  test('coi campi che i conti si aspettano', () => {
    const t = comeTabellini(voci);
    is(t[1].teamScore, 70);
    is(t[1].oppScore, 60);
    is(t[0].friendly, true);
  });

  test('SENZA le partite senza punteggio', () => {
    // «null contro null» passerebbe per un pareggio, e il record conterebbe
    // pareggi che nessuno ha giocato.
    const conVuota = partiteGiocate([
      riga({}),
      riga({ id: 'c9', opponent: 'X', date: '2026-12-01', team_score: null, opp_score: null, played: true })
    ], []);
    is(conVuota.length, 2);
    is(comeTabellini(conVuota).length, 1);
  });

  test('senza niente, elenco vuoto', () => {
    eq(comeTabellini([]), []);
    eq(comeTabellini(null), []);
  });
});

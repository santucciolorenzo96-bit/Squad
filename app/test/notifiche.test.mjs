import { describe, test, is, ok } from './run.mjs';
import { TIPI, quando, descriviNotifica, daLeggere, raggruppaPerGiorno } from '../src/utils/notifiche.js';
import { TABS } from '../src/utils/permissions.js';

// Le notifiche le scrive il database, e l'app le legge e basta. Quindi i test
// guardano due cose: che una riga qualunque diventi una riga leggibile, e che
// una riga di un tipo che ancora non esiste non rompa niente — perché il
// database si aggiorna per conto suo, e un tipo nuovo può arrivare prima
// dell'app che lo conosce.

const ADESSO = new Date('2026-09-16T20:00:00Z').getTime();
const fa = (minuti) => new Date(ADESSO - minuti * 60000).toISOString();

const SETTORI = [
  { id: 's1', name: 'Under 15 Blu' },
  { id: 's2', name: 'Prima Squadra' }
];

function riga(extra) {
  return Object.assign({
    id: 'n1', type: 'training_changed', sector_id: 's1',
    title: 'Situazioni di gara', body: 'Orario: 19:00 → 19:30',
    actor_id: 'mario', link_tab: 'allenamenti', read: false,
    created_at: fa(30)
  }, extra);
}

describe('le notifiche: da dove vengono', () => {
  // Se un giorno una sezione viene rinominata, questo test cade prima che
  // qualcuno tocchi una notifica e finisca su una schermata che non esiste.
  test('ogni tipo conosciuto punta a una sezione che esiste davvero', () => {
    Object.entries(TIPI).forEach(([tipo, t]) => {
      ok(TABS.some(x => x.id === t.sezione), `${tipo} punta a «${t.sezione}», che non è una sezione`);
    });
  });

  test('un tipo mai visto non rompe la riga: usa la sua destinazione', () => {
    const d = descriviNotifica(riga({ type: 'quello_di_domani', link_tab: 'finanza' }), SETTORI, ADESSO);
    is(d.sezione, 'finanza');
    is(d.azione, 'Aggiornamento');
  });

  test('un tipo mai visto e senza destinazione finisce sulla Home, non nel vuoto', () => {
    const d = descriviNotifica(riga({ type: 'ignoto', link_tab: null }), SETTORI, ADESSO);
    is(d.sezione, 'home');
    is(d.destinazione, 'home');
  });

  test('la destinazione scritta dal database vince sulla sezione del tipo', () => {
    // Un documento verificato nasce in anagrafica ma può essere mandato
    // altrove: chi scrive la notifica ne sa più di questa tabella.
    const d = descriviNotifica(riga({ type: 'document_reviewed', link_tab: 'profilo' }), SETTORI, ADESSO);
    is(d.sezione, 'anagrafica');
    is(d.destinazione, 'profilo');
  });
});

describe('le notifiche: che cosa dicono', () => {
  test('portano il nome della categoria, non il suo codice', () => {
    is(descriviNotifica(riga(), SETTORI, ADESSO).settore, 'Under 15 Blu');
  });

  test('una categoria sconosciuta non stampa «undefined»', () => {
    is(descriviNotifica(riga({ sector_id: 's9' }), SETTORI, ADESSO).settore, '');
  });

  test('senza titolo resta la parola del tipo, non una riga vuota', () => {
    is(descriviNotifica(riga({ title: null }), SETTORI, ADESSO).titolo, 'Allenamento spostato');
  });

  test('«per te» solo quando ha davvero un destinatario', () => {
    is(descriviNotifica(riga(), SETTORI, ADESSO).personale, false);
    is(descriviNotifica(riga({ profile_id: 'p1' }), SETTORI, ADESSO).personale, true);
  });
});

describe('le notifiche: quanto tempo fa', () => {
  test('sotto il minuto è adesso', () => is(quando(fa(0.5), ADESSO), 'adesso'));
  test('i minuti', () => is(quando(fa(25), ADESSO), '25 min fa'));
  test('un’ora sola si dice al singolare', () => is(quando(fa(70), ADESSO), "un'ora fa"));
  test('le ore', () => is(quando(fa(60 * 5), ADESSO), '5 ore fa'));
  test('ieri', () => is(quando(fa(60 * 30), ADESSO), 'ieri'));
  test('i giorni', () => is(quando(fa(60 * 24 * 3), ADESSO), '3 giorni fa'));
  test('oltre la settimana si scrive la data', () => {
    ok(/\d/.test(quando(fa(60 * 24 * 20), ADESSO)));
  });
  test('una data storta non produce «Invalid Date»', () => {
    is(quando('non è una data', ADESSO), '');
    is(quando(null, ADESSO), '');
  });
});

describe('le notifiche: quante da leggere', () => {
  test('le proprie non si contano', () => {
    const elenco = [
      riga({ id: 'a', actor_id: 'io', read: false }),
      riga({ id: 'b', actor_id: 'altri', read: false }),
      riga({ id: 'c', actor_id: 'altri', read: true })
    ];
    is(daLeggere(elenco, 'io'), 1);
  });

  test('senza elenco non esplode', () => {
    is(daLeggere(null, 'io'), 0);
    is(daLeggere([], 'io'), 0);
  });
});

describe('le notifiche: raggruppate per giorno', () => {
  test('oggi, ieri e poi le date', () => {
    const g = raggruppaPerGiorno([
      riga({ id: 'a', created_at: fa(30) }),
      riga({ id: 'b', created_at: fa(120) }),
      riga({ id: 'c', created_at: fa(60 * 26) }),
      riga({ id: 'd', created_at: fa(60 * 24 * 5) })
    ], ADESSO);
    is(g.length, 3);
    is(g[0].giorno, 'Oggi');
    is(g[0].righe.length, 2);
    is(g[1].giorno, 'Ieri');
    ok(g[2].giorno !== 'Oggi' && g[2].giorno !== 'Ieri');
  });

  test('non riordina: l’ordine è quello che arriva dal database', () => {
    const g = raggruppaPerGiorno([
      riga({ id: 'a', created_at: fa(120) }),
      riga({ id: 'b', created_at: fa(30) })
    ], ADESSO);
    is(g[0].righe.map(x => x.id).join(''), 'ab');
  });

  test('una data storta finisce in un gruppo suo, non fa sparire la riga', () => {
    const g = raggruppaPerGiorno([riga({ id: 'x', created_at: 'boh' })], ADESSO);
    is(g.length, 1);
    is(g[0].righe.length, 1);
  });

  test('senza niente restituisce niente', () => {
    is(raggruppaPerGiorno(null, ADESSO).length, 0);
  });
});

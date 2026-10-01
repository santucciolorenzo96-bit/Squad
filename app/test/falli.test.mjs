import { describe, test, is, ok, eq } from './run.mjs';
import { falliPerGiocatore, segniFallo, raccontaFalli, TIPI_FALLO } from '../src/utils/falli.js';
import { applicaAzione } from '../src/utils/azione.js';
import { azioneDi } from '../src/utils/referto.js';
import { BASKET } from '../src/utils/sports/basket.js';

/* I CINQUE TRATTINI SOTTO IL GETTONE.
 *
 * Al quinto fallo si esce. Chi segna lo deve vedere con la coda dell'occhio,
 * senza aprire niente e senza contare a mente: un allenatore che scopre il
 * quinto fallo dall'arbitro ha già perso il cambio.
 *
 * Due cose vanno tenute separate e vanno insieme. Le STATISTICHE sanno quanti
 * falli ha un giocatore — `pf`, il numero da cui dipende tutto — e il REGISTRO
 * sa quali e in che ordine. «Due personali e poi un tecnico» racconta una
 * partita diversa da «un tecnico e poi due personali», e quella differenza
 * esiste solo nella cronaca.
 *
 * Quando le due fonti non coincidono vince il totale, sempre: `pf` è quello
 * che il database conosce e quello che decide chi sta in campo.
 */

const partita = (storia) => ({ quarter: 1, storia, players: [] });

describe('i falli si ritrovano nel registro, in ordine', () => {
  test('uno per giocatore, nell ordine in cui sono stati fatti', () => {
    const per = falliPerGiocatore(partita([
      { q: 1, a: 'pf', p: 'a' },
      { q: 1, a: 'fg2_made', p: 'b' },
      { q: 1, a: 'pf_tecnico', p: 'a' },
      { q: 2, a: 'pf', p: 'b' },
      { q: 2, a: 'pf_antisportivo', p: 'a' }
    ]));
    eq(per.a, ['personale', 'tecnico', 'antisportivo']);
    eq(per.b, ['personale']);
  });

  test('le azioni che non sono falli non contano', () => {
    const per = falliPerGiocatore(partita([
      { q: 1, a: 'pfDrawn', p: 'a' },      // fallo SUBITO: non è suo
      { q: 1, a: 'tov_passi', p: 'a' },
      { q: 1, a: 'loro', n: 2 }
    ]));
    is(per.a, undefined);
  });

  test('e nemmeno un fallo senza autore', () => {
    is(Object.keys(falliPerGiocatore(partita([{ q: 1, a: 'pf' }]))).length, 0);
  });

  test('un registro che non c e non fa cadere niente', () => {
    eq(falliPerGiocatore({}), {});
    eq(falliPerGiocatore(null), {});
    eq(falliPerGiocatore({ storia: 'no' }), {});
  });

  test('i tre nomi sono quelli delle azioni vere dello sport', () => {
    Object.keys(TIPI_FALLO).forEach(act => {
      ok(azioneDi(BASKET, act), act + ' non esiste nella configurazione');
    });
  });
});

describe('i trattini da disegnare', () => {
  test('nessun fallo: cinque caselle vuote', () => {
    const s = segniFallo({ pf: 0 }, [], 5);
    is(s.tot, 0);
    is(s.fuori, false);
    is(s.segni.filter(Boolean).length, 0);
    is(s.segni.length, 5);
  });

  test('tre falli: tre piene e due vuote, nell ordine giusto', () => {
    const s = segniFallo({ pf: 3 }, ['personale', 'tecnico', 'personale'], 5);
    eq(s.segni, ['personale', 'tecnico', 'personale', null, null]);
    is(s.fuori, false);
  });

  /* IL CASO CHE CONTA. */
  test('al quinto si e fuori', () => {
    const s = segniFallo({ pf: 5 }, ['personale', 'personale', 'tecnico', 'personale', 'personale'], 5);
    is(s.fuori, true);
    is(s.segni.filter(Boolean).length, 5);
    is(s.oltre, 0);
  });

  test('al quarto non ancora', () => {
    is(segniFallo({ pf: 4 }, [], 5).fuori, false);
  });

  test('un sesto fallo non si disegna, si scrive', () => {
    const s = segniFallo({ pf: 6 }, [], 5);
    is(s.segni.length, 5);
    is(s.oltre, 1);
    is(s.fuori, true);
  });

  /* IL TOTALE COMANDA SULLA SEQUENZA.
   *
   * Le partite segnate prima che il registro esistesse hanno i falli nel
   * tabellino e non nella cronaca. Lì i trattini devono comparire lo stesso:
   * sapere che ne ha quattro vale più che sapere di che tipo erano. */
  test('senza registro i trattini vengono dal tabellino', () => {
    const s = segniFallo({ pf: 4 }, undefined, 5);
    is(s.tot, 4);
    eq(s.segni, ['personale', 'personale', 'personale', 'personale', null]);
  });

  test('con un registro parziale, i mancanti sono i piu vecchi', () => {
    // La cronaca, quando c'è, è sempre la coda della partita.
    const s = segniFallo({ pf: 3 }, ['antisportivo'], 5);
    eq(s.segni, ['personale', 'personale', 'antisportivo', null, null]);
  });

  test('un registro piu lungo del totale si accorcia', () => {
    // Capita annullando: il tabellino torna indietro, la cronaca pure, ma su
    // una partita vecchia le due cose possono non combaciare.
    const s = segniFallo({ pf: 1 }, ['personale', 'tecnico', 'tecnico'], 5);
    eq(s.segni, ['personale', null, null, null, null]);
  });

  test('statistiche assurde non fanno cadere niente', () => {
    is(segniFallo(null, null, 5).tot, 0);
    is(segniFallo({ pf: -3 }, null, 5).tot, 0);
    is(segniFallo({ pf: 'due' }, null, 5).tot, 0);
    is(segniFallo({}, null, 5).segni.length, 5);
  });
});

describe('i falli raccontati a parole', () => {
  /* Cinque trattini colorati sono un'informazione che deve esistere anche
   * senza colore: chi non distingue le tinte, e chi passa il dito sopra. */
  test('nessun fallo', () => is(raccontaFalli(segniFallo({ pf: 0 }, [], 5)), 'Nessun fallo'));

  test('uno solo, al singolare', () => {
    is(raccontaFalli(segniFallo({ pf: 1 }, ['personale'], 5)), '1 fallo');
  });

  test('i tre tipi, ciascuno col suo nome', () => {
    const t = raccontaFalli(segniFallo({ pf: 3 }, ['personale', 'tecnico', 'antisportivo'], 5));
    ok(/1 fallo/.test(t), t);
    ok(/1 tecnico/.test(t), t);
    ok(/1 antisportivo/.test(t), t);
  });

  test('e quando si e fuori lo dice', () => {
    const t = raccontaFalli(segniFallo({ pf: 5 }, ['personale', 'personale', 'personale', 'personale', 'tecnico'], 5));
    ok(/fuori per falli/.test(t), t);
  });
});

/* ------------------------------------------- i tre falli, applicati davvero */

describe('i tre tipi di fallo, premendo i pulsanti veri', () => {
  function partitaNuova() {
    return {
      quarter: 1, periodScores: [], storia: [], quarterFouls: {},
      players: [{ id: 'p0', number: '4', name: 'Chi Falla', onCourt: true, stats: BASKET.newStats() }]
    };
  }

  test('tutti e tre contano uno nei falli del giocatore', () => {
    ['pf', 'pf_tecnico', 'pf_antisportivo'].forEach(act => {
      const g = partitaNuova();
      applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, act) });
      is(g.players[0].stats.pf, 1, act + ' non conta nel totale dei falli');
    });
  });

  /* Un tecnico e un antisportivo contano fra i falli di squadra come un
   * personale: è il regolamento, ed è quello che manda l'altra squadra in
   * bonus. Sbagliarlo vuol dire far tirare liberi a chi non ne ha diritto. */
  test('e tutti e tre contano uno nei falli di squadra', () => {
    ['pf', 'pf_tecnico', 'pf_antisportivo'].forEach(act => {
      const g = partitaNuova();
      applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, act) });
      is(g.quarterFouls[1], 1, act + ' non conta fra i falli di squadra');
    });
  });

  test('ognuno finisce nel suo cassetto', () => {
    const g = partitaNuova();
    ['pf', 'pf_tecnico', 'pf_antisportivo', 'pf'].forEach(act => {
      applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, act) });
    });
    const t = g.players[0].stats.pfTypes;
    is(t.personale, 2);
    is(t.tecnico, 1);
    is(t.antisportivo, 1);
    is(g.players[0].stats.pf, 4);
  });

  /* IL GIRO COMPLETO: si premono cinque falli e il gettone dice «fuori». */
  test('cinque falli e il giocatore e fuori, coi tipi giusti', () => {
    const g = partitaNuova();
    ['pf', 'pf', 'pf_tecnico', 'pf', 'pf_antisportivo'].forEach(act => {
      applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, act) });
    });
    const s = segniFallo(g.players[0].stats, falliPerGiocatore(g).p0, BASKET.scout.falliPerUscire);
    is(s.fuori, true);
    eq(s.segni, ['personale', 'personale', 'tecnico', 'personale', 'antisportivo']);
  });

  test('lo sport dice a quale fallo si esce', () => {
    is(BASKET.scout.falliPerUscire, 5);
  });

  test('e il fallo SUBITO non conta fra i propri', () => {
    const g = partitaNuova();
    applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, 'pfDrawn') });
    is(g.players[0].stats.pf, 0);
    is(g.quarterFouls[1], undefined);
  });
});

/* TECNICI E ANTISPORTIVI SUL REFERTO.
 *
 * Nel tabellino stanno dentro il totale dei falli — ed è giusto, perché è quel
 * totale che decide chi esce dal campo. Ma un referto che si ferma lì non dice
 * la cosa che chi lo legge sta cercando: chi li ha presi.
 *
 * Non diventano due colonne: sarebbero due colonne vuote in novantanove
 * partite su cento, su un tabellino che di colonne ne ha già tredici.
 */
import { falliSpeciali } from '../src/utils/referto.js';

describe('i falli tecnici e gli antisportivi, sotto il tabellino', () => {
  test('senza nessuno dei due non si scrive niente', () => {
    is(falliSpeciali([{ name: 'Chi Falla', number: '4', pf: 3, pfTech: 0, pfUnsp: 0 }]), null);
    is(falliSpeciali([]), null);
    is(falliSpeciali(null), null);
  });

  test('un tecnico: si dice chi', () => {
    const t = falliSpeciali([{ name: 'Marco Russo', number: '7', pf: 2, pfTech: 1, pfUnsp: 0 }]);
    ok(/Falli tecnici/.test(t), t);
    ok(/#7 Marco Russo/.test(t), t);
    is(/Antisportivi/.test(t), false, 'non ce ne sono: non si nomina');
  });

  test('due dello stesso: si dice quanti', () => {
    const t = falliSpeciali([{ name: 'Marco Russo', number: '7', pf: 3, pfTech: 2, pfUnsp: 0 }]);
    ok(/Marco Russo \(2\)/.test(t), t);
  });

  test('tutti e due i tipi, separati', () => {
    const t = falliSpeciali([
      { name: 'Marco Russo', number: '7', pf: 2, pfTech: 1, pfUnsp: 0 },
      { name: 'Luca Fanti', number: '9', pf: 1, pfTech: 0, pfUnsp: 1 }
    ]);
    ok(/Falli tecnici: #7 Marco Russo/.test(t), t);
    ok(/Antisportivi: #9 Luca Fanti/.test(t), t);
  });

  test('chi non ne ha presi non compare', () => {
    const t = falliSpeciali([
      { name: 'Marco Russo', number: '7', pf: 4, pfTech: 0, pfUnsp: 0 },
      { name: 'Luca Fanti', number: '9', pf: 1, pfTech: 1, pfUnsp: 0 }
    ]);
    is(/Marco Russo/.test(t), false, t);
  });

  /* I due conteggi si sommano da soli: su una partita, nella riga della
   * squadra, e su tutta la stagione. È il motivo per cui sono due numeri e
   * non un contenitore. */
  test('lo sport li sa ricavare da un giocatore', () => {
    const p = { stats: Object.assign(BASKET.newStats(), {
      pf: 3, pfTypes: { personale: 1, tecnico: 1, antisportivo: 1 }
    }) };
    is(BASKET.aggregate.pf(p), 3);
    is(BASKET.aggregate.pfTech(p), 1);
    is(BASKET.aggregate.pfUnsp(p), 1);
  });

  test('e da un giocatore vecchio, senza i tipi, torna zero', () => {
    const p = { stats: { pf: 4 } };
    is(BASKET.aggregate.pf(p), 4);
    is(BASKET.aggregate.pfTech(p), 0);
    is(BASKET.aggregate.pfUnsp(p), 0);
  });
});

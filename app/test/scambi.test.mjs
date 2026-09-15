import { describe, test, is, ok } from './run.mjs';
import { scambioFinito, percentualiFase } from '../src/utils/regole.js';

// Uno scambio finito è tre cose insieme: la fase in cui è successo, la
// rotazione a cui appartiene, e chi batterà il prossimo. Sono le tre da cui
// discende metà della statistica della pallavolo, e finora non ne avevamo
// nessuna.

const inizio = (serve, rot) => ({ us: 0, them: 0, serve, rot: rot || 1 });

describe('lo scambio: chi batte dopo', () => {
  test('chi vince lo scambio serve il successivo', () => {
    is(scambioFinito(inizio('them'), 'us').riga.serve, 'us');
    is(scambioFinito(inizio('us'), 'them').riga.serve, 'them');
  });

  test('chi serviva e vince continua a servire', () => {
    is(scambioFinito(inizio('us'), 'us').riga.serve, 'us');
  });

  test('senza sapere chi batteva non si conta niente', () => {
    is(scambioFinito({ us: 3, them: 2 }, 'us'), null);
  });
});

describe('lo scambio: la fase', () => {
  test('vincere sul servizio avversario è un cambio palla', () => {
    const r = scambioFinito(inizio('them'), 'us').riga;
    is(r.soT, 1); is(r.soV, 1);
    is(r.bpT, undefined);
  });

  test('perdere sul servizio avversario conta lo scambio ma non il punto', () => {
    const r = scambioFinito(inizio('them'), 'them').riga;
    is(r.soT, 1); is(r.soV, undefined);
  });

  test('vincere sul proprio servizio è un break', () => {
    const r = scambioFinito(inizio('us'), 'us').riga;
    is(r.bpT, 1); is(r.bpV, 1);
    is(r.soT, undefined);
  });

  test('le due fasi non si mescolano mai', () => {
    let r = inizio('them');
    r = scambioFinito(r, 'us').riga;     // cambio palla riuscito
    r = scambioFinito(r, 'us').riga;     // break riuscito
    r = scambioFinito(r, 'them').riga;   // break fallito
    is(r.soT, 1); is(r.soV, 1);
    is(r.bpT, 2); is(r.bpV, 1);
  });
});

describe('lo scambio: la rotazione', () => {
  test('si gira solo conquistando il servizio', () => {
    ok(scambioFinito(inizio('them'), 'us').gira);
    is(scambioFinito(inizio('us'), 'us').gira, false);
    is(scambioFinito(inizio('us'), 'them').gira, false);
    is(scambioFinito(inizio('them'), 'them').gira, false);
  });

  test('dopo la sesta si torna alla prima', () => {
    is(scambioFinito(inizio('them', 6), 'us').riga.rot, 1);
    is(scambioFinito(inizio('them', 1), 'us').riga.rot, 2);
  });

  test('il punto resta alla rotazione in cui si stava giocando', () => {
    // Si vince in R3 e si gira: il punto è di R3, non di R4.
    const r = scambioFinito(inizio('them', 3), 'us').riga;
    is(r.rot, 4);
    is(r.perRot[3].f, 1);
    is(r.perRot[4], undefined);
  });

  test('i punti subiti si contano nella stessa rotazione', () => {
    let r = inizio('us', 2);
    r = scambioFinito(r, 'them').riga;   // perso battendo noi: niente rotazione
    is(r.perRot[2].s, 1);
    is(r.rot, 2);
  });
});

describe('lo scambio: un set intero', () => {
  // Battono loro. Facciamo cambio palla, poi due break, poi sbagliamo, poi
  // rifacciamo cambio palla. Cinque scambi, quattro punti nostri, uno loro.
  test('i conti tornano dopo cinque scambi', () => {
    let r = inizio('them');
    ['us', 'us', 'us', 'them', 'us'].forEach(chi => { r = scambioFinito(r, chi).riga; });
    is(r.soT, 2); is(r.soV, 2);         // due volte in ricezione, vinte entrambe
    is(r.bpT, 3); is(r.bpV, 2);         // tre al servizio, due vinte
    const p = percentualiFase(r);
    is(p.so, 100); is(p.bp, 67);
  });

  test('si è girato due volte, una per ogni cambio palla', () => {
    let r = inizio('them');
    ['us', 'us', 'us', 'them', 'us'].forEach(chi => { r = scambioFinito(r, chi).riga; });
    is(r.rot, 3);
  });
});

describe('le percentuali', () => {
  test('senza scambi non si inventa uno zero', () => {
    const p = percentualiFase({ us: 0, them: 0, serve: 'us' });
    is(p.so, null); is(p.bp, null);
  });
  test('senza riga non si rompe', () => {
    is(percentualiFase(null).so, null);
  });
});

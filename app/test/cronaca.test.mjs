import { describe, test, is, ok } from './run.mjs';
import { cronaca } from '../src/utils/cronaca.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';

/* LE ULTIME COSE SEGNATE.
 *
 * Serve a controllare l'ultima registrazione: nel flusso evento-prima si tocca
 * l'evento e poi la faccia in mezzo secondo, e il dubbio che viene dopo è
 * «l'ho dato al sette o al nove?».
 *
 * I casi qui sotto sono le tre forme che il registro ha davvero, più quelli in
 * cui una riga potrebbe sparire senza dirlo — che è il modo in cui questa
 * sezione tradirebbe chi la guarda.
 */

const partita = (patch) => ({
  oppName: 'Azzurra Belpasso',
  friendly: false,
  quarterLength: 600,
  players: [
    { id: 'p1', number: '7', name: 'Luca Bianchi' },
    { id: 'p2', number: '9', name: 'Lorenzo Bertolotti Massaro' },
    { id: 'p3', number: '', name: 'Marco' }
  ],
  storia: [],
  ...patch
});

describe('un’azione di un nostro giocatore', () => {
  const g = partita({ storia: [{ q: 2, a: 'fg2_made', p: 'p1', t: 544 }] });
  const [r] = cronaca(g, BASKET);

  test('dice quando: periodo e ora del cronometro', () => {
    is(r.periodo, 'P2');
    is(r.tempo, '9:04');
  });

  test('dice cosa, col gruppo quando serve a capirlo', () => {
    /* «✓ Canestro» da solo puo` essere un due o un tre: e` proprio il dato
     * che si sta controllando, quindi il gruppo va aggiunto. */
    is(r.cosa, '✓ Canestro · Tiro da 2');
  });

  test('ma non quando l’etichetta e` gia` univoca', () => {
    const g2 = partita({ storia: [{ q: 1, a: 'ast', p: 'p1', t: 300 }] });
    is(cronaca(g2, BASKET)[0].cosa, 'Assist');
  });

  test('dice chi: numero e cognome', () => {
    is(r.chi, '#7 Bianchi');
  });

  test('e porta il tono dell’azione, per il colore', () => {
    ok(r.tono, 'manca il tono');
    is(r.nostra, true);
  });
});

describe('il cognome e non il nome intero', () => {
  test('un cognome doppio resta intero', () => {
    // In una colonna stretta il nome intero viene tagliato, e quello che si
    // taglia è la metà che distingue.
    const g = partita({ storia: [{ q: 1, a: 'ast', p: 'p2', t: 300 }] });
    is(cronaca(g, BASKET)[0].chi, '#9 Bertolotti Massaro');
  });

  test('senza numero di maglia non si scrive «#»', () => {
    // Un cancelletto seguito da niente sembra un dato rotto.
    const g = partita({ storia: [{ q: 1, a: 'ast', p: 'p3', t: 300 }] });
    is(cronaca(g, BASKET)[0].chi, 'Marco');
  });
});

describe('i punti degli avversari', () => {
  const g = partita({ storia: [{ q: 3, a: 'loro', n: 2, t: 120 }] });
  const [r] = cronaca(g, BASKET);

  test('portano il nome dell’avversario e quanti punti', () => {
    is(r.cosa, 'Azzurra Belpasso');
    is(r.chi, '+2');
  });

  test('e non sono nostri: il colore deve poterli distinguere', () => {
    is(r.nostra, false);
    is(r.tono, 'avversario');
  });
});

describe('una correzione a mano del nostro punteggio', () => {
  test('si vede, col segno', () => {
    const g = partita({ storia: [{ q: 1, a: 'noi', n: -1, t: 580 }] });
    const [r] = cronaca(g, BASKET);
    is(r.chi, '-1');
    is(r.nostra, true);
  });
});

describe('le righe che potrebbero sparire senza dirlo', () => {
  /* È il modo in cui questa sezione tradirebbe chi la guarda: una riga che
   * non si mostra fa credere che quel tocco non sia mai arrivato. */
  test('un’azione che la configurazione non conosce si mostra col suo codice', () => {
    const g = partita({ storia: [{ q: 1, a: 'azione_tolta_nel_2027', p: 'p1', t: 400 }] });
    const r = cronaca(g, BASKET);
    is(r.length, 1);
    is(r[0].cosa, 'azione_tolta_nel_2027');
  });

  test('un giocatore che non è più in rosa non fa sparire l’azione', () => {
    const g = partita({ storia: [{ q: 1, a: 'fg2_made', p: 'nessuno', t: 400 }] });
    const r = cronaca(g, BASKET);
    is(r.length, 1);
    is(r[0].chi, '');
  });

  test('una voce vuota nel registro viene saltata, non fa cadere tutto', () => {
    const g = partita({ storia: [null, { q: 1, a: 'fg2_made', p: 'p1', t: 400 }, undefined] });
    is(cronaca(g, BASKET).length, 1);
  });

  test('senza registro non si lancia: elenco vuoto', () => {
    is(cronaca(partita({ storia: null }), BASKET).length, 0);
    is(cronaca(null, BASKET).length, 0);
    is(cronaca(undefined, BASKET).length, 0);
  });
});

describe('quante, e in che ordine', () => {
  const molte = [];
  for (let i = 0; i < 10; i++) molte.push({ q: 1, a: 'fg2_made', p: 'p1', t: 600 - i * 10 });
  const g = partita({ storia: molte });

  test('le ultime tre, non le prime', () => {
    const r = cronaca(g, BASKET);
    is(r.length, 3);
    // L'ultima segnata è quella con meno tempo rimasto, ed è la prima della
    // lista: è quella di cui si dubita, e metterla in fondo vorrebbe dire
    // cercarla ogni volta.
    is(r[0].tempo, mmssAtteso(600 - 9 * 10));
    is(r[2].tempo, mmssAtteso(600 - 7 * 10));
  });

  test('quante si può chiedere', () => {
    is(cronaca(g, BASKET, { quante: 6 }).length, 6);
    is(cronaca(g, BASKET, { quante: 99 }).length, 10);
  });
});

function mmssAtteso(s) {
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

describe('dove non c’è cronometro', () => {
  test('resta il periodo e il tempo è vuoto, non «0:00»', () => {
    // Un «0:00» su ogni riga sembrerebbe un dato, e direbbe il falso.
    const g = partita({ quarterLength: 0, storia: [{ q: 4, a: 'kill', p: 'p1' }] });
    const [r] = cronaca(g, PALLAVOLO);
    is(r.tempo, '');
    is(r.periodo, 'S4');
  });
});

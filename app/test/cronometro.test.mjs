import { describe, test, is, ok } from './run.mjs';
import {
  DURATA_PREDEFINITA, durataPeriodo, restano, inMoto, avvia, ferma, scambia,
  imposta, nuovoPeriodo, secondiDelTurno, mmss, minutiGiocati
} from '../src/utils/cronometro.js';
import { BASKET } from '../src/utils/sports/basket.js';

/* IL CRONOMETRO.
 *
 * Era stato tolto perché è l'unica statistica che si corrompe da sola: scorre
 * anche quando nessuno la guarda. Torna perché serve sapere quanto ha giocato
 * ognuno, e i casi scritti qui sotto sono quelli in cui potrebbe mentire —
 * perché un cronometro che mente è peggio di un cronometro che non c'è.
 */

const T0 = Date.parse('2026-10-27T20:00:00.000Z');
const conf = BASKET.scout;

const fermo = (secondi) => ({ clock: secondi, clockRunning: false, clockFrom: null });
const andante = (secondi, da = T0) => ({
  clock: secondi, clockRunning: true, clockFrom: new Date(da).toISOString()
});

describe('quanto dura un periodo', () => {
  test('quella scritta sulla partita vince', () => {
    is(durataPeriodo({ quarterLength: 480 }, conf), 480);
  });

  test('senza, i dieci minuti FIBA', () => {
    is(durataPeriodo({}, conf), DURATA_PREDEFINITA);
    is(durataPeriodo({ quarterLength: 0 }, conf), DURATA_PREDEFINITA);
    is(durataPeriodo(null, conf), DURATA_PREDEFINITA);
  });
});

describe('quanto manca adesso', () => {
  test('da fermo è il numero che c’è scritto', () => {
    is(restano(fermo(544), T0 + 99000), 544);
  });

  test('in moto si sottrae il tempo passato', () => {
    is(restano(andante(600), T0), 600);
    is(restano(andante(600), T0 + 1000), 599);
    is(restano(andante(600), T0 + 65000), 535);
  });

  test('non scende sotto zero', () => {
    is(restano(andante(10), T0 + 60000), 0);
  });

  test('senza partita è zero, non un errore', () => {
    is(restano(null), 0);
    is(restano(undefined), 0);
  });
});

describe('le bugie che un cronometro può dire, e che qui non dice', () => {
  /* Tutte le vie di fuga portano all'ultimo valore certo. Nessuna deve
   * produrre un numero inventato, e soprattutto nessuna deve far CRESCERE il
   * tempo residuo: un cronometro che torna indietro da solo è peggio di uno
   * fermo, perché regala minuti a tutti e cinque senza farsi notare. */
  test('una data di partenza illeggibile non inventa nulla', () => {
    is(restano({ clock: 300, clockRunning: true, clockFrom: 'ieri sera' }, T0), 300);
    is(restano({ clock: 300, clockRunning: true, clockFrom: '' }, T0), 300);
  });

  test('l’orologio del dispositivo indietro non fa risalire il tempo', () => {
    // `adesso` prima della partenza: passati sarebbe negativo, e sottrarlo
    // aggiungerebbe tempo al periodo.
    is(restano(andante(300, T0), T0 - 120000), 300);
  });

  test('un clock negativo o non numerico vale zero', () => {
    is(restano({ clock: -40, clockRunning: false }), 0);
    is(restano({ clock: 'molto', clockRunning: false }), 0);
  });

  test('«in moto» a zero non è in moto', () => {
    // Serve a non mostrare un cronometro che si crede in corsa mentre è
    // inchiodato a 0:00 e non dà minuti a nessuno.
    is(inMoto(andante(5), T0 + 10000), false);
    is(inMoto(andante(5), T0), true);
    is(inMoto(fermo(300)), false);
  });
});

describe('avviare, fermare, scambiare', () => {
  test('avviare fissa quanto manca e da quando', () => {
    const g = fermo(600);
    avvia(g, T0);
    is(g.clockRunning, true);
    is(g.clock, 600);
    is(g.clockFrom, new Date(T0).toISOString());
  });

  test('fermare congela il tempo che era passato', () => {
    const g = andante(600, T0);
    ferma(g, T0 + 42000);
    is(g.clockRunning, false);
    is(g.clock, 558);
    is(g.clockFrom, null);
    // E da fermo non si muove più, qualunque ora sia.
    is(restano(g, T0 + 999000), 558);
  });

  test('a zero non si avvia', () => {
    const g = fermo(0);
    avvia(g, T0);
    is(g.clockRunning, false);
  });

  test('avviare due volte non sposta la partenza indietro', () => {
    const g = fermo(600);
    avvia(g, T0);
    avvia(g, T0 + 30000);
    // La seconda chiamata riparte da quanto manca adesso: 570, non 600.
    is(g.clock, 570);
    is(restano(g, T0 + 30000), 570);
  });

  test('scambia va e viene', () => {
    const g = fermo(600);
    scambia(g, T0);
    is(g.clockRunning, true);
    scambia(g, T0 + 10000);
    is(g.clockRunning, false);
    is(g.clock, 590);
  });
});

describe('correggere il cronometro', () => {
  test('si scrive il numero del tabellone', () => {
    const g = fermo(600);
    imposta(g, 437, conf);
    is(g.clock, 437);
  });

  test('non si va oltre la durata del periodo né sotto zero', () => {
    const g = fermo(600);
    imposta(g, 99999, conf);
    is(g.clock, DURATA_PREDEFINITA);
    imposta(g, -5, conf);
    is(g.clock, 0);
  });

  test('se andava, riparte da lì: chi corregge in corsa non vuole fermarsi', () => {
    const g = andante(600, T0);
    imposta(g, 500, conf, T0 + 5000);
    is(g.clockRunning, true);
    is(restano(g, T0 + 5000), 500);
    is(restano(g, T0 + 8000), 497);
  });

  test('ma correggere a zero ferma: non c’è niente da far scorrere', () => {
    const g = andante(600, T0);
    imposta(g, 0, conf, T0 + 5000);
    is(g.clockRunning, false);
    is(g.clock, 0);
  });
});

describe('un periodo nuovo comincia pieno e fermo', () => {
  test('pieno', () => {
    const g = andante(12, T0);
    nuovoPeriodo(g, conf);
    is(g.clock, DURATA_PREDEFINITA);
  });

  test('e FERMO: alla palla a due il tempo non è ancora partito', () => {
    const g = andante(12, T0);
    nuovoPeriodo(g, conf);
    is(g.clockRunning, false);
    is(g.clockFrom, null);
  });
});

describe('i minuti di chi era in campo', () => {
  test('la differenza fra l’ingresso e adesso', () => {
    is(secondiDelTurno({ cl: 600 }, 480), 120);
  });

  test('col cronometro fermo per tutto il turno: zero', () => {
    /* È il cuore della cosa: i minuti si misurano sul cronometro, non
     * sull'orologio da parete. Un time out di tre minuti costa zero minuti
     * giocati, e un cronometro scordato in moto si vede subito perché scende
     * mentre non succede niente. */
    is(secondiDelTurno({ cl: 600 }, 600), 0);
  });

  test('mai negativo, nemmeno a cavallo di due periodi', () => {
    // Un turno non attraversa l'azzeramento, perché il tracker chiude i turni
    // a fine periodo. Se un domani quell'ordine cambiasse, meglio zero minuti
    // che minuti all'indietro.
    is(secondiDelTurno({ cl: 100 }, 600), 0);
  });

  test('senza turno, o senza numeri, zero', () => {
    is(secondiDelTurno(null, 480), 0);
    is(secondiDelTurno({}, 480), 0);
    is(secondiDelTurno({ cl: 600 }, undefined), 0);
  });
});

describe('come si scrive un tempo', () => {
  test('il formato del tabellone', () => {
    is(mmss(600), '10:00');
    is(mmss(544), '9:04');
    is(mmss(7), '0:07');
    is(mmss(0), '0:00');
  });

  test('niente numeri negativi né decimali', () => {
    is(mmss(-30), '0:00');
    is(mmss(90.7), '1:30');
    is(mmss('x'), '0:00');
  });

  test('i minuti nel tabellino, e il trattino per chi non è entrato', () => {
    is(minutiGiocati({ seconds: 1450 }), '24:10');
    is(minutiGiocati({ seconds: 0 }), '—');
    is(minutiGiocati({}), '—');
    is(minutiGiocati(null), '—');
  });
});

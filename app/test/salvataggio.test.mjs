import { describe, test, is, ok } from './run.mjs';
import { motivoDelRifiuto, SPIEGAZIONE, siRiprova } from '../src/utils/salvataggio.js';

/* PERCHÉ UNO SCOUT «È CRASHATO» IN MEZZO A UN'AMICHEVOLE.
 *
 * Il 30 settembre 2026 una partita di DR2 contro Giardini Naxos è stata chiusa
 * a metà del primo quarto, sul 14-9, con zero periodi chiusi. Chi la stava
 * segnando ha visto lo scout smettere di funzionare.
 *
 * Non c'era nessun crash. Era questo:
 *
 *   `salva_tabellino` scrive solo se la riga combacia, e la sua condizione ha
 *   tre parti — l'id, la revisione, e `status = 'live'`. Se non scrive niente
 *   restituisce null, e quel null veniva letto come se avesse una sola causa:
 *   «un altro dispositivo è arrivato prima».
 *
 *   Con la partita chiusa, ogni salvataggio successivo falliva per sempre. Lo
 *   scout mostrava «Questa partita la sta segnando qualcun altro» — falso —
 *   in una finestra che non si poteva chiudere, e il suo unico pulsante
 *   cancellava la copia locale prima di ricaricare. Cioè: nel momento in cui
 *   il server rifiutava il lavoro di chi stava segnando, si buttava via anche
 *   l'ultimo posto dove quel lavoro esisteva ancora.
 *
 * Il difetto non era nel messaggio: era nel non aver mai distinto i tre casi.
 * Questi test tengono separati i tre, e in particolare tengono la partita
 * chiusa fuori dal sacco dei sorpassi.
 */

describe('perche un salvataggio non ha scritto niente', () => {
  test('la riga non c e piu: e stata scartata', () => {
    is(motivoDelRifiuto(null, 7).motivo, 'assente');
    is(motivoDelRifiuto(undefined, 0).motivo, 'assente');
  });

  test('la partita e chiusa', () => {
    const r = motivoDelRifiuto({ status: 'finished', revisione: 38 }, 38);
    is(r.motivo, 'chiusa');
    is(r.stato, 'finished');
  });

  /* IL TEST CHE CONTA.
   *
   * Una partita chiusa ha quasi sempre ANCHE la revisione diversa dalla
   * nostra, perché chi l'ha chiusa ha scritto. È esattamente il caso vero del
   * 30 settembre: revisione 38 sul server, e il dispositivo che segnava
   * partiva da una più vecchia. Se si guardasse prima la revisione, la
   * partita chiusa verrebbe raccontata come un sorpasso — e si tornerebbe al
   * messaggio sbagliato. */
  test('una partita chiusa resta chiusa anche se la revisione e avanzata', () => {
    const r = motivoDelRifiuto({ status: 'finished', revisione: 38 }, 31);
    is(r.motivo, 'chiusa', 'la chiusura deve vincere sul sorpasso');
  });

  test('e qualunque stato che non sia live vale come chiusa', () => {
    ['finished', 'archived', 'scarto', ''].forEach(st => {
      is(motivoDelRifiuto({ status: st, revisione: 1 }, 1).motivo, 'chiusa', 'stato ' + st);
    });
  });

  test('un altro dispositivo e arrivato prima', () => {
    const r = motivoDelRifiuto(
      { status: 'live', revisione: 12, tenuto_da: 'u2', tenuto_alle: '2026-09-30T18:00:00Z' },
      9
    );
    is(r.motivo, 'superata');
    is(r.tenutoDa, 'u2');
  });

  test('la riga e come ce la aspettavamo: si sta prudenti', () => {
    // Non si sa perché sia stato rifiutato: non si riprova a scrivere sopra.
    is(motivoDelRifiuto({ status: 'live', revisione: 5 }, 5).motivo, 'superata');
  });

  test('una revisione mancante conta come zero, da una parte e dall altra', () => {
    is(motivoDelRifiuto({ status: 'live' }, 0).motivo, 'superata');
    is(motivoDelRifiuto({ status: 'live', revisione: 0 }, undefined).motivo, 'superata');
    is(motivoDelRifiuto({ status: 'live', revisione: 3 }, undefined).motivo, 'superata');
  });
});

describe('cosa si dice a chi sta segnando', () => {
  test('ogni motivo ha la sua frase, e non sono la stessa', () => {
    const frasi = ['chiusa', 'assente', 'superata', 'rete'].map(m => SPIEGAZIONE[m]);
    frasi.forEach(f => ok(f && f.length > 10));
    is(new Set(frasi).size, 4, 'due motivi diversi non possono dire la stessa cosa');
  });

  test('a una partita chiusa non si dice che la sta segnando qualcun altro', () => {
    // È la frase esatta che si leggeva, ed era falsa.
    is(/qualcun altro|altro dispositivo/.test(SPIEGAZIONE.chiusa), false, SPIEGAZIONE.chiusa);
    ok(/chiusa|archiviata/.test(SPIEGAZIONE.chiusa));
  });
});

describe('quando si riprova da soli', () => {
  /* La riprova automatica esiste per la palestra senza segnale. Riprovare negli
   * altri due casi sarebbe peggio del male: su una partita chiusa non
   * funzionerebbe mai, e su un sorpasso funzionerebbe — scrivendo sopra al
   * lavoro di chi sta segnando davvero. */
  test('solo la rete assente', () => {
    is(siRiprova('rete'), true);
  });

  test('e nessuno degli altri tre', () => {
    ['chiusa', 'assente', 'superata'].forEach(m => {
      is(siRiprova(m), false, m + ' non si deve riprovare');
    });
  });
});

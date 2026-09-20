import { describe, test, is, ok } from './run.mjs';
import {
  situazionePeriodo, periodiVinti, partitaDecisa, etichettaPalla,
  perchePunteggioImpossibile
} from '../src/utils/regole.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { BASKET } from '../src/utils/sports/basket.js';

const V = PALLAVOLO.scout;
const B = BASKET.scout;

describe('regolamento: dove non c’è, non inventa', () => {
  test('il basket non ha una soglia di punti', () => {
    is(situazionePeriodo(B, 1, 40, 12), null);
    is(partitaDecisa(B, [{ us: 20, them: 10 }]), null);
    is(perchePunteggioImpossibile(B, 1, 20, 19, 'Periodo'), null);
  });
});

describe('pallavolo: quando il set è a un punto dalla fine', () => {
  test('a 24-20 è set point', () => {
    const s = situazionePeriodo(V, 1, 24, 20);
    is(s.stato, 'palla'); is(s.chi, 'us');
  });

  test('a 24-24 non lo è per nessuno dei due', () => {
    is(situazionePeriodo(V, 1, 24, 24).stato, 'gioco');
  });

  test('ai vantaggi torna a essere set point a ogni allungo', () => {
    is(situazionePeriodo(V, 1, 26, 25).stato, 'palla');
    is(situazionePeriodo(V, 1, 25, 25).stato, 'gioco');
  });

  test('vale anche per l’avversario', () => {
    const s = situazionePeriodo(V, 2, 18, 24);
    is(s.stato, 'palla'); is(s.chi, 'them');
  });

  test('nel quinto set la soglia è 15', () => {
    is(situazionePeriodo(V, 5, 14, 10).stato, 'palla');
    is(situazionePeriodo(V, 5, 14, 10).soglia, 15);
    // a 14 nel primo set non succede niente
    is(situazionePeriodo(V, 1, 14, 10).stato, 'gioco');
  });
});

describe('pallavolo: quando il set è finito', () => {
  test('25-20 è chiuso', () => {
    is(situazionePeriodo(V, 1, 25, 20).stato, 'chiuso');
  });

  test('25-24 non è chiuso: si continua', () => {
    is(situazionePeriodo(V, 1, 25, 24).stato, 'palla');
  });

  test('27-25 è chiuso', () => {
    is(situazionePeriodo(V, 1, 27, 25).stato, 'chiuso');
  });

  test('nel quinto basta 15-13', () => {
    is(situazionePeriodo(V, 5, 15, 13).stato, 'chiuso');
    is(situazionePeriodo(V, 1, 15, 13).stato, 'gioco');
  });
});

describe('pallavolo: la partita', () => {
  const set = (us, them) => ({ us, them });

  test('conta solo i set chiusi', () => {
    const v = periodiVinti([set(25, 20), set(20, 25), set(25, 18)]);
    is(v.us, 2); is(v.them, 1);
  });

  test('è decisa al terzo set vinto', () => {
    const d = partitaDecisa(V, [set(25, 20), set(25, 18), set(25, 22)]);
    ok(d.finita); is(d.chi, 'us');
  });

  test('sul 2-2 non è decisa', () => {
    const d = partitaDecisa(V, [set(25, 20), set(20, 25), set(25, 18), set(18, 25)]);
    is(d.finita, false);
  });

  test('sul 2-0 un set point è match point', () => {
    const chiusi = [set(25, 20), set(25, 18)];
    const s = situazionePeriodo(V, 3, 24, 20);
    is(etichettaPalla(V, s, chiusi), 'match point');
  });

  test('sullo 0-0 un set point è solo un set point', () => {
    const s = situazionePeriodo(V, 1, 24, 20);
    is(etichettaPalla(V, s, []), 'set point');
  });

  test('il set point dell’avversario sul suo 2-0 è match point', () => {
    const chiusi = [set(20, 25), set(18, 25)];
    const s = situazionePeriodo(V, 3, 20, 24);
    is(etichettaPalla(V, s, chiusi), 'match point');
  });
});

describe('pallavolo: punteggi che non possono esistere', () => {
  const perche = (n, us, them) => perchePunteggioImpossibile(V, n, us, them, 'Set');

  test('25-20 va bene', () => is(perche(1, 25, 20), null));
  test('27-25 va bene', () => is(perche(1, 27, 25), null));
  test('15-13 nel quinto va bene', () => is(perche(5, 15, 13), null));

  test('la parità non è un risultato', () => ok(/parit/i.test(perche(1, 24, 24))));
  test('20-18 non chiude un set', () => ok(/25 punti/.test(perche(1, 20, 18))));
  test('25-24 non chiude un set', () => ok(/scarto/.test(perche(1, 25, 24))));
  test('28-25 non esiste', () => ok(/primo scarto/.test(perche(1, 28, 25))));
  test('25-20 nel quinto non esiste', () => ok(/primo scarto/.test(perche(5, 25, 20))));
  test('13-11 non chiude nemmeno il quinto', () => ok(/15 punti/.test(perche(5, 13, 11))));
});

// L'efficienza e' il numero con cui si giudica un'attaccante ovunque, ed e' un
// RAPPORTO: non si somma fra partite, si ricalcola dai totali.
describe('pallavolo: efficienza in attacco', () => {
  const eff = PALLAVOLO.seasonColumns.find(c => c.key === 'eff').calc;

  test('dieci punti e due errori su venticinque palloni fanno 32%', () => {
    is(eff({ kills: 10, attackErrors: 2, attacks: 25 }), 32);
  });

  test('gli stessi dieci punti su sessanta palloni fanno molto meno', () => {
    is(eff({ kills: 10, attackErrors: 2, attacks: 60 }), 13);
  });

  test('più errori che punti danno un numero negativo', () => {
    is(eff({ kills: 2, attackErrors: 6, attacks: 20 }), -20);
  });

  test('senza palloni attaccati non c’è efficienza, e non è zero', () => {
    is(eff({ kills: 0, attackErrors: 0, attacks: 0 }), null);
  });
});

// Ogni attacco alza il totale: e' l'unico modo perche' il denominatore esista.
describe('pallavolo: ogni attacco conta come tentativo', () => {
  const azioni = PALLAVOLO.scout.groups.find(g => g.label === 'Attacco').actions;

  test('i quattro esiti stanno nello stesso gruppo', () => is(azioni.length, 4));

  test('tutti e quattro alzano il totale degli attacchi', () => {
    // Se uno solo non lo alzasse, l'efficienza avrebbe un denominatore più
    // piccolo del vero e direbbe che si attacca meglio di come si attacca.
    azioni.forEach(a => is(a.apply.attacks, 1, a.act + ' non conta un attacco'));
  });

  test('solo il punto fa punto', () => {
    is(azioni.find(a => a.act === 'kill').apply.points, 1);
    ['attack_err', 'attack_pos', 'attack_neg'].forEach(k => {
      is(azioni.find(a => a.act === k).apply.points, undefined);
    });
  });

  test('l’errore in attacco è un punto per loro', () => {
    is(azioni.find(a => a.act === 'attack_err').puntoLoro, true);
  });
});

// La positività in ricezione: quante palle tornano giocabili su quelle
// ricevute. È il secondo numero della pallavolo dopo l'efficienza.
describe('pallavolo: positività in ricezione', () => {
  const pos = PALLAVOLO.seasonColumns.find(c => c.key === 'ricPos').calc;

  test('perfette e positive contano, slash ed errori no', () => {
    is(pos({ recPerf: 6, recPos: 4, recNeg: 8, receptionErrors: 2 }), 50);
  });

  test('tutte perfette fanno cento', () => {
    is(pos({ recPerf: 5, recPos: 0, recNeg: 0, receptionErrors: 0 }), 100);
  });

  test('solo errori fanno zero, non nulla', () => {
    is(pos({ recPerf: 0, recPos: 0, recNeg: 0, receptionErrors: 3 }), 0);
  });

  test('senza ricezioni segnate non si inventa una percentuale', () => {
    is(pos({}), null);
  });
});

/* I QUATTRO FONDAMENTALI, E IL MURO.
 *
 * Servizio, attacco, difesa, ricezione: e' la scansione con cui un allenatore
 * di pallavolo guarda uno scambio. Piu' il muro, che non e' fra i quattro ma
 * chiude uno scambio senza passare dall'attacco — senza un pulsante, un muro
 * punto andrebbe aggiunto a mano e non sarebbe di nessuno.
 *
 * Niente piu' gruppi facoltativi: la ricezione era spenta di serie, adesso e'
 * un fondamentale come gli altri.
 */
describe('pallavolo: i fondamentali', () => {
  const g = PALLAVOLO.scout.groups;

  test('ci sono tutti e cinque, nell’ordine in cui si giocano', () => {
    is(g.map(x => x.label).join(' '), 'Servizio Attacco Difesa Ricezione Muro');
  });

  test('nessun gruppo è più facoltativo', () => {
    is(g.filter(x => x.dettaglio).length, 0);
  });

  test('la ricezione ha i suoi quattro livelli', () => {
    const r = g.find(x => x.label === 'Ricezione').actions.map(a => a.act);
    is(r.join(' '), 'rec_perf rec_pos rec_neg recept_err');
  });

  test('ogni errore è un punto per loro, in tutti i fondamentali', () => {
    // È la regola del gioco, e finora la applicava a mano chi segnava: due
    // tocchi per un evento solo, e quello dimenticato falsava il punteggio.
    ['serve_err', 'attack_err', 'dig_err', 'recept_err'].forEach(k => {
      const a = g.flatMap(x => x.actions).find(x => x.act === k);
      ok(a, k + ' non esiste');
      is(a.puntoLoro, true, k + ' non dà il punto agli avversari');
    });
  });

  test('il muro punto esiste, ed è un punto nostro', () => {
    const b = g.flatMap(x => x.actions).find(x => x.act === 'block');
    is(b.apply.points, 1);
  });
});

/* L'errore in attacco chiede com'è finito.
 *
 * Non chiede CHI come le altre catene: chiede COSA, e la risposta va sullo
 * stesso giocatore. Fuori è una scelta di tiro, murata è una lettura del
 * muro: due correzioni diverse in allenamento, e finora erano lo stesso
 * numero.
 */
describe('pallavolo: com’è finito l’errore', () => {
  const c = PALLAVOLO.scout.chains.comeErrore;

  test('la catena esiste e propone due esiti', () => {
    is(c.opzioni.length, 2);
    is(c.opzioni.map(o => o.act).join(' '), 'att_out att_blocked');
  });

  test('i due esiti si contano separatamente', () => {
    is(c.opzioni.find(o => o.act === 'att_out').apply.attackOut, 1);
    is(c.opzioni.find(o => o.act === 'att_blocked').apply.attackBlocked, 1);
  });

  test('nessuno dei due tocca il punteggio: l’ha già fatto l’errore', () => {
    // L'errore in attacco ha gia' dato il punto agli avversari. Se lo desse
    // anche il dettaglio, ogni errore ne varrebbe due.
    c.opzioni.forEach(o => {
      is(o.apply.points, undefined);
      is(o.puntoLoro, undefined);
    });
  });

  test('si può non rispondere', () => {
    // Chi segna guarda la palla, non sempre il muro: un dato messo a caso
    // vale meno di un dato mancante.
    ok(c.altro);
  });
});

// La positivita' in difesa, come quella in ricezione.
describe('pallavolo: positività in difesa', () => {
  const pos = PALLAVOLO.seasonColumns.find(c => c.key === 'difPos').calc;

  test('solo le positive contano', () => {
    is(pos({ digs: 6, digNeg: 3, digErrors: 1 }), 60);
  });

  test('senza difese non si inventa una percentuale', () => {
    is(pos({}), null);
  });
});

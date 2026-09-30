import { describe, test, is, ok } from './run.mjs';
import { misuraTabella } from '../src/utils/pdf.js';
import { tabellaTabellino, legendaColonne } from '../src/utils/referto.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { BASKET } from '../src/utils/sports/basket.js';
import { CALCIO } from '../src/utils/sports/calcio.js';

/* IL FOGLIO STAMPATO.
 *
 * Tre difetti che non si vedono scrivendo il codice, non li prende il
 * compilatore e non si notano a schermo. Si scoprono solo guardando il PDF —
 * e quello lo guarda l'allenatore, non chi lo ha scritto.
 *
 * 1. DUE CELLE CHE SI TOCCANO. Due celle allineate a destra in colonne vicine
 *    distano `larghezza della colonna meno larghezza del testo`. Nel tabellino
 *    della pallavolo la colonna era larga nove millimetri e «100%» ne occupava
 *    sette e sei: un millimetro e mezzo, meno di uno spazio. Sul foglio si
 *    leggeva «3 100% 100%» come se fosse una cella sola.
 *
 * 2. UNA LEGENDA CHE SPIEGA UNA COLONNA CHE NON C'È. Sotto il tabellino di una
 *    PARTITA finiva la legenda della STAGIONE, che diceva «PG = partite
 *    giocate» accanto a una tabella senza la colonna PG. Chi la cerca e non la
 *    trova smette di fidarsi anche delle altre quattordici.
 *
 * 3. UN TOTALE CHE NON VUOL DIRE NIENTE. La riga della squadra sommava i
 *    numeri di maglia — 172, che non è il numero di nessuno — e i set giocati
 *    di quattordici giocatrici, cinquantasei, in una partita di quattro set.
 */

/* Un finto disegnatore. A `misuraTabella` servono tre cose sole, e la
 * larghezza del testo deve solo crescere in proporzione al corpo: e' quello il
 * conto su cui si basa la riduzione. */
function fintoDoc() {
  let corpo = 10;
  let grassetto = false;
  return {
    setFontSize(s) { corpo = s; return this; },
    setFont(_, stile) { grassetto = stile === 'bold'; return this; },
    /* Due millimetri e un decimo per carattere a dieci punti, e il grassetto
     * un decimo in piu'. Non e' un numero a caso: l'Helvetica vera misura
     * 7,62 mm per «100%» a otto punti e mezzo, e questa formula ne da` 7,14.
     * Serve che l'ordine di grandezza sia quello giusto, altrimenti il test
     * non mette alla prova niente. */
    getTextWidth(t) { return t.length * 2.1 * (corpo / 10) * (grassetto ? 1.1 : 1); }
  };
}

describe('la tabella si rimpicciolisce quando le colonne sono strette', () => {
  const doc = fintoDoc();

  test('una tabella che ci sta resta al corpo pieno', () => {
    const m = misuraTabella(doc, ['A', 'B'], [['1', '2']], [40, 40]);
    is(m.corpo, 8.5);
    is(m.alta, 6.2);
  });

  /* IL CASO SEGNALATO. Colonna da nove millimetri, «100%» dentro. */
  test('una colonna troppo stretta rimpicciolisce tutta la tabella', () => {
    const m = misuraTabella(doc, ['DIF%'], [['100%']], [9]);
    ok(m.corpo < 8.5, 'doveva rimpicciolire, e invece e` rimasto ' + m.corpo);
  });

  test('e il testo, alla fine, lascia il bianco richiesto', () => {
    const larga = 9;
    const m = misuraTabella(doc, ['DIF%'], [['100%']], [larga]);
    doc.setFontSize(m.corpo).setFont('helvetica', 'bold');
    const piuLargo = Math.max(doc.getTextWidth('DIF%'), doc.getTextWidth('100%'));
    // Due celle a destra in colonne vicine distano larghezza meno testo.
    ok(larga - piuLargo >= 2.3, 'restano solo ' + (larga - piuLargo).toFixed(2) + ' mm');
  });

  test('non si ingrandisce mai: una tabella larga resta come era', () => {
    is(misuraTabella(doc, ['A'], [['1']], [90]).corpo, 8.5);
  });

  test('sotto una certa misura si ferma: meglio stretto che illeggibile', () => {
    const m = misuraTabella(doc, ['X'], [['un testo lunghissimo che non ci sta mai']], [6]);
    ok(m.corpo >= 6.2);
  });

  test('l altezza della riga segue il testo, non resta indietro', () => {
    const m = misuraTabella(doc, ['DIF%'], [['100%']], [9]);
    ok(m.alta < 6.2, 'la riga e` rimasta alta come prima: aria sprecata');
    // La proporzione fra testo e riga resta quella di prima.
    ok(Math.abs(m.alta / m.corpo - 6.2 / 8.5) < 0.01);
  });

  test('anche l intestazione conta nella misura, non solo le righe', () => {
    // Nessuna riga e` larga, ma l'intestazione in grassetto si.
    const m = misuraTabella(doc, ['INTESTAZIONE LUNGA'], [['1']], [12]);
    ok(m.corpo < 8.5);
  });

  test('e la riga della squadra, che e in grassetto come l intestazione', () => {
    const m = misuraTabella(doc, ['A'], [['1']], [12], { totale: ['1234567890123456789012345'] });
    ok(m.corpo < 8.5);
  });
});

/* ------------------------------------------------------------- la legenda */

describe('la legenda spiega solo le sigle che stanno in tabella', () => {
  test('la sigla PG non compare nel tabellino di una partita', () => {
    const intestazioni = ['N', 'Giocatore', 'PT', 'AT', 'TOT', 'SET'];
    const l = legendaColonne(PALLAVOLO, intestazioni);
    is(l.includes('PG'), false, 'spiega una colonna che non c’e`: ' + l);
    is(l.includes('P/S'), false);
  });

  test('ma quelle presenti si spiegano tutte', () => {
    const l = legendaColonne(PALLAVOLO, ['N', 'Giocatore', 'AT', 'TOT', 'SET']);
    ok(l.includes('AT = attacchi vincenti'));
    ok(l.includes('TOT = palloni attaccati'));
    ok(l.includes('SET = set giocati'));
  });

  test('nella tabella di stagione, dove PG c e, si spiega', () => {
    ok(legendaColonne(PALLAVOLO, ['PG', 'PT']).includes('PG = partite giocate'));
  });

  test('senza nessuna sigla da spiegare non si stampa niente', () => {
    is(legendaColonne(PALLAVOLO, ['N', 'Giocatore', 'PT']), '');
  });

  test('ogni sport ha il suo glossario, e non quello di un altro', () => {
    ok(legendaColonne(BASKET, ['REB']).includes('rimbalzi'));
    is(legendaColonne(BASKET, ['REB']).includes('attacchi'), false);
    ok(legendaColonne(CALCIO, ['IPS']).includes('specchio'));
  });

  /* La prova che il conto si fa sulle colonne vere e non su un elenco scritto
   * a mano: si costruisce il tabellino e si guarda la legenda che ne esce. */
  test('sul tabellino costruito davvero non avanza nessuna sigla', () => {
    const t = tabellaTabellino(
      { tabellino: [{ number: 5, name: 'Chi Segna', points: 10, attacks: 4, kills: 2 }] },
      PALLAVOLO
    );
    const l = legendaColonne(PALLAVOLO, t.intestazioni);
    Object.keys(PALLAVOLO.glossario).forEach(sigla => {
      if (l.includes(sigla + ' = ')) {
        ok(t.intestazioni.includes(sigla), 'spiegata ma assente: ' + sigla);
      }
    });
    is(l.includes('PG = '), false);
  });
});

/* ------------------------------------------------- i totali che non si sommano */

describe('la riga della squadra', () => {
  const t = tabellaTabellino({
    tabellino: [
      { number: 5, name: 'Una', points: 10, setsPlayed: 4, attacks: 6, kills: 3 },
      { number: 29, name: 'Due', points: 8, setsPlayed: 4, attacks: 4, kills: 2 },
      { number: 138, name: 'Tre', points: 2, setsPlayed: 4, attacks: 2, kills: 1 }
    ]
  }, PALLAVOLO);

  test('non ha un numero di maglia: la somma dei numeri non e il numero di nessuno', () => {
    is(t.totale[0], '');
  });

  test('ma somma i punti, che si sommano', () => {
    is(t.totale[t.intestazioni.indexOf('PT')], '20');
  });

  test('e non somma i set: quattordici per quattro non fanno cinquantasei set', () => {
    is(t.totale[t.intestazioni.indexOf('SET')], '');
  });
});

/* ----------------------------------------------- il numeratore dell anello */

describe('la frazione sotto l anello e quella dell anello', () => {
  /* Sette servizi: tre ace, due rimasti in gioco, due sbagliati. L'anello dice
   * la positivita' — cinque su sette, 71% — mentre accanto ci vanno gli ace e
   * gli errori. Finche' il numeratore era «il primo dei due conteggi accanto»,
   * sotto un anello al 71% finiva scritto «3/7». */
  const t = Object.assign(PALLAVOLO.newStats(), {
    aces: 3, servePos: 2, serveErrors: 2, attacks: 10, kills: 4, attackErrors: 2
  });
  const voci = PALLAVOLO.ciambelle(t);
  const servizio = voci.find(v => v.etichetta === 'Servizio');

  test('il servizio dichiara il suo numeratore', () => {
    is(servizio.v, 5);
    is(servizio.tot, 7);
    is(servizio.pct, 71);
  });

  test('e non e il primo dei due conteggi scritti accanto', () => {
    is(servizio.righe[0][0], 3);
    ok(servizio.v !== servizio.righe[0][0],
      'se fossero uguali questo test non proverebbe niente');
  });

  /* LA REGOLA GENERALE, per tutti e per sempre: la percentuale dentro
   * l'anello deve essere il numeratore diviso il totale. Se una ciambella non
   * la rispetta, il foglio dice due cose diverse nello stesso posto. */
  test('in ogni ciambella di ogni sport la percentuale torna col rapporto', () => {
    const casi = [
      [PALLAVOLO, Object.assign(PALLAVOLO.newStats(), {
        attacks: 39, kills: 16, attackErrors: 5,
        recPerf: 6, recPos: 7, recNeg: 7, receptionErrors: 2,
        digs: 10, digNeg: 5, digErrors: 2,
        aces: 2, servePos: 17, serveErrors: 2
      })],
      [BASKET, Object.assign(BASKET.newStats(), {
        fgm2: 9, fga2: 20, fgm3: 4, fga3: 10, ftm: 7, fta: 10
      })]
    ];
    casi.forEach(([sport, stats]) => {
      (sport.ciambelle(stats) || []).forEach(v => {
        if (!v.tot || v.pct == null) return;
        const numeratore = v.v != null ? v.v : v.righe[0][0];
        is(Math.round((numeratore / v.tot) * 100), v.pct,
          sport.key + '/' + v.etichetta + ': l’anello dice ' + v.pct +
          '% e sotto ci scrive ' + numeratore + '/' + v.tot);
      });
    });
  });
});

/* ------------------------------------------------------- il nome dei periodi */

describe('il plurale dei periodi', () => {
  test('ogni sport lo dichiara, invece di farlo attaccando una i', () => {
    [PALLAVOLO, BASKET, CALCIO].forEach(s => {
      const p = s.scout.period;
      ok(p.plural, s.key + ' non dice come si chiamano al plurale');
      // «periodoi» e` quello che si ottiene aggiungendo una «i» a «periodo»:
      // sul referto del basket c'era scritto proprio cosi`.
      is(p.plural, p.plural.replace(/oi$/, 'i'),
        s.key + ': ' + p.plural + ' non e` un plurale');
    });
  });

  test('e sono quelli giusti', () => {
    is(PALLAVOLO.scout.period.plural, 'Set');
    is(BASKET.scout.period.plural, 'Periodi');
    is(CALCIO.scout.period.plural, 'Tempi');
  });
});

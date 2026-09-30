import { describe, test, is, ok } from './run.mjs';
import { BASKET } from '../src/utils/sports/basket.js';
import { PALLAVOLO } from '../src/utils/sports/pallavolo.js';
import { CALCIO } from '../src/utils/sports/calcio.js';
import { azioneDi } from '../src/utils/referto.js';

/* IL COLLAUDO DELLA CONFIGURAZIONE DELLE AZIONI.
 *
 * Ogni pulsante dello scout è una riga di configurazione: un nome (`act`),
 * cosa aggiunge alle statistiche (`apply`), quanto vale in punti, e che
 * domanda fa dopo (`poi`). Il codice che le applica è generico: prende la riga
 * e la esegue. Non controlla niente.
 *
 * È il posto dove gli errori non fanno rumore. Tre casi, e due sono già
 * successi:
 *
 *   — Una chiave di `apply` scritta male non lancia: crea una statistica nuova
 *     che nessuno leggerà mai. Il tocco sembra preso e il numero non arriva in
 *     nessun tabellino.
 *   — Un `act` che il referto non riesce più a ritrovare fa sparire quelle
 *     azioni dalle statistiche periodo per periodo. È successo con «positivo» e
 *     «negativo» in attacco: i primi set uscivano vuoti dal PDF.
 *   — Un `score` che non corrisponde a quello che `apply` produce fa muovere il
 *     tabellone di un numero diverso dal tabellino.
 *
 * Nessuno di questi si vede provando lo scout a mano per dieci minuti: si
 * vedono a fine partita, sul foglio, quando non c'è più niente da fare.
 */

const SPORT = [['basket', BASKET], ['pallavolo', PALLAVOLO], ['calcio', CALCIO]];
const TONI = ['made', 'miss', 'neutral', 'warn'];

// Tutte le azioni di uno sport: quelle dei pulsanti, quelle delle catene, e le
// opzioni dentro le catene. Sono tutte cose che finiscono applicate a un
// giocatore, quindi vanno controllate tutte.
function tutteLeAzioni(sport) {
  const fuori = [];
  (sport.scout.groups || []).forEach(gr => {
    (gr.actions || []).forEach(a => fuori.push({ a, dove: 'gruppo «' + gr.label + '»', pulsante: true }));
  });
  Object.keys(sport.scout.chains || {}).forEach(k => {
    const c = sport.scout.chains[k];
    if (c.azione) fuori.push({ a: c.azione, dove: 'catena «' + k + '»', pulsante: false });
    (c.opzioni || []).forEach(o => fuori.push({ a: o, dove: 'opzioni di «' + k + '»', pulsante: false }));
  });
  return fuori;
}

describe('la configurazione delle azioni: quello che si applica esiste', () => {
  SPORT.forEach(([nome, sport]) => {
    const azioni = tutteLeAzioni(sport);
    const campi = sport.newStats();

    test(nome + ': ogni chiave di apply esiste nelle statistiche', () => {
      /* IL CASO PIÙ SUBDOLO. Una chiave scritta male non lancia: JavaScript la
       * crea. Il tocco viene preso, il contatore cresce, e quel contatore non
       * lo legge nessuno — perché il tabellino chiede un'altra chiave. */
      const guai = [];
      azioni.forEach(({ a, dove }) => {
        Object.keys(a.apply || {}).forEach(k => {
          if (!(k in campi)) guai.push(a.act + ' (' + dove + ') scrive «' + k + '»');
        });
      });
      ok(guai.length === 0, 'statistiche che non esistono: ' + guai.join(' / '));
    });

    test(nome + ': ogni contenitore di nested esiste e e un oggetto', () => {
      const guai = [];
      azioni.forEach(({ a, dove }) => {
        Object.keys(a.nested || {}).forEach(c => {
          if (!(c in campi)) guai.push(a.act + ' (' + dove + ') scrive dentro «' + c + '»');
          else if (typeof campi[c] !== 'object' || campi[c] === null) {
            guai.push(a.act + ': «' + c + '» non e` un contenitore');
          }
        });
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': ogni azione si ritrova dalla configurazione', () => {
      /* Se `azioneDi` non la ritrova, quell'azione esce dalle statistiche
       * periodo per periodo, dal massimo vantaggio e dai parziali — in
       * silenzio. È il difetto che faceva uscire i primi set vuoti. */
      const persi = azioni.filter(({ a }) => !azioneDi(sport, a.act)).map(({ a, dove }) => a.act + ' (' + dove + ')');
      ok(persi.length === 0, 'il referto non le ritrova: ' + persi.join(' / '));
    });

    test(nome + ': nessun act ripetuto con contenuti diversi', () => {
      /* Due righe con lo stesso nome e due `apply` diversi: il registro
       * contiene il nome, e rileggendolo si trova la prima delle due. Metà
       * delle azioni verrebbero ricostruite sbagliate. */
      const visti = new Map();
      const guai = [];
      azioni.forEach(({ a, dove }) => {
        const firma = JSON.stringify([a.apply || {}, a.nested || {}, a.score || 0, !!a.puntoLoro]);
        if (visti.has(a.act) && visti.get(a.act) !== firma) {
          guai.push(a.act + ' (' + dove + ') non fa la stessa cosa dell’altra con lo stesso nome');
        }
        visti.set(a.act, firma);
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': ogni azione ha nome, etichetta e un tono che esiste', () => {
      const guai = [];
      azioni.forEach(({ a, dove, pulsante }) => {
        if (!a.act) guai.push('senza act in ' + dove);
        if (!a.label) guai.push(a.act + ' senza etichetta');
        if (pulsante && a.tone && !TONI.includes(a.tone)) {
          guai.push(a.act + ' ha il tono «' + a.tone + '», che non esiste');
        }
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': ogni poi indica una catena che c e', () => {
      const catene = Object.keys(sport.scout.chains || {});
      const guai = azioni
        .filter(({ a }) => a.poi && !catene.includes(a.poi))
        .map(({ a }) => a.act + ' chiama la catena «' + a.poi + '», che non esiste');
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': i punti dichiarati sono quelli che le statistiche producono', () => {
      /* `score` è il numero che compare sul gettone appena si tocca: «+3».
       * I punti veri li calcola `sport.score()` da quello che `apply` ha
       * scritto, e il tabellone si muove di quelli. Se una riga dichiara un
       * numero diverso da quello che produce, il riscontro sul gettone e il
       * tabellone dicono due cose differenti nello stesso istante — ed è il
       * riscontro che chi segna usa per capire di aver toccato giusto.
       *
       * Dichiararlo non è obbligatorio: la pallavolo non lo fa, e sul gettone
       * compare l'etichetta («Punto», «Ace») invece di «+1», che lì è più
       * chiaro. Si controlla solo che chi lo dichiara lo dichiari giusto. */
      const guai = [];
      azioni.forEach(({ a, dove }) => {
        if (a.score == null) return;
        const prima = sport.newStats();
        const dopo = sport.newStats();
        Object.entries(a.apply || {}).forEach(([k, v]) => { dopo[k] = (dopo[k] || 0) + v; });
        const veri = sport.score(dopo) - sport.score(prima);
        if (veri !== a.score) {
          guai.push(a.act + ' (' + dove + ') dichiara ' + a.score + ' punti e ne produce ' + veri);
        }
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': un azione che fa punti senza dichiararli non inganna il gettone', () => {
      /* L'altra metà: se un'azione produce punti e NON li dichiara, sul
       * gettone compare la sua etichetta. Va bene solo se l'etichetta dice
       * già che è un punto — «Punto», «Ace», «Muro» — altrimenti chi segna
       * vede un riscontro che non parla di punti mentre il tabellone si
       * muove. */
      const guai = [];
      azioni.forEach(({ a, dove, pulsante }) => {
        if (!pulsante || a.score != null) return;
        const dopo = sport.newStats();
        Object.entries(a.apply || {}).forEach(([k, v]) => { dopo[k] = (dopo[k] || 0) + v; });
        const veri = sport.score(dopo) - sport.score(sport.newStats());
        if (veri > 0 && !/punto|ace|muro|gol|canestro|segnat/i.test(a.label)) {
          guai.push(a.act + ' (' + dove + ') fa ' + veri + ' punti e sul gettone scrive «' + a.label + '»');
        }
      });
      ok(guai.length === 0, guai.join(' / '));
    });

    test(nome + ': ogni catena sa cosa chiedere e come si salta', () => {
      const guai = [];
      Object.keys(sport.scout.chains || {}).forEach(k => {
        const c = sport.scout.chains[k];
        if (!c.titolo) guai.push(k + ' senza titolo');
        // `altro` è la via d'uscita: senza, la domanda non si può saltare.
        if (!c.altro) guai.push(k + ' non si puo` saltare: manca «altro»');
        if (!c.azione && !(c.opzioni && c.opzioni.length)) {
          guai.push(k + ' non ha ne` un’azione ne` delle opzioni');
        }
        if (c.azione && c.opzioni) guai.push(k + ' ha sia un’azione sia delle opzioni');
      });
      ok(guai.length === 0, guai.join(' / '));
    });
  });
});

describe('la pallavolo: i nostri errori sono punti loro', () => {
  const azioni = tutteLeAzioni(PALLAVOLO);

  test('ogni azione che regala il punto e un errore, e viceversa', () => {
    /* La regola del gioco: in pallavolo ogni nostro errore è un punto
     * dell'altra squadra. Se un'azione con `...Errors` non ha `puntoLoro`, quel
     * punto non lo segna nessuno e il set finisce con un punteggio che non
     * torna col tabellone della palestra. */
    const guai = [];
    azioni.forEach(({ a }) => {
      const errore = Object.keys(a.apply || {}).some(k => /Errors$/.test(k));
      if (errore && !a.puntoLoro) guai.push(a.act + ' e` un errore e non da` il punto agli avversari');
      if (a.puntoLoro && !errore) guai.push(a.act + ' da` il punto agli avversari senza essere un errore');
    });
    ok(guai.length === 0, guai.join(' / '));
  });

  test('e nessuna azione fa punto per noi E punto per loro', () => {
    const doppie = azioni.filter(({ a }) => a.puntoLoro && (a.score || 0) > 0).map(({ a }) => a.act);
    is(doppie.length, 0, 'assurdo: ' + doppie.join(', '));
  });

  test('gli attacchi hanno tutti e tre gli esiti, e contano un tentativo ciascuno', () => {
    const gruppo = PALLAVOLO.scout.groups.find(g => g.label === 'Attacco');
    ok(gruppo, 'manca il gruppo Attacco');
    // Punto, errore, difeso: i tre esiti chiesti, e ognuno deve contare un
    // pallone attaccato — altrimenti l'efficienza si calcola su un
    // denominatore sbagliato.
    is(gruppo.actions.length, 3);
    gruppo.actions.forEach(a => {
      is((a.apply || {}).attacks, 1, a.act + ' non conta il pallone attaccato');
    });
  });
});

describe('il basket: le due cose che il segnapunti guarda di continuo', () => {
  test('la voce sul gettone si puo davvero leggere', () => {
    /* `tileStat` è il numero stampato sul gettone del giocatore in campo: è
     * quello che si controlla per accorgersi di aver toccato la persona
     * sbagliata. Se la chiave non si sa ricavare, sul gettone non c'è niente
     * e quel controllo non si può fare. */
    const k = (BASKET.scout.tileStat || {}).key;
    ok(k, 'nessuna voce sul gettone');
    const s = Object.assign(BASKET.newStats(), { fgm2: 3, fgm3: 1 });
    const letto = (k in s) ? s[k] : (BASKET.aggregate[k] ? BASKET.aggregate[k]({ stats: s }) : undefined);
    is(letto, 9, 'sul gettone si legge ' + letto + ' invece di 9');
  });

  test('il bonus falli di squadra e un numero sensato', () => {
    ok(BASKET.scout.teamFouls === true);
    ok(BASKET.scout.teamFoulBonus >= 4 && BASKET.scout.teamFoulBonus <= 6);
  });

  test('i punti che si segnano a mano per gli avversari coprono tutti i casi', () => {
    // Uno, due, tre: non esiste un canestro da quattro.
    is(JSON.stringify(BASKET.scout.manoPunti), JSON.stringify([1, 2, 3]));
  });
});

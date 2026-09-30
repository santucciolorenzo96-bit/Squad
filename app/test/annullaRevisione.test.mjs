import { describe, test, is, ok } from './run.mjs';
import { conStatoDellaRiga, motivoDelRifiuto } from '../src/utils/salvataggio.js';
import { applicaAzione } from '../src/utils/azione.js';
import { calcolaPunteggi } from '../src/utils/punteggio.js';
import { azioneDi } from '../src/utils/referto.js';
import { BASKET } from '../src/utils/sports/basket.js';

/* ANNULLA, E IL DATABASE RISPONDE «LA STA SEGNANDO QUALCUN ALTRO».
 *
 * A un utente solo, su un dispositivo solo, appena premuto Annulla.
 *
 * L'annulla non modifica la partita: la sostituisce con la fotografia scattata
 * PRIMA del tocco. Ma quella fotografia è stata scattata prima anche del
 * salvataggio che è seguito — e dentro c'è la `revisione`, che non è un dato
 * della partita: è lo stato della RIGA sul server, «da quale versione parti».
 *
 * Ripristinandola per intero si tornava indietro anche di una revisione. Il
 * salvataggio dopo l'annulla dichiarava al database una versione che il
 * database aveva già superato, e si sentiva rispondere che qualcun altro era
 * arrivato prima. Non c'era nessun altro: c'era una fotografia vecchia di
 * mezzo secondo.
 *
 * È la seconda volta che questa dimenticanza costa un difetto: la prima fu
 * riprendendo la copia locale all'apertura, per la stessa identica ragione.
 * Per questo la regola adesso sta in un posto solo — IL CONTENUTO DALLA COPIA,
 * LO STATO DELLA RIGA DA ADESSO — e questi test la tengono ferma.
 */

describe('quello che appartiene alla riga non torna indietro con l annulla', () => {
  test('il contenuto viene dalla copia', () => {
    const copia = { teamScore: 10, oppName: 'Giardini Naxos', revisione: 4 };
    const adesso = { teamScore: 13, oppName: 'Giardini Naxos', revisione: 5 };
    const r = conStatoDellaRiga(copia, adesso);
    is(r.teamScore, 10, 'il punteggio doveva tornare a quello di prima');
  });

  test('ma la revisione viene da adesso', () => {
    const r = conStatoDellaRiga({ revisione: 4 }, { revisione: 5 });
    is(r.revisione, 5);
  });

  test('e con lei chi ha tenuto il tabellino, e quando', () => {
    const r = conStatoDellaRiga(
      { revisione: 4, tenutoDa: 'u1', tenutoAlle: 'ieri' },
      { revisione: 9, tenutoDa: 'u2', tenutoAlle: 'adesso' }
    );
    is(r.revisione, 9);
    is(r.tenutoDa, 'u2');
    is(r.tenutoAlle, 'adesso');
  });

  test('la copia non viene toccata: si restituisce una cosa nuova', () => {
    const copia = { revisione: 4, teamScore: 10 };
    const r = conStatoDellaRiga(copia, { revisione: 5 });
    is(copia.revisione, 4, 'la copia e` stata modificata');
    ok(r !== copia);
  });

  test('senza niente da cui prendere, la copia resta com e', () => {
    is(conStatoDellaRiga({ revisione: 4 }, null).revisione, 4);
    is(conStatoDellaRiga({ revisione: 4 }, {}).revisione, 4);
    is(conStatoDellaRiga(null, { revisione: 9 }), null);
  });

  test('una revisione zero e un valore, non un niente', () => {
    // `0` è falso in JavaScript: una guardia scritta male lo scarterebbe, e si
    // tornerebbe a dichiarare la revisione vecchia — cioè al difetto.
    is(conStatoDellaRiga({ revisione: 7 }, { revisione: 0 }).revisione, 0);
  });
});

/* IL GIRO COMPLETO, come succede in partita. */
describe('segna, salva, annulla: il salvataggio dopo non viene rifiutato', () => {
  // Il database, ridotto a quello che conta: una riga con la sua revisione,
  // che accetta di scrivere solo se chi scrive parte da quella giusta.
  function database(revisione = 0) {
    const riga = { status: 'live', revisione, tenuto_da: 'u1', tenuto_alle: 'ora' };
    return {
      riga,
      salva(gioco) {
        if ((gioco.revisione || 0) !== riga.revisione) return null;   // rifiutato
        riga.revisione += 1;
        gioco.revisione = riga.revisione;   // come fa `saveLiveGame`
        return riga.revisione;
      }
    };
  }

  function scout(db) {
    const pila = [];
    let g = {
      id: 'g1', quarter: 1, revisione: db.riga.revisione, periodScores: [], storia: [],
      players: [{ id: 'p0', number: '4', name: 'Chi Segna', onCourt: true, stats: BASKET.newStats() }]
    };
    // Come lo scout, che calcola il punteggio prima di disegnare: senza, la
    // prima fotografia non avrebbe un punteggio da ripristinare.
    calcolaPunteggi(g, BASKET);
    return {
      get g() { return g; },
      segna(act) {
        pila.push(JSON.stringify(g));                       // memorizza()
        applicaAzione({ g, sport: BASKET, giocatore: g.players[0], azione: azioneDi(BASKET, act) });
        return db.salva(g);
      },
      annullaComeEra() {
        g = JSON.parse(pila.pop());
        return db.salva(g);
      },
      annulla() {
        g = conStatoDellaRiga(JSON.parse(pila.pop()), g);
        return db.salva(g);
      }
    };
  }

  test('prima: il salvataggio dopo l annulla veniva rifiutato', () => {
    const db = database();
    const s = scout(db);
    ok(s.segna('fg3_made') != null, 'il primo salvataggio doveva passare');
    is(s.annullaComeEra(), null, 'il rifiuto e` il difetto: senza, questo test non prova niente');
  });

  test('e il rifiuto veniva raccontato come un sorpasso', () => {
    const db = database();
    const s = scout(db);
    s.segna('fg3_made');
    const mia = JSON.parse(JSON.stringify(s.g)).revisione;
    s.annullaComeEra();
    // È la finestra che compariva: «Questa partita la sta segnando qualcun
    // altro». Non c'era nessun altro.
    is(motivoDelRifiuto(db.riga, mia - 1).motivo, 'superata');
  });

  test('adesso: si annulla e il salvataggio passa', () => {
    const db = database();
    const s = scout(db);
    s.segna('fg3_made');
    ok(s.annulla() != null, 'rifiutato di nuovo');
  });

  test('e quello che si salva e la partita annullata', () => {
    const db = database();
    const s = scout(db);
    s.segna('fg3_made');
    is(s.g.teamScore, 3);
    s.annulla();
    is(s.g.teamScore, 0);
    is(s.g.storia.length, 0);
  });

  test('anche annullando tre azioni di fila', () => {
    const db = database();
    const s = scout(db);
    s.segna('fg2_made');
    s.segna('fg3_made');
    s.segna('ft_made');
    is(s.g.teamScore, 6);
    ok(s.annulla() != null, 'primo annulla rifiutato');
    ok(s.annulla() != null, 'secondo annulla rifiutato');
    ok(s.annulla() != null, 'terzo annulla rifiutato');
    is(s.g.teamScore, 0);
  });

  test('e continuando a segnare dopo aver annullato', () => {
    const db = database();
    const s = scout(db);
    s.segna('fg3_made');
    s.annulla();
    ok(s.segna('fg2_made') != null, 'il tocco dopo l’annulla e` stato rifiutato');
    is(s.g.teamScore, 2);
  });
});

/* CHE LA REGOLA CI SIA NON BASTA: DEVE ESSERE CHIAMATA.
 *
 * I test qui sopra provano che `conStatoDellaRiga` fa la cosa giusta. Non
 * provano che l'annulla la usi — e la differenza non è teorica: è esattamente
 * così che il difetto è entrato. La regola era già scritta, a parole, dentro un
 * commento di `Partita.jsx`; l'annulla è stato scritto dopo, senza applicarla.
 *
 * Questi due controlli guardano il codice. Sono grezzi e lo sanno: se un giorno
 * la chiamata cambia nome, falliranno per il motivo sbagliato. Vale lo stesso,
 * perché il posto che proteggono si è già rotto due volte, e un test che
 * fallisce per il motivo sbagliato si legge in trenta secondi — mentre una
 * partita persa no.
 */
import { readFileSync } from 'node:fs';

function corpoDi(percorso, firma) {
  const testo = readFileSync(new URL('../' + percorso, import.meta.url), 'utf8');
  const i = testo.indexOf(firma);
  if (i < 0) return null;
  // Fino alla chiusura della funzione, che in questo file è indentata di due.
  const fine = testo.indexOf('\n  }\n', i);
  return testo.slice(i, fine < 0 ? testo.length : fine);
}

describe('la regola e chiamata dove serve', () => {
  test('l annulla dello scout non ripristina lo stato della riga', () => {
    const corpo = corpoDi('src/next/partitaTracker.jsx', 'function annulla() {');
    ok(corpo, 'non trovo la funzione annulla');
    ok(/conStatoDellaRiga/.test(corpo),
      'l\u2019annulla ripristina la partita senza passare da conStatoDellaRiga: '
      + 'il salvataggio dopo dichiarera` una revisione superata');
  });

  test('e nemmeno la ripresa della copia locale', () => {
    const testo = readFileSync(new URL('../src/next/Partita.jsx', import.meta.url), 'utf8');
    ok(/conStatoDellaRiga\(locale\.gioco/.test(testo),
      'la copia locale torna con la sua revisione vecchia');
  });
});

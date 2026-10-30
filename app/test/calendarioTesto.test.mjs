import { describe, test, is, ok, eq } from './run.mjs';
import { parseMatchesFromLines } from '../src/utils/calendarioTesto.js';

/* LEGGERE IL CALENDARIO FEDERALE.
 *
 * `parseMatchesFromLines` prende le righe di testo di un PDF — o di un testo
 * incollato, che per lei è la stessa cosa — e ne ricava le partite. È la
 * funzione da cui dipende se caricare un calendario funziona o no, ed era
 * senza test.
 *
 * I casi sono scritti sulle forme vere in cui una federazione scrive una
 * riga di calendario: data con le barre o coi punti, anno a due cifre, ora
 * coi due punti o col punto, la giornata scritta in tre modi, il campo dopo
 * «presso». Più i casi in cui NON deve inventare una partita.
 */

const NOI = 'Cestistica Etnea';

describe('una riga di calendario diventa una partita', () => {
  const [m] = parseMatchesFromLines(
    ['1ª giornata 12/10/2026 18:30 Cestistica Etnea - Azzurra Belpasso presso Palestra Nesima'],
    NOI
  );

  test('la data in formato ISO', () => is(m.date, '2026-10-12'));
  test('l’ora con due cifre', () => is(m.time, '18:30'));
  test('la giornata', () => is(m.giornata, 1));
  test('l’avversario, non noi', () => is(m.opponent, 'Azzurra Belpasso'));
  test('e che si gioca in casa, perché il nostro nome è a sinistra', () => is(m.home, true));
  test('il campo, da «presso»', () => is(m.location, 'Palestra Nesima'));
  test('e la riga originale, per poterla controllare', () => ok(m.sourceLine));
});

describe('casa o trasferta lo dice la posizione del nostro nome', () => {
  test('a destra: trasferta', () => {
    const [m] = parseMatchesFromLines(['12/10/2026 Azzurra Belpasso - Cestistica Etnea'], NOI);
    is(m.home, false);
    is(m.opponent, 'Azzurra Belpasso');
  });

  test('e se il nostro nome non c’è, NON SI INDOVINA', () => {
    /* `home` resta null, e deve restare null: una partita salvata «in casa»
     * per supposizione manda la squadra nel posto sbagliato. È lo stesso
     * difetto chiuso in dove.js — un dato mancante mostrato come un fatto. */
    const [m] = parseMatchesFromLines(['12/10/2026 Virtus Ragalna - Basket Point'], NOI);
    is(m.home, null);
  });

  test('il nome parziale basta: le federazioni abbreviano', () => {
    const [m] = parseMatchesFromLines(['12/10/2026 Pol. Cestistica Etnea ASD - Basket Point'], NOI);
    is(m.home, true);
    is(m.opponent, 'Basket Point');
  });
});

describe('le forme in cui una data viene scritta', () => {
  const data = (riga) => (parseMatchesFromLines([riga], NOI)[0] || {}).date;

  test('con le barre', () => is(data('12/10/2026 A - B'), '2026-10-12'));
  test('con i punti', () => is(data('12.10.2026 A - B'), '2026-10-12'));
  test('coi trattini', () => is(data('12-10-2026 A - B'), '2026-10-12'));
  test('con un giorno a una cifra', () => is(data('2/3/2027 A - B'), '2027-03-02'));

  test('con l’anno a due cifre: 26 è il 2026, non il 1926', () => {
    is(data('12/10/26 A - B'), '2026-10-12');
  });
});

describe('le forme in cui una giornata viene scritta', () => {
  const g = (riga) => (parseMatchesFromLines([riga], NOI)[0] || {}).giornata;

  test('«1ª giornata»', () => is(g('1ª giornata 12/10/2026 A - B'), 1));
  test('«Giornata n. 7»', () => is(g('Giornata n. 7 12/10/2026 A - B'), 7));
  test('«12a giornata»', () => is(g('12a giornata 12/10/2026 A - B'), 12));
  test('e senza giornata resta vuota, non diventa 1', () => {
    is(g('12/10/2026 A - B'), null);
  });
});

describe('quando NON c’è una partita, non si inventa', () => {
  /* È la parte che conta più delle altre: una riga inventata finisce in
   * calendario e qualcuno ci va. Meglio dieci righe da aggiungere a mano che
   * una partita che non esiste. */
  test('una riga senza data viene ignorata', () => {
    is(parseMatchesFromLines(['Cestistica Etnea - Azzurra Belpasso'], NOI).length, 0);
  });

  test('una riga senza due squadre separate dal trattino viene ignorata', () => {
    is(parseMatchesFromLines(['12/10/2026 Riposa Cestistica Etnea'], NOI).length, 0);
  });

  test('l’intestazione di un documento non è una partita', () => {
    const righe = [
      'FEDERAZIONE ITALIANA PALLACANESTRO — Comitato Regionale Sicilia',
      'Campionato Divisione Regionale 2 — stagione 2026/2027',
      'Aggiornato al 30/10/2026'
    ];
    // L'ultima riga ha una data ma non due squadre: non deve passare.
    is(parseMatchesFromLines(righe, NOI).length, 0);
  });

  test('niente righe, niente partite', () => {
    eq(parseMatchesFromLines([], NOI), []);
    eq(parseMatchesFromLines(null, NOI), []);
  });
});

describe('un calendario intero', () => {
  const righe = [
    'Campionato DR2 — girone B',
    '1ª giornata',
    '12/10/2026 18:30 Cestistica Etnea - Azzurra Belpasso presso Palestra Nesima',
    '12/10/2026 19:00 Basket Point - Virtus Ragalna',
    '2ª giornata',
    '19/10/2026 18:00 Virtus Ragalna - Cestistica Etnea presso PalaRagalna'
  ];
  const trovate = parseMatchesFromLines(righe, NOI);

  test('trova tutte le partite, anche quelle delle altre squadre', () => {
    // Servono: sono quelle che poi fanno la classifica.
    is(trovate.length, 3);
  });

  test('e riconosce le nostre due', () => {
    is(trovate.filter(m => m.home !== null).length, 2);
  });
});

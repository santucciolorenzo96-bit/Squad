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

  test('«RIPOSA» non e` un avversario', () => {
    /* Nei gironi dispari una squadra per giornata riposa, e la riga lo scrive
     * accanto al suo nome. Letta come una coppia diventerebbe una trasferta
     * contro una societa` che non esiste — e quella partita finisce in
     * calendario, qualcuno ci va, e nessuno la trova sul posto. */
    is(parseMatchesFromLines(['12/10/2026 Riposa Cestistica Etnea'], NOI).length, 0);
    is(parseMatchesFromLines(['12/10/2026 Cestistica Etnea Riposa'], NOI).length, 0);
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

/* ========================================================================= */
/* IL CALENDARIO FEDERALE                                                    */
/* ========================================================================= */
/*
 * Le righe qui sotto sono quelle vere di un PDF della FIP — Divisione
 * Regionale 2 siciliana, stagione 2026/2027 — e questo formato non veniva
 * riconosciuto: zero partite su un calendario intero.
 *
 * Tre differenze rispetto alla forma col trattino, e ognuna da sola bastava:
 * fra le due squadre non c'è nessun separatore (l'unico trattino sta fra la
 * data e l'ora), la giornata sta su una riga a sé, e il campo due righe sotto
 * dopo il numero della gara.
 */

const FIP = [
  'Divisione regionale 2 - Qualificazione',
  '1 Giornata - andata del 2026-11-15',
  'A.S.D. KALKIS A.S.D. MENS SANA MASCALUCIA 13/11/26 - 20:00',
  '002611',
  'PALESTRA - Via Moscatella GIARDINI-NAXOS (ME)',
  'CESTISTICA ETNEA BASKET ASD BP BASKET POINT ACI SANT\'A 15/11/26 - 17:00',
  '002614',
  'PALACATANIA - Corso Indipendenza CATANIA (CT)',
  'pag. 1 di 6',
  '2 Giornata - andata del 2026-11-22',
  'A.S.D. MENS SANA MASCALUCIA CESTISTICA ETNEA BASKET 22/11/26 - 18:00',
  '002616',
  'PALASPORT - Via Wagner 13 MASCALUCIA (CT)',
  '1 Giornata - ritorno del 2027-01-31',
  'ASD BP BASKET POINT ACI SANT\'A CESTISTICA ETNEA BASKET 31/01/27 - 18:00',
  '002632',
  'Polivalente - Via A. Moro ACI SANT\'ANTONIO (CT)',
  'pag. 3 di 6'
];

describe('il calendario federale, senza separatore fra le squadre', () => {
  const trovate = parseMatchesFromLines(FIP, NOI);

  test('le nostre tre partite si riconoscono', () => {
    // La prima riga di ogni giornata è fra altre due squadre: in questo
    // formato non si può sapere dove finisca un nome e cominci l'altro, e si
    // lascia stare invece di tagliare a caso.
    is(trovate.length, 3);
  });

  test('in casa quando il nostro nome apre la riga', () => {
    is(trovate[0].home, true);
    is(trovate[0].date, '2026-11-15');
    is(trovate[0].time, '17:00');
  });

  test('IL NOSTRO NOME PER INTERO LO IMPARA DAL DOCUMENTO', () => {
    /* In anagrafica siamo «Cestistica Etnea», nel PDF «CESTISTICA ETNEA
     * BASKET». Spezzando sul nome breve l'avversario si porterebbe dietro
     * «BASKET»; il nome intero si impara dalle righe in trasferta, dove sta
     * in fondo. */
    is(trovate[0].opponent, 'ASD BP BASKET POINT ACI SANT’A'.replace('’', "'"));
  });

  test('in trasferta quando il nostro nome chiude la riga', () => {
    is(trovate[1].home, false);
    is(trovate[1].opponent, 'A.S.D. MENS SANA MASCALUCIA');
  });

  test('la giornata viene dalla riga che la annuncia', () => {
    is(trovate[0].giornata, 1);
    is(trovate[1].giornata, 2);
  });

  test('IL RITORNO CONTINUA A CONTARE, non ricomincia da uno', () => {
    /* Nel PDF il ritorno riparte da «1 Giornata». Due righe di calendario con
     * la stessa giornata e lo stesso avversario non si distinguono più, né per
     * chi legge né per il codice che collega un risultato alla sua partita. */
    is(trovate[2].giornata, 3);
    is(trovate[2].ritorno, true);
    is(trovate[0].ritorno, false);
  });

  test('il campo viene due righe sotto, saltando il numero della gara', () => {
    is(trovate[0].location, 'PALACATANIA - Corso Indipendenza CATANIA (CT)');
    is(trovate[1].location, 'PALASPORT - Via Wagner 13 MASCALUCIA (CT)');
  });

  test('e il piè di pagina non diventa un campo', () => {
    // «pag. 3 di 6» segue l'ultima partita: senza la guardia finiva scritto
    // come luogo della partita.
    is(trovate[2].location, 'Polivalente - Via A. Moro ACI SANT\'ANTONIO (CT)');
  });
});

describe('senza il nostro nome, un calendario federale non si può spezzare', () => {
  test('nessuna partita, invece di nomi tagliati a caso', () => {
    is(parseMatchesFromLines(FIP, '').length, 0);
    is(parseMatchesFromLines(FIP, 'Squadra Che Non Gioca Qui').length, 0);
  });
});

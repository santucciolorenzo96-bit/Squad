import { describe, test, is, ok, eq } from './run.mjs';
import {
  CAMPO, DURATE, PAUSA_FRA_PASSI, LIMITI, ID_DIFESA,
  schemaVuoto, normalizzaSchema, normalizzaPasso, haLaDifesa,
  statoDopo, pallaDelPasso, puntoPalla, istante, inizioPasso, durataTotale, durataPasso,
  frecce, accorcia, testaFreccia, percorsoOndulato, sbarraBlocco, distanza,
  pulisciEtichetta, etichetteUniche, tutteLeEtichette, filtraSchemi, ordinaSchemi,
  riepilogo, problemiDiPubblicazione,
  conPasso, senzaPasso, spostaPasso, duplicaPasso, spostaGiocatore, impostaMossa, togliMossa,
  impostaPalla, impostaPasso, conDifesa, senzaDifesa, ciSonoMosseDifesa,
  conVariante, senzaVariante, aggiornaVariante, sequenza, conSequenza
} from '../src/utils/schemi.js';

/* GLI SCHEMI DI GIOCO.
 *
 * Il motore e` calcolo puro: la stessa funzione che dice dov'e` il giocatore 3
 * a 1,4 secondi serve al lettore che anima e all'editor che mostra il passo.
 */

const vicino = (a, b, tol = 0.01) => Math.abs(a - b) <= tol;
const passo = (moves, extra) => normalizzaPasso({ moves, ...(extra || {}) }, true);
const m = (x, y, extra) => ({ x, y, tipo: 'taglio', parte: 'subito', ...(extra || {}) });

describe('uno schema vuoto parte da una posizione sensata', () => {
  const s = schemaVuoto();
  test('cinque in attacco, nessun difensore', () => {
    eq(Object.keys(s.start.pos).sort(), ['o1', 'o2', 'o3', 'o4', 'o5']);
    is(haLaDifesa(s), false);
  });
  test('il play ha la palla', () => is(s.start.palla, 'o1'));
  test('con la difesa, un difensore per ciascuno e verso canestro', () => {
    const d = schemaVuoto({ difesa: true });
    is(haLaDifesa(d), true);
    ID_DIFESA.forEach((id, i) => {
      const att = d.start.pos['o' + (i + 1)];
      ok(distanza(d.start.pos[id], CAMPO.canestro) < distanza(att, CAMPO.canestro), id + ' non e` verso canestro');
    });
  });
  test('tutti dentro il campo', () => {
    Object.values(schemaVuoto({ difesa: true }).start.pos).forEach(p => {
      ok(p.x >= 0 && p.x <= CAMPO.w && p.y >= 0 && p.y <= CAMPO.h, JSON.stringify(p));
    });
  });
});

describe('qualunque dato diventa uno schema valido', () => {
  test('niente, o spazzatura, danno uno schema vuoto', () => {
    is(normalizzaSchema(null).steps.length, 0);
    is(normalizzaSchema('non e` json').steps.length, 0);
    is(normalizzaSchema(42).start.palla, 'o1');
  });

  test('una stringa JSON si legge', () => {
    const s = normalizzaSchema(JSON.stringify({ steps: [{ moves: { o1: { x: 50, y: 50 } } }] }));
    is(s.steps.length, 1);
  });

  test('le coordinate fuori dal campo si riportano dentro', () => {
    const s = normalizzaSchema({ start: { pos: { o1: { x: -50, y: 999 } } } });
    is(s.start.pos.o1.x, CAMPO.margine);
    is(s.start.pos.o1.y, CAMPO.h - CAMPO.margine);
  });

  test('un giocatore mancante riprende la posizione base', () => {
    const s = normalizzaSchema({ start: { pos: { o1: { x: 60, y: 60 } } } });
    is(Object.keys(s.start.pos).length, 5);
    is(s.start.pos.o1.x, 60);
  });

  test('la difesa c`e` tutta o non c`e`', () => {
    const quattro = { o1: { x: 1, y: 1 } };
    ID_DIFESA.slice(0, 4).forEach(id => { quattro[id] = { x: 70, y: 70 }; });
    is(haLaDifesa(normalizzaSchema({ start: { pos: quattro } })), false);
    const cinque = { ...quattro, d5: { x: 70, y: 70 } };
    is(haLaDifesa(normalizzaSchema({ start: { pos: cinque } })), true);
  });

  test('una palla di un giocatore che non esiste torna al play', () => {
    is(normalizzaSchema({ start: { palla: 'o9' } }).start.palla, 'o1');
    is(normalizzaSchema({ start: { palla: null } }).start.palla, null);
    is(normalizzaSchema({ start: { palla: 'canestro' } }).start.palla, 'canestro');
  });

  test('un passo: durata e tipo sconosciuti tornano ai valori normali', () => {
    const p = normalizzaPasso({ dur: 'lunghissima', moves: { o1: { x: 50, y: 50, tipo: 'volo', parte: 'mai' } } });
    is(p.dur, 'normale');
    is(p.moves.o1.tipo, 'taglio');
    is(p.moves.o1.parte, 'subito');
  });

  test('i movimenti di giocatori che non esistono si scartano', () => {
    const p = normalizzaPasso({ moves: { o9: { x: 1, y: 1 }, o2: { x: 50, y: 50 } } });
    eq(Object.keys(p.moves), ['o2']);
  });

  test('i difensori si accettano solo se la difesa c`e`', () => {
    is(Object.keys(normalizzaPasso({ moves: { d1: { x: 50, y: 50 } } }, false).moves).length, 0);
    is(Object.keys(normalizzaPasso({ moves: { d1: { x: 50, y: 50 } } }, true).moves).length, 1);
  });

  test('«la palla non cambia» e` l`assenza della chiave, non null', () => {
    ok(!('palla' in normalizzaPasso({})), 'la chiave c`e`');
    is(normalizzaPasso({ palla: null }).palla, null);
    is(normalizzaPasso({ palla: 'o3' }).palla, 'o3');
  });

  test('i limiti: passi e varianti', () => {
    const molti = Array.from({ length: 50 }, () => ({}));
    is(normalizzaSchema({ steps: molti }).steps.length, LIMITI.passi);
    is(normalizzaSchema({ varianti: molti }).varianti.length, LIMITI.varianti);
  });

  test('una variante senza nome ne prende uno', () => {
    is(normalizzaSchema({ varianti: [{}] }).varianti[0].nome, 'Variante 1');
  });

  test('la nota si taglia alla lunghezza consentita', () => {
    is(normalizzaPasso({ nota: 'x'.repeat(1000) }).nota.length, LIMITI.nota);
  });
});

describe('dove sono tutti dopo un certo passo', () => {
  const start = { pos: { o1: { x: 75, y: 100 }, o2: { x: 120, y: 70 } }, palla: 'o1' };
  const steps = [
    passo({ o2: m(100, 40) }, { palla: 'o2' }),
    passo({ o1: m(60, 60) })
  ];

  test('con zero passi e` la partenza', () => {
    is(statoDopo(start, steps, 0).pos.o2.x, 120);
  });
  test('un passo sposta chi si muove e lascia gli altri', () => {
    const s = statoDopo(start, steps, 1);
    is(s.pos.o2.x, 100);
    is(s.pos.o1.x, 75);
  });
  test('i passi si sommano', () => {
    const s = statoDopo(start, steps, 2);
    is(s.pos.o1.x, 60);
    is(s.pos.o2.x, 100);
  });
  test('la palla passa quando lo dice un passo, e resta dove e`', () => {
    is(statoDopo(start, steps, 0).palla, 'o1');
    is(statoDopo(start, steps, 1).palla, 'o2');
    is(statoDopo(start, steps, 2).palla, 'o2');
  });
  test('chi la aveva prima e chi la ha dopo', () => {
    eq(pallaDelPasso(start, steps, 0), { prima: 'o1', dopo: 'o2' });
    eq(pallaDelPasso(start, steps, 1), { prima: 'o2', dopo: 'o2' });
  });
  test('non si muta lo schema originale', () => {
    statoDopo(start, steps, 2);
    is(start.pos.o1.x, 75);
  });
  test('la palla si disegna accanto al giocatore, e a canestro sul tiro', () => {
    const p = puntoPalla(start.pos, 'o1');
    ok(p.x > 75 && p.y > 100);
    eq(puntoPalla(start.pos, 'canestro'), CAMPO.canestro);
    is(puntoPalla(start.pos, null), null);
    is(puntoPalla(start.pos, 'o7'), null);
  });
});

describe('il tempo', () => {
  const start = { pos: { o1: { x: 0 + 10, y: 100 }, o2: { x: 120, y: 70 } }, palla: 'o1' };
  const normale = passo({ o2: m(20, 70) });
  const lento = passo({}, { dur: 'lenta' });

  test('durata di un passo e inizio del successivo, con la pausa', () => {
    is(durataPasso(normale), DURATE.normale);
    is(inizioPasso([normale, lento], 1), DURATE.normale + PAUSA_FRA_PASSI);
    is(durataTotale([normale, lento]), DURATE.normale + PAUSA_FRA_PASSI + DURATE.lenta + PAUSA_FRA_PASSI);
  });
  test('senza passi la durata e` zero', () => is(durataTotale([]), 0));
});

describe('il fotogramma a un certo istante', () => {
  const start = { pos: { o1: { x: 10, y: 100 }, o2: { x: 120, y: 70 }, o3: { x: 30, y: 30 } }, palla: 'o1' };

  test('al tempo zero sono tutti alla partenza', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], 0);
    is(f.pos.o2.x, 120);
    is(f.passo, 0);
  });

  test('a meta` del passo il movimento e` a meta` (con l`andamento dolce, simmetrico)', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], DURATE.normale / 2);
    ok(vicino(f.pos.o2.x, 70, 0.5), 'x = ' + f.pos.o2.x);
  });

  test('a fine passo e` arrivato', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], DURATE.normale);
    ok(vicino(f.pos.o2.x, 20), 'x = ' + f.pos.o2.x);
  });

  test('durante la pausa resta arrivato', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], DURATE.normale + PAUSA_FRA_PASSI / 2);
    ok(vicino(f.pos.o2.x, 20));
    is(f.inMoto, false);
  });

  test('chi non si muove non si muove', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], 700);
    is(f.pos.o3.x, 30);
  });

  test('il secondo passo parte da dove il primo ha lasciato', () => {
    const steps = [passo({ o2: m(20, 70) }), passo({ o2: m(20, 20) })];
    const f = istante(start, steps, inizioPasso(steps, 1));
    ok(vicino(f.pos.o2.x, 20) && vicino(f.pos.o2.y, 70), JSON.stringify(f.pos.o2));
    is(f.passo, 1);
  });

  test('«parte dopo» sta fermo fino al 35% del passo, poi arriva comunque in fondo', () => {
    const steps = [passo({ o2: m(20, 70, { parte: 'dopo' }) })];
    const prima = istante(start, steps, DURATE.normale * 0.3);
    is(prima.pos.o2.x, 120);
    const fine = istante(start, steps, DURATE.normale);
    ok(vicino(fine.pos.o2.x, 20));
  });

  test('«piu` tardi» parte dopo di «dopo»', () => {
    const t = DURATE.normale * 0.5;
    const d = istante(start, [passo({ o2: m(20, 70, { parte: 'dopo' }) })], t).pos.o2.x;
    const tardi = istante(start, [passo({ o2: m(20, 70, { parte: 'tardi' }) })], t).pos.o2.x;
    ok(tardi > d, 'tardi non e` piu` indietro');
  });

  test('oltre la fine resta alla fine', () => {
    const f = istante(start, [passo({ o2: m(20, 70) })], 999999);
    ok(vicino(f.pos.o2.x, 20));
  });

  test('un tempo negativo vale zero', () => {
    is(istante(start, [passo({ o2: m(20, 70) })], -50).pos.o2.x, 120);
  });

  test('senza passi c`e` solo la partenza', () => {
    const f = istante(start, [], 500);
    is(f.passo, -1);
    is(f.pos.o2.x, 120);
    ok(f.palla !== null);
  });

  test('la palla vola dal passatore al ricevitore durante il passo', () => {
    const steps = [passo({}, { palla: 'o2' })];
    const inizio = istante(start, steps, 0).palla;
    const meta = istante(start, steps, DURATE.normale / 2).palla;
    const fine = istante(start, steps, DURATE.normale).palla;
    ok(inizio.x < meta.x && meta.x < fine.x, 'non va da o1 a o2');
    ok(vicino(fine.x, 120 + 6.5, 0.1));
  });

  test('chi palleggia porta la palla con se`', () => {
    const steps = [passo({ o1: m(60, 60, { tipo: 'palleggio' }) })];
    const f = istante(start, steps, DURATE.normale);
    ok(vicino(f.palla.x, 60 + 6.5, 0.1));
  });

  test('un tiro porta la palla a canestro', () => {
    const steps = [passo({}, { palla: 'canestro' })];
    const f = istante(start, steps, DURATE.normale);
    ok(vicino(f.palla.x, CAMPO.canestro.x, 0.1) && vicino(f.palla.y, CAMPO.canestro.y, 0.1));
  });

  test('con palla di nessuno non si disegna', () => {
    const f = istante({ ...start, palla: null }, [passo({})], 100);
    is(f.palla, null);
  });
});

describe('le frecce di un passo', () => {
  const start = { pos: { o1: { x: 75, y: 100 }, o2: { x: 120, y: 70 }, o3: { x: 30, y: 30 } }, palla: 'o1' };

  test('una per chi si muove davvero', () => {
    const f = frecce(start, [passo({ o2: m(100, 40, { tipo: 'palleggio' }) })], 0);
    is(f.movimenti.length, 1);
    is(f.movimenti[0].tipo, 'palleggio');
    is(f.movimenti[0].da.x, 120);
    is(f.movimenti[0].a.x, 100);
  });

  test('uno spostamento minuscolo non si disegna', () => {
    is(frecce(start, [passo({ o2: m(120.5, 70.5) })], 0).movimenti.length, 0);
  });

  test('un passaggio va dalla posizione di chi passa a quella di chi riceve', () => {
    const f = frecce(start, [passo({ o2: m(100, 40) }, { palla: 'o2' })], 0);
    eq(f.passaggio.da, { x: 75, y: 100 });
    eq(f.passaggio.a, { x: 100, y: 40 });
    is(f.passaggio.tiro, false);
  });

  test('un tiro va da chi tira a canestro', () => {
    const f = frecce(start, [passo({}, { palla: 'canestro' })], 0);
    is(f.passaggio.tiro, true);
    eq(f.passaggio.a, CAMPO.canestro);
  });

  test('senza cambio palla niente passaggio', () => {
    is(frecce(start, [passo({ o2: m(100, 40) })], 0).passaggio, null);
  });

  test('un passo che non esiste non da` niente', () => {
    eq(frecce(start, [], 3), { movimenti: [], passaggio: null });
  });
});

describe('la geometria delle frecce', () => {
  test('accorciare ferma la freccia prima del giocatore', () => {
    const p = accorcia({ x: 0, y: 0 }, { x: 100, y: 0 }, 10);
    ok(vicino(p.x, 90));
  });
  test('ma non oltre la partenza', () => {
    const p = accorcia({ x: 0, y: 0 }, { x: 5, y: 0 }, 10);
    is(p.x, 5);
  });
  test('la punta ha tre vertici, il primo e` l`arrivo', () => {
    const pts = testaFreccia({ x: 0, y: 0 }, { x: 50, y: 0 }).split(' ');
    is(pts.length, 3);
    is(pts[0], '50.0,0.0');
  });
  test('il palleggio ondulato e` un percorso valido e comincia dalla partenza', () => {
    const d = percorsoOndulato({ x: 10, y: 10 }, { x: 80, y: 60 });
    ok(d.startsWith('M10.0 10.0 Q'), d);
    ok(!/NaN/.test(d), d);
    ok((d.match(/Q/g) || []).length >= 2);
  });
  test('anche con partenza e arrivo uguali non esplode', () => {
    ok(!/NaN/.test(percorsoOndulato({ x: 5, y: 5 }, { x: 5, y: 5 })));
    ok(!/NaN/.test(testaFreccia({ x: 5, y: 5 }, { x: 5, y: 5 })));
  });
  test('la sbarra del blocco e` perpendicolare e lunga il doppio della meta`', () => {
    const b = sbarraBlocco({ x: 0, y: 0 }, { x: 50, y: 0 }, 5);
    ok(vicino(b.x1, 50) && vicino(b.x2, 50));
    ok(vicino(Math.abs(b.y1 - b.y2), 10));
  });
});

describe('le etichette', () => {
  test('si puliscono: spazi, cancelletto, lunghezza', () => {
    is(pulisciEtichetta('  #Rimessa   laterale '), 'Rimessa laterale');
    is(pulisciEtichetta('x'.repeat(100)).length, LIMITI.lunghezzaEtichetta);
    is(pulisciEtichetta(null), '');
  });
  test('senza doppioni, maiuscole a parte: la prima scrittura vince', () => {
    eq(etichetteUniche(['Rimessa', 'rimessa', ' RIMESSA ', 'Zona']), ['Rimessa', 'Zona']);
  });
  test('senza vuote e nel numero consentito', () => {
    eq(etichetteUniche(['', '  ', '#']), []);
    is(etichetteUniche(Array.from({ length: 30 }, (_, i) => 'e' + i)).length, LIMITI.etichette);
  });
  test('le piu` usate per prime', () => {
    const t = tutteLeEtichette([
      { labels: ['Attacco', 'Rimessa'] },
      { labels: ['attacco'] },
      { labels: ['Difesa'] }
    ]);
    is(t[0].nome, 'Attacco');
    is(t[0].n, 2);
    eq(t.map(x => x.nome).slice(1), ['Difesa', 'Rimessa']);
  });
  test('niente schemi, niente etichette', () => {
    eq(tutteLeEtichette([]), []);
    eq(tutteLeEtichette(null), []);
  });
});

describe('il filtro restringe', () => {
  const lista = [
    { title: 'Rimessa 1', labels: ['Attacco', 'Rimessa'] },
    { title: 'Flex', labels: ['Attacco'] },
    { title: 'Zona 2-3', labels: ['Difesa'] }
  ];
  test('senza filtro, tutto', () => is(filtraSchemi(lista).length, 3));
  test('una etichetta', () => is(filtraSchemi(lista, ['attacco']).length, 2));
  test('due etichette: le hanno TUTTE E DUE', () => {
    eq(filtraSchemi(lista, ['Attacco', 'Rimessa']).map(s => s.title), ['Rimessa 1']);
  });
  test('un`etichetta che non c`e`: niente', () => is(filtraSchemi(lista, ['Pressing']).length, 0));
  test('la ricerca guarda il titolo', () => {
    eq(filtraSchemi(lista, [], 'flex').map(s => s.title), ['Flex']);
  });
  test('filtro e ricerca insieme', () => is(filtraSchemi(lista, ['Difesa'], 'flex').length, 0));
  test('righe vuote non fanno cadere niente', () => is(filtraSchemi([null, lista[0]], []).length, 1));
  test('si ordinano dal piu` recente, senza toccare l`originale', () => {
    const l = [{ id: 'a', updated_at: '2026-01-01' }, { id: 'b', updated_at: '2026-03-01' }];
    eq(ordinaSchemi(l).map(x => x.id), ['b', 'a']);
    is(l[0].id, 'a');
  });
});

describe('cosa manca per pubblicare', () => {
  const s = normalizzaSchema({ steps: [{ moves: { o1: { x: 50, y: 50 } } }] });
  test('uno schema completo si puo` pubblicare', () => {
    eq(problemiDiPubblicazione({ titolo: 'Flex', schema: s }), []);
  });
  test('senza nome no', () => {
    ok(problemiDiPubblicazione({ titolo: '  ', schema: s }).length === 1);
  });
  test('senza passi no: gli atleti vedrebbero solo la partenza', () => {
    ok(problemiDiPubblicazione({ titolo: 'Flex', schema: schemaVuoto() }).length === 1);
  });
  test('una variante vuota si nomina', () => {
    const conV = conVariante(s, 'Aiuto dal lato debole').schema;
    const p = problemiDiPubblicazione({ titolo: 'Flex', schema: conV });
    ok(p.length === 1 && /Aiuto dal lato debole/.test(p[0]), p.join('|'));
  });
  test('il riepilogo conta passi e varianti', () => {
    eq(riepilogo(s), { passi: 1, varianti: 0 });
  });
});

describe('le modifiche dell`editor', () => {
  const start = schemaVuoto().start;

  test('al passo -1 si sposta la partenza', () => {
    const r = spostaGiocatore(start, [], -1, 'o1', 60, 90);
    is(r.start.pos.o1.x, 60);
    is(start.pos.o1.x, 75);
  });

  test('da un passo in poi si registra l`arrivo, con tipo e ritardo di base', () => {
    const r = spostaGiocatore(start, [passo({})], 0, 'o2', 100, 30);
    eq(r.steps[0].moves.o2, { x: 100, y: 30, tipo: 'taglio', parte: 'subito' });
  });

  test('ri-trascinare lo stesso giocatore conserva tipo e ritardo scelti', () => {
    let r = spostaGiocatore(start, [passo({})], 0, 'o2', 100, 30);
    r = { ...r, steps: impostaMossa(r.steps, 0, 'o2', { tipo: 'blocco', parte: 'dopo' }) };
    r = spostaGiocatore(r.start, r.steps, 0, 'o2', 90, 35);
    is(r.steps[0].moves.o2.tipo, 'blocco');
    is(r.steps[0].moves.o2.parte, 'dopo');
    is(r.steps[0].moves.o2.x, 90);
  });

  test('riportare un giocatore dov`era cancella il movimento', () => {
    let r = spostaGiocatore(start, [passo({})], 0, 'o2', 100, 30);
    r = spostaGiocatore(r.start, r.steps, 0, 'o2', start.pos.o2.x + 0.5, start.pos.o2.y);
    is(Object.keys(r.steps[0].moves).length, 0);
  });

  test('«dov`era» e` dove l`aveva lasciato il passo prima', () => {
    let r = spostaGiocatore(start, [passo({}), passo({})], 0, 'o2', 100, 30);
    r = spostaGiocatore(r.start, r.steps, 1, 'o2', 100.4, 30.4);
    is(Object.keys(r.steps[1].moves).length, 0);
  });

  test('fuori dal campo si riporta dentro', () => {
    const r = spostaGiocatore(start, [passo({})], 0, 'o2', -20, 500);
    is(r.steps[0].moves.o2.x, CAMPO.margine);
    is(r.steps[0].moves.o2.y, CAMPO.h - CAMPO.margine);
  });

  test('un giocatore che non c`e` non cambia niente', () => {
    const r = spostaGiocatore(start, [passo({})], 0, 'd3', 50, 50);
    is(Object.keys(r.steps[0].moves).length, 0);
  });

  test('togliere un movimento', () => {
    const steps = [passo({ o2: m(100, 30) })];
    is(Object.keys(togliMossa(steps, 0, 'o2')[0].moves).length, 0);
    is(togliMossa(steps, 0, 'o5'), steps);
  });

  test('impostaMossa ignora valori sconosciuti', () => {
    const steps = [passo({ o2: m(100, 30) })];
    is(impostaMossa(steps, 0, 'o2', { tipo: 'volo', parte: 'mai' })[0].moves.o2.tipo, 'taglio');
  });

  test('la palla: stessa mano di prima vuol dire «non cambia»', () => {
    let r = impostaPalla(start, [passo({})], 0, 'o3');
    is(r.steps[0].palla, 'o3');
    r = impostaPalla(r.start, r.steps, 0, 'o1');
    ok(!('palla' in r.steps[0]), 'la chiave e` rimasta');
  });

  test('la palla al passo -1 e` quella di partenza', () => {
    is(impostaPalla(start, [], -1, 'o4').start.palla, 'o4');
  });

  test('impostaPasso: durata, nota, ritardo del passaggio', () => {
    const r = impostaPasso([passo({})], 0, { dur: 'lenta', nota: 'Il 4 blocca', ritardoPalla: 'dopo' })[0];
    is(r.dur, 'lenta');
    is(r.nota, 'Il 4 blocca');
    is(r.ritardoPalla, 'dopo');
    is(impostaPasso([passo({})], 0, { dur: 'boh' })[0].dur, 'normale');
  });

  test('aggiungere, togliere, spostare, duplicare passi', () => {
    let s = conPasso([], {});
    s = conPasso(s, {});
    is(s.length, 2);
    is(senzaPasso(s, 0).length, 1);
    const a = s[0].id;
    is(spostaPasso(s, 0, 1)[1].id, a);
    is(spostaPasso(s, 0, 9), s);
    const d = duplicaPasso([passo({ o2: m(100, 30) })], 0);
    is(d.length, 2);
    ok(d[0].id !== d[1].id, 'stesso id');
    d[1].moves.o2.x = 1;
    is(d[0].moves.o2.x, 100);
  });

  test('non si superano i passi consentiti', () => {
    let s = [];
    for (let i = 0; i < LIMITI.passi + 5; i++) s = conPasso(s, {});
    is(s.length, LIMITI.passi);
    is(duplicaPasso(s, 0).length, LIMITI.passi);
  });
});

describe('la difesa si accende e si spegne', () => {
  test('accesa, ci sono i cinque difensori', () => {
    is(haLaDifesa(conDifesa(schemaVuoto())), true);
  });
  test('accenderla due volte non cambia niente', () => {
    const d = conDifesa(schemaVuoto());
    is(conDifesa(d), d);
  });
  test('spenta, spariscono anche i loro movimenti, in tutte le sequenze', () => {
    let s = conDifesa(schemaVuoto());
    s = { ...s, steps: [passo({ d1: m(60, 60), o1: m(70, 70) })], varianti: [{ id: 'v1', nome: 'V', condizione: '', steps: [passo({ d2: m(50, 50) })] }] };
    is(ciSonoMosseDifesa(s), true);
    const spenta = senzaDifesa(s);
    is(haLaDifesa(spenta), false);
    is(ciSonoMosseDifesa(spenta), false);
    is(Object.keys(spenta.steps[0].moves).join(), 'o1');
  });
  test('senza difensori non c`e` niente da perdere', () => {
    is(ciSonoMosseDifesa(schemaVuoto()), false);
  });
});

describe('le varianti', () => {
  test('si aggiungono con un nome', () => {
    const { schema, id } = conVariante(schemaVuoto(), 'Aiuto');
    is(schema.varianti.length, 1);
    is(schema.varianti[0].nome, 'Aiuto');
    is(schema.varianti[0].id, id);
  });
  test('senza nome ne prendono uno numerato', () => {
    is(conVariante(schemaVuoto()).schema.varianti[0].nome, 'Variante 1');
  });
  test('non oltre il limite', () => {
    let s = schemaVuoto();
    for (let i = 0; i < LIMITI.varianti + 3; i++) s = conVariante(s).schema;
    is(s.varianti.length, LIMITI.varianti);
    is(conVariante(s).id, null);
  });
  test('si aggiornano e si tolgono', () => {
    const { schema, id } = conVariante(schemaVuoto(), 'A');
    const agg = aggiornaVariante(schema, id, { nome: 'B', condizione: 'se il 5 esce' });
    is(agg.varianti[0].nome, 'B');
    is(agg.varianti[0].condizione, 'se il 5 esce');
    is(senzaVariante(agg, id).varianti.length, 0);
  });
  test('la sequenza e` la base o quella della variante', () => {
    let { schema, id } = conVariante(schemaVuoto(), 'A');
    schema = conSequenza(schema, null, [passo({})]);
    schema = conSequenza(schema, id, [passo({}), passo({})]);
    is(sequenza(schema, null).length, 1);
    is(sequenza(schema, id).length, 2);
    is(sequenza(schema, 'inesistente').length, 1);
  });
  test('tutte le varianti partono dalla stessa posizione', () => {
    const { schema } = conVariante(schemaVuoto(), 'A');
    ok(schema.start === schemaVuoto().start || JSON.stringify(schema.start) === JSON.stringify(schemaVuoto().start));
  });
});

import { describe, test, is } from './run.mjs';
import {
  normalizeLocation, toMinutes, occupiedRange, findLocationConflicts, findAllConflicts
} from '../src/utils/conflicts.js';

const t = (o) => Object.assign({ date: '2026-09-10', location: 'Palestra Comunale', start_time: '19:00', end_time: '20:30' }, o);

describe('luogo — normalizzazione', () => {
  test('la stessa palestra scritta in tre modi resta la stessa', () => {
    const a = normalizeLocation('Palestra Comunale');
    is(normalizeLocation('palestra comunale'), a);
    is(normalizeLocation('  Palestra   Comunale  '), a);
    is(normalizeLocation('Palestra, Comunale'), a);
  });
  test('due palestre diverse restano diverse', () => {
    is(normalizeLocation('Palestra Nord') === normalizeLocation('Palestra Sud'), false);
  });
});

describe('orari', () => {
  test('accetta le grafie che si usano davvero su un telefono', () => {
    is(toMinutes('19:30'), 1170);
    is(toMinutes('19.30'), 1170);
    is(toMinutes('1930'), 1170);
    is(toMinutes('09:05'), 545);
  });
  test('rifiuta quello che non è un orario', () => {
    is(toMinutes('25:00'), null);
    is(toMinutes('19:70'), null);
    is(toMinutes('sera'), null);
    is(toMinutes(''), null);
  });

  // Senza orario di fine nessuna sovrapposizione verrebbe mai rilevata: si
  // assume un'ora e mezza, che è la durata di un allenamento.
  test('senza orario di fine assume un\'ora e mezza', () => {
    is(occupiedRange({ start_time: '19:00', end_time: null }).end, 19 * 60 + 90);
  });
  test('un orario di fine precedente all\'inizio viene ignorato', () => {
    is(occupiedRange({ start_time: '19:00', end_time: '18:00' }).end, 19 * 60 + 90);
  });
});

describe('sovrapposizioni fra categorie', () => {
  test('stesso posto, orari che si accavallano', () => {
    const c = findLocationConflicts(t({ id: 'a' }), [t({ id: 'b', start_time: '20:00', end_time: '21:30' })]);
    is(c.length, 1);
  });

  test('stesso posto ma uno dopo l\'altro va bene', () => {
    const c = findLocationConflicts(t({ id: 'a' }), [t({ id: 'b', start_time: '20:30', end_time: '22:00' })]);
    is(c.length, 0);
  });

  test('stessa ora ma palestre diverse non è un problema', () => {
    const c = findLocationConflicts(t({ id: 'a' }), [t({ id: 'b', location: 'Palestra Nord' })]);
    is(c.length, 0);
  });

  test('riconosce il conflitto anche con grafie diverse dello stesso posto', () => {
    const c = findLocationConflicts(t({ id: 'a' }), [t({ id: 'b', location: '  palestra comunale ' })]);
    is(c.length, 1);
  });

  test('un allenamento non va in conflitto con se stesso', () => {
    const uno = t({ id: 'a' });
    is(findLocationConflicts(uno, [uno]).length, 0);
  });

  test('giorni diversi non si toccano', () => {
    const c = findLocationConflicts(t({ id: 'a' }), [t({ id: 'b', date: '2026-09-11' })]);
    is(c.length, 0);
  });

  test('senza luogo o senza orario non si conclude niente', () => {
    is(findLocationConflicts(t({ id: 'a', location: null }), [t({ id: 'b' })]).length, 0);
    is(findLocationConflicts(t({ id: 'a', start_time: null }), [t({ id: 'b' })]).length, 0);
  });
});

describe('elenco completo dei conflitti', () => {
  test('ogni coppia compare una volta sola', () => {
    const coppie = findAllConflicts([
      t({ id: 'a' }), t({ id: 'b', start_time: '19:30' }), t({ id: 'c', location: 'Altrove' })
    ]);
    is(coppie.length, 1);
    is(coppie[0][0].id, 'a');
    is(coppie[0][1].id, 'b');
  });

  test('tre categorie nello stesso posto fanno tre coppie', () => {
    const coppie = findAllConflicts([
      t({ id: 'a' }), t({ id: 'b', start_time: '19:15' }), t({ id: 'c', start_time: '19:30' })
    ]);
    is(coppie.length, 3);
  });
});

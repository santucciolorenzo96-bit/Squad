import { describe, test, is, ok } from './run.mjs';
import { somiglianza, proponiAtleta, altriCandidati } from '../src/utils/iscritti.js';

/* Chi si registra scrive il nome del proprio atleta e un amministratore
 * conferma. Questi test guardano la parte che gli risparmia il lavoro — e
 * soprattutto guardano che NON proponga quando non è sicura: chi conferma con
 * un tocco si fida del tocco, e collegare un genitore al figlio di un altro è
 * un errore che nessuno andrà a ricontrollare. */

const ROSA = [
  { id: 'a', name: 'Lorenzo Santuccio' },
  { id: 'b', name: 'Dario Moré' },
  { id: 'c', name: 'Mario José Barone' },
  { id: 'd', name: 'Antonio Camunita' },
  { id: 'e', name: 'Antonio Agrifoglio' },
  { id: 'f', name: 'Giorgio Licciardello' }
];

describe('quanto due nomi si somigliano', () => {
  test('lo stesso nome fa uno', () => {
    is(somiglianza('Dario Moré', 'Dario Moré'), 1);
  });

  test('l ordine non conta: e la stessa persona scritta da due persone', () => {
    is(somiglianza('Moré Dario', 'Dario Moré'), 1);
  });

  test('accenti e maiuscole nemmeno', () => {
    is(somiglianza('dario more', 'Dario Moré'), 1);
  });

  test('un nome doppio si somiglia a meta: e un candidato, non una certezza', () => {
    ok(somiglianza('Mario Barone', 'Mario José Barone') < 1);
    ok(somiglianza('Mario Barone', 'Mario José Barone') > 0.5);
  });

  test('due nomi diversi fanno zero', () => {
    is(somiglianza('Luca Verdi', 'Dario Moré'), 0);
  });

  test('il vuoto non somiglia a niente', () => {
    is(somiglianza('', 'Dario Moré'), 0);
    is(somiglianza('Dario Moré', null), 0);
  });
});

describe('quale atleta intendeva', () => {
  test('il nome esatto', () => {
    is(proponiAtleta('Dario Moré', ROSA).id, 'b');
  });

  test('scritto al contrario e senza accenti, come lo scrive un genitore di fretta', () => {
    is(proponiAtleta('more dario', ROSA).id, 'b');
  });

  test('con una virgola in mezzo', () => {
    is(proponiAtleta('Santuccio, Lorenzo', ROSA).id, 'a');
  });

  test('il nome doppio scritto per intero', () => {
    is(proponiAtleta('Mario José Barone', ROSA).id, 'c');
  });

  /* IL CASO CHE CONTA. Due Antonio in rosa: «Antonio» da solo somiglia uguale
   * a tutti e due, e proporne uno vorrebbe dire sceglierlo a caso. Meglio non
   * proporre: l'amministratore sceglie, e ci mette tre secondi. */
  test('due che somigliano uguale non producono una scelta a caso', () => {
    is(proponiAtleta('Antonio', ROSA), null);
  });

  test('ma con il cognome si decide', () => {
    is(proponiAtleta('Antonio Camunita', ROSA).id, 'd');
  });

  test('un nome che non c e non propone niente', () => {
    is(proponiAtleta('Luca Verdi', ROSA), null);
  });

  test('e nemmeno una sola lettera in comune basta', () => {
    is(proponiAtleta('a', ROSA), null);
  });

  test('senza niente scritto, niente proposta', () => {
    is(proponiAtleta('', ROSA), null);
    is(proponiAtleta(null, ROSA), null);
  });

  test('una rosa vuota non propone', () => {
    is(proponiAtleta('Dario Moré', []), null);
  });
});

describe('gli altri candidati, per correggere senza cercare', () => {
  test('non ricomprendono il proposto', () => {
    const altri = altriCandidati('Antonio Camunita', ROSA);
    is(altri.some(p => p.id === 'd'), false);
  });

  test('ma ricomprendono l omonimo', () => {
    const altri = altriCandidati('Antonio Camunita', ROSA);
    is(altri[0].id, 'e');
  });

  test('quando non c e proposta ci sono tutti e due gli Antonio', () => {
    const altri = altriCandidati('Antonio', ROSA);
    is(altri.length, 2);
  });

  test('chi non c entra niente resta fuori', () => {
    is(altriCandidati('Dario Moré', ROSA).some(p => p.id === 'f'), false);
  });
});

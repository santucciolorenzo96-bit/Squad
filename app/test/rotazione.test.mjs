import { describe, test, is, ok } from './run.mjs';
import {
  ruotaSestetto, cambioLibero, applicaCambio, raccontaCambio, zonaDi
} from '../src/utils/rotazione.js';

/* La rotazione e il cambio del libero.
 *
 * Qui si prova la cosa che in palestra non si può provare: un set intero di
 * rotazioni, una dopo l'altra, controllando a ogni giro che in campo ci sia
 * chi deve esserci. Un cambio sbagliato non si vede al momento — si vede due
 * rotazioni dopo, con il libero in attacco — e a quel punto nessuno sa più da
 * dove è partito l'errore.
 *
 *        rete
 *    4    3    2      indici 3, 2, 1
 *    5    6    1      indici 4, 5, 0   (in zona 1 si batte)
 */

const g = (id, nome, ruolo) => ({ id, name: nome, number: id, role_position: ruolo });

const P = g('1', 'Palleggiatrice', 'Palleggiatore');
const O = g('2', 'Opposta', 'Opposto');
const S1 = g('3', 'Schiacciatrice Uno', 'Schiacciatore');
const S2 = g('4', 'Schiacciatrice Due', 'Schiacciatore');
const C1 = g('5', 'Centrale Uno', 'Centrale');
const C2 = g('6', 'Centrale Due', 'Centrale');
const L = g('7', 'Libera', 'Libero');

describe('ruotare', () => {
  test('chi era in zona 1 va in zona 6, e gli altri avanzano', () => {
    const dopo = ruotaSestetto([P, O, S1, S2, C1, C2]);
    // zona 1 diventa chi era in zona 2
    is(dopo[0].id, O.id);
    // e chi era in zona 1 finisce in zona 6, cioe' in fondo
    is(dopo[5].id, P.id);
  });

  test('sei rotazioni riportano tutti al posto di partenza', () => {
    let s = [P, O, S1, S2, C1, C2];
    for (let i = 0; i < 6; i++) s = ruotaSestetto(s);
    is(s.map(x => x.id).join(''), [P, O, S1, S2, C1, C2].map(x => x.id).join(''));
  });

  test('non tocca l elenco che riceve', () => {
    const prima = [P, O, S1, S2, C1, C2];
    ruotaSestetto(prima);
    is(prima[0].id, P.id);
  });

  test('le zone si contano da uno', () => {
    is(zonaDi(0), 1);
    is(zonaDi(5), 6);
  });
});

describe('il libero esce quando andrebbe in prima linea', () => {
  /* Il libero e' in zona 5 (indice 4) al posto di C2. Ruotando va in zona 4,
   * che e' prima linea: deve uscire e rientra C2. Nello stesso giro C1 passa
   * da zona 2 a zona 1, cioe' va a battere — ed e' il momento che chi segna
   * riconosce guardando il campo. */
  const sestetto = [P, C1, S1, O, L, S2];   // z1 P, z2 C1, z3 S1, z4 O, z5 L, z6 S2
  const dopo = ruotaSestetto(sestetto);     // il libero finisce in z4 (indice 3)

  test('la rotazione porta davvero il libero in prima linea', () => {
    is(dopo[3].id, L.id);
  });

  test('e contemporaneamente il centrale arriva a battere in zona 1', () => {
    is(dopo[0].id, C1.id);
  });

  const cambio = cambioLibero(dopo, [C2], C2.id);

  test('il cambio c e', () => {
    ok(cambio);
    is(cambio.motivo, 'prima-linea');
  });

  test('esce il libero ed entra il centrale, in zona 4', () => {
    is(cambio.esce.id, L.id);
    is(cambio.entra.id, C2.id);
    is(cambio.zona, 4);
  });

  test('applicato, in campo c e il centrale e non piu il libero', () => {
    const finale = applicaCambio(dopo, cambio);
    is(finale[3].id, C2.id);
    is(finale.some(x => x.id === L.id), false);
  });

  test('e si racconta a parole', () => {
    ok(raccontaCambio(cambio).indexOf('Esce il libero') === 0);
    ok(raccontaCambio(cambio).indexOf('zona 4') > 0);
  });
});

describe('il libero entra quando un centrale arriva in zona 6', () => {
  /* C1 sta battendo in zona 1. Quando si riconquista il servizio ruota in
   * zona 6: il suo turno di battuta e' finito, ed e' un giocatore di seconda
   * linea come gli altri. */
  const sestetto = [C1, S1, O, C2, S2, P];  // z1 C1 (batte), z4 C2
  const dopo = ruotaSestetto(sestetto);     // C1 finisce in z6 (indice 5)

  test('la rotazione porta il centrale in zona 6', () => {
    is(dopo[5].id, C1.id);
  });

  const cambio = cambioLibero(dopo, [L]);

  test('entra il libero al suo posto', () => {
    ok(cambio);
    is(cambio.motivo, 'seconda-linea');
    is(cambio.esce.id, C1.id);
    is(cambio.entra.id, L.id);
    is(cambio.zona, 6);
  });
});

describe('quando non si e sicuri non si tocca niente', () => {
  const sestetto = [P, C1, S1, O, L, S2];
  const dopo = ruotaSestetto(sestetto);

  test('senza nessun centrale in panchina il libero resta dov e', () => {
    is(cambioLibero(dopo, []), null);
  });

  test('senza libero da nessuna parte non succede niente', () => {
    const senza = ruotaSestetto([C1, S1, O, C2, S2, P]);
    is(cambioLibero(senza, [S1]), null);
  });

  test('con i ruoli non compilati, niente', () => {
    const anonimi = [1, 2, 3, 4, 5, 6].map(n => ({ id: String(n), name: 'x' }));
    is(cambioLibero(anonimi, [{ id: '9', name: 'y' }]), null);
  });

  test('con meno di sei in campo, niente', () => {
    is(cambioLibero([P, O, S1], [L]), null);
  });

  test('il libero gia in seconda linea non si muove', () => {
    // libero in zona 6 (indice 5): e' al suo posto, non c'e' niente da fare
    is(cambioLibero([P, C1, S1, O, S2, L], [C2]), null);
  });
});

describe('due centrali in panchina: rientra quello giusto', () => {
  const dopo = ruotaSestetto([P, S1, S2, O, L, g('8', 'Altra', 'Schiacciatore')]);

  test('con perChi si sceglie lui', () => {
    const cambio = cambioLibero(dopo, [C1, C2], C2.id);
    is(cambio.entra.id, C2.id);
  });

  test('senza perChi si prende il primo: nel caso normale e l unico', () => {
    const cambio = cambioLibero(dopo, [C1, C2]);
    is(cambio.entra.id, C1.id);
  });
});

describe('un set intero: il libero non finisce mai in prima linea', () => {
  /* La prova che conta. Sei rotazioni di fila, applicando ogni volta il cambio
   * dovuto: se la regola e' giusta, il libero non compare MAI nelle zone 4, 3
   * o 2 — e in zona 1, a battere, non ci va nemmeno. */
  test('in dodici rotazioni non batte e non attacca mai', () => {
    let campo = [P, C1, S1, O, L, S2];
    let panca = [C2];
    let perChi = C2.id;

    for (let giro = 0; giro < 12; giro++) {
      campo = ruotaSestetto(campo);
      const cambio = cambioLibero(campo, panca, perChi);
      if (cambio) {
        campo = applicaCambio(campo, cambio);
        panca = panca.filter(x => x.id !== cambio.entra.id).concat([cambio.esce]);
        perChi = cambio.motivo === 'seconda-linea' ? cambio.esce.id : null;
      }

      const dovE = campo.findIndex(x => x.id === L.id);
      if (dovE >= 0) {
        ok([4, 5, 0].indexOf(dovE) >= 0, 'giro ' + giro + ': libero in zona ' + zonaDi(dovE));
      }
      // E non c'e' mai piu' di un libero, ne' due volte lo stesso giocatore.
      is(new Set(campo.map(x => x.id)).size, 6);
    }
  });
});

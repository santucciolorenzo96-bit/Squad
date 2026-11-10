import { describe, test, is } from './run.mjs';
import { nomeSquadra, eTuttoMaiuscolo } from '../src/utils/nomiSquadra.js';

/* IL NOME DI UNA SQUADRA, COME SI LEGGE.
 *
 * La federazione scrive in stampatello; la società scrive come vuole. Si
 * formatta solo quando si disegna: il dato resta quello della federazione,
 * perché è con quello che si confrontano le righe.
 */

describe('i nomi in stampatello diventano leggibili', () => {
  test('il nostro, come lo scrive il calendario', () => {
    is(nomeSquadra('CESTISTICA ETNEA BASKET'), 'Cestistica Etnea Basket');
  });

  test('un avversario con le sigle: ASD e BP restano sigle', () => {
    is(nomeSquadra("ASD BP BASKET POINT ACI SANT'A"), "ASD BP Basket Point Aci Sant'A");
  });

  test('dopo l’apostrofo si ricomincia', () => {
    is(nomeSquadra("POL. SANT'AGATA"), "Pol. Sant'Agata");
    is(nomeSquadra('SAN GIOVANNI LI CUTI'), 'San Giovanni Li Cuti');
  });

  test('i connettivi restano minuscoli, ma non in testa', () => {
    is(nomeSquadra('BASKET DI SICILIA'), 'Basket di Sicilia');
    is(nomeSquadra('DEL BASKET CLUB'), 'Del Basket Club');
  });

  test('i numeri romani restano tali', () => {
    is(nomeSquadra('VIRTUS RAGUSA II'), 'Virtus Ragusa II');
  });

  test('le sigle con i punti restano', () => {
    is(nomeSquadra('A.S.D. ORSA BASKET'), 'A.S.D. Orsa Basket');
  });

  test('i trattini si ricominciano', () => {
    is(nomeSquadra('ACI-CATENA BASKET'), 'Aci-Catena Basket');
  });

  test('le cifre non danno fastidio', () => {
    is(nomeSquadra('BASKET 2000 CATANIA'), 'Basket 2000 Catania');
  });
});

describe('i nomi scritti da una persona non si toccano', () => {
  test('già in maiuscole e minuscole', () => {
    is(nomeSquadra('Cestistica Etnea'), 'Cestistica Etnea');
    is(nomeSquadra('Virtus Ragusa'), 'Virtus Ragusa');
  });

  test('anche con una sigla dentro', () => {
    is(nomeSquadra('ASD Orsa Basket'), 'ASD Orsa Basket');
  });

  test('tutto minuscolo resta com’è: non è stampatello', () => {
    is(nomeSquadra('virtus ragusa'), 'virtus ragusa');
  });
});

describe('i casi vuoti', () => {
  test('niente non fa cadere niente', () => {
    is(nomeSquadra(null), '');
    is(nomeSquadra(undefined), '');
    is(nomeSquadra(''), '');
    is(nomeSquadra('   '), '');
  });

  test('gli spazi doppi si ricompongono', () => {
    is(nomeSquadra('CESTISTICA   ETNEA'), 'Cestistica Etnea');
  });

  test('solo cifre non è stampatello', () => {
    is(eTuttoMaiuscolo('2000'), false);
  });
});

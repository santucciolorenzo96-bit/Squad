import { describe, test, is } from './run.mjs';
import { cosaFaIlTocco } from '../src/utils/azione.js';

/* UN GESTO, QUATTRO SIGNIFICATI.
 *
 * Toccare una faccia in panchina fa cose diverse a seconda del momento:
 * assegna l'evento armato, fa entrare chi sostituisce, manda in campo un
 * titolare, oppure semplicemente lo sceglie.
 *
 * È la cosa più facile da sbagliare di tutto lo scout. Un tocco che a volte
 * assegna un canestro e a volte manda uno in campo, senza una regola che si
 * possa dire ad alta voce, è un tocco di cui non ci si fida — e in partita
 * si smette di usarlo.
 *
 * La regola si dice ad alta voce ed è questa: dal più esplicito al più
 * generico. Qui sotto c'è ogni combinazione, comprese quelle in cui due
 * condizioni sono vere insieme — che sono le uniche in cui un ordine
 * sbagliato si vedrebbe.
 */

describe('toccare una faccia in panchina', () => {
  test('un evento armato aspetta un nome: vince su tutto', () => {
    is(cosaFaIlTocco({ armato: { act: 'fg2_made' } }), 'assegna');
  });

  test('qualcuno sta uscendo: la domanda aperta e chi entra', () => {
    is(cosaFaIlTocco({ sostituzione: 'p1' }), 'sostituisci');
  });

  test('il campo non e al completo: si completa', () => {
    is(cosaFaIlTocco({ campoCorto: true }), 'inCampo');
  });

  test('niente di tutto questo: lo si sceglie e basta', () => {
    is(cosaFaIlTocco({}), 'scegli');
  });

  /* LE COMBINAZIONI, che sono il vero motivo per cui questa regola esiste
   * scritta invece che sparsa in tre `if`. */
  test('evento armato E qualcuno che esce: vince l evento', () => {
    // Si è armato un canestro mentre era aperto un cambio: il canestro è il
    // gesto più recente, ed è quello che l'utente sta completando adesso.
    is(cosaFaIlTocco({ armato: { act: 'fg3_made' }, sostituzione: 'p1' }), 'assegna');
  });

  test('evento armato E campo corto: vince l evento', () => {
    is(cosaFaIlTocco({ armato: { act: 'drb' }, campoCorto: true }), 'assegna');
  });

  test('cambio aperto E campo corto: vince il cambio', () => {
    /* Capita davvero: uno esce per falli, il campo resta a quattro, e
     * intanto era già aperto un cambio. Chi si tocca entra al posto di chi
     * stava uscendo — non come sesto. */
    is(cosaFaIlTocco({ sostituzione: 'p1', campoCorto: true }), 'sostituisci');
  });

  test('tutte e tre insieme: l ordine regge lo stesso', () => {
    is(cosaFaIlTocco({ armato: { act: 'ast' }, sostituzione: 'p1', campoCorto: true }), 'assegna');
  });

  test('senza niente da guardare non si inventa niente', () => {
    is(cosaFaIlTocco({ armato: null, sostituzione: null, campoCorto: false }), 'scegli');
  });
});

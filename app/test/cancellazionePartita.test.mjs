import { describe, test, is } from './run.mjs';
import { canDeleteGame } from '../src/utils/permissions.js';

/* Chi può cancellare una partita.
 *
 * Questa regola vive in due posti: qui e nella policy `games_delete` della
 * migrazione 060. Devono dire la stessa cosa, altrimenti l'app mostra un
 * pulsante che il database rifiuta — o nasconde quello che invece servirebbe.
 *
 * Quindi i casi qui sotto sono scritti guardando la policy, riga per riga.
 *
 * Fino alla 060 c'era una seconda regola: un tabellino ancora APERTO lo
 * poteva scartare chi lo stava tenendo. È caduta perché «aperto» non vuol
 * dire «vuoto», e il pulsante stava nella schermata di chi segnava. I casi
 * che la provavano sono ancora qui, rovesciati: servono a impedire che
 * qualcuno la rimetta per comodità senza accorgersene.
 */

const admin = { id: 'a', role: 'admin' };
const presidente = { id: 'p', role: 'presidente' };
const allenatore = { id: 'all-1', role: 'allenatore' };
const staff = { id: 'staff-1', role: 'staff' };
const segnapunti = { id: 'sp', role: 'segnapunti', can_score_matches: true };
const genitore = { id: 'g', role: 'genitore' };
const genitoreSegna = { id: 'g2', role: 'genitore', can_score_matches: true };
const atleta = { id: 'at', role: 'atleta' };

describe('cancellare una partita: solo gli amministratori', () => {
  test('admin e presidente sì', () => {
    is(canDeleteGame(admin), true);
    is(canDeleteGame(presidente), true);
  });

  test('l’allenatore no: la storia non si rifà a memoria', () => {
    is(canDeleteGame(allenatore), false);
  });

  test('lo staff no', () => {
    is(canDeleteGame(staff), false);
  });

  test('chi tiene lo scout no: segnare non è cancellare', () => {
    is(canDeleteGame(segnapunti), false);
    is(canDeleteGame(genitoreSegna), false);
  });

  test('un genitore o un atleta no', () => {
    is(canDeleteGame(genitore), false);
    is(canDeleteGame(atleta), false);
  });
});

describe('scartare un tabellino APERTO: anche quello solo gli amministratori', () => {
  /* Il permesso di segnare era la scorciatoia: chi teneva lo scout poteva
   * scartare il tabellino che aveva in mano. Non deve più potere, e questi
   * casi lo dicono uno per uno — sono gli stessi che prima passavano. */
  test('l’allenatore della categoria no', () => {
    is(canDeleteGame(allenatore), false);
  });

  test('un genitore abilitato a segnare no', () => {
    is(canDeleteGame(genitoreSegna), false);
  });

  test('il permesso di segnare non apre nessuna porta', () => {
    is(canDeleteGame({ id: 'x', role: 'staff', can_score_matches: true }), false);
  });

  test('l’amministratore sì', () => {
    is(canDeleteGame(admin), true);
  });
});

describe('cancellare una partita: i casi limite', () => {
  test('senza utente non si cancella niente', () => {
    is(canDeleteGame(null), false);
    is(canDeleteGame(undefined), false);
  });

  test('un ruolo che non esiste non è un amministratore', () => {
    is(canDeleteGame({ id: 'z', role: 'direttore_sportivo' }), false);
    is(canDeleteGame({ id: 'z' }), false);
  });

  /* Gli argomenti in più sono caduti con la 060: la regola non guarda più la
   * categoria. Chi li passa ancora da una schermata non aggiornata non deve
   * ottenere un risultato diverso — né più permissivo né più severo. */
  test('gli argomenti vecchi vengono ignorati, non cambiano la risposta', () => {
    is(canDeleteGame(allenatore, 's1', { 'all-1': ['s1'] }, { aperta: true }), false);
    is(canDeleteGame(admin, 's9', {}, { aperta: true }), true);
  });
});

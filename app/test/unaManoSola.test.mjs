import { describe, test, is } from './run.mjs';
import { tabellinoInAltraMano, RESPIRO_SCRIBA } from '../src/utils/regole.js';

/* Un tabellino si tiene in uno alla volta.
 *
 * Il database impedisce che due dispositivi si sovrascrivano — ogni
 * salvataggio dichiara da quale revisione parte — ma scoprirlo al primo tocco
 * vuol dire scoprirlo dopo aver segnato qualcosa che andrà perso. Questa
 * regola serve a saperlo prima di toccare.
 *
 * Il rischio dell'eccesso opposto è reale quanto quello che si sta evitando:
 * un blocco che non scade è un tabellino che nessuno può più riprendere
 * quando il telefono di chi lo teneva si scarica a metà partita.
 */

const ADESSO = new Date('2026-09-17T20:30:00Z').getTime();
const IO = 'io';
const fa = (minuti) => new Date(ADESSO - minuti * 60000).toISOString();

const partita = (extra) => Object.assign({ tenutoDa: 'altro', tenutoAlle: fa(1) }, extra);

describe('il tabellino è in mano a qualcun altro', () => {
  test('qualcuno ha salvato un minuto fa: sta segnando', () => {
    is(tabellinoInAltraMano(partita(), IO, ADESSO), true);
  });

  test('due minuti e mezzo: sta ancora segnando', () => {
    is(tabellinoInAltraMano(partita({ tenutoAlle: fa(2.5) }), IO, ADESSO), true);
  });

  test('cinque minuti: è stato abbandonato, non tenuto', () => {
    // L'intervallo, il telefono scarico, chi è uscito senza chiudere. Un
    // blocco che non scade è peggio del problema che risolve.
    is(tabellinoInAltraMano(partita({ tenutoAlle: fa(5) }), IO, ADESSO), false);
  });

  test('il confine è a tre minuti esatti', () => {
    const sul = new Date(ADESSO - RESPIRO_SCRIBA).toISOString();
    is(tabellinoInAltraMano(partita({ tenutoAlle: sul }), IO, ADESSO), true);
    const oltre = new Date(ADESSO - RESPIRO_SCRIBA - 1000).toISOString();
    is(tabellinoInAltraMano(partita({ tenutoAlle: oltre }), IO, ADESSO), false);
  });
});

describe('quando non c’è nessun altro', () => {
  test('la propria mano non è un’altra mano', () => {
    // Chi rientra dalla stessa persona sta riprendendo il suo, anche da un
    // altro dispositivo.
    is(tabellinoInAltraMano(partita({ tenutoDa: IO }), IO, ADESSO), false);
  });

  test('una partita che nessuno ha ancora salvato', () => {
    is(tabellinoInAltraMano({ tenutoDa: null, tenutoAlle: null }, IO, ADESSO), false);
    is(tabellinoInAltraMano({}, IO, ADESSO), false);
    is(tabellinoInAltraMano(null, IO, ADESSO), false);
  });

  test('una data storta non blocca nessuno', () => {
    is(tabellinoInAltraMano(partita({ tenutoAlle: 'boh' }), IO, ADESSO), false);
  });

  test('un orologio avanti non blocca nessuno', () => {
    // Due dispositivi con l'ora diversa succede. Non è un motivo per
    // impedire a qualcuno di segnare.
    is(tabellinoInAltraMano(partita({ tenutoAlle: fa(-10) }), IO, ADESSO), false);
  });

  test('senza sapere chi sono, si guarda solo l’orario', () => {
    is(tabellinoInAltraMano(partita(), null, ADESSO), true);
  });
});

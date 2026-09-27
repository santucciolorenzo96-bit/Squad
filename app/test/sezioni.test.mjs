import { describe, test, is, ok } from './run.mjs';
import { TABS, canSeeTab } from '../src/utils/permissions.js';

/* Chi vede cosa.
 *
 * Questa tabella è la mappa dei permessi dell'app, e finora esisteva solo
 * come dato: nessuno la leggeva per verificarla. Ogni volta che qualcuno
 * aggiunge una sezione o cambia un ruolo, qui si vede subito chi ci entra —
 * e soprattutto chi ci entra SENZA che fosse voluto.
 */

const vede = (utente) => TABS.filter(t => canSeeTab(t, utente)).map(t => t.id);

const ATLETA = { role: 'atleta' };
const GENITORE = { role: 'genitore' };
const STAFF = { role: 'staff' };
const ALLENATORE = { role: 'allenatore' };
const SEGNAPUNTI = { role: 'segnapunti' };
const AMMINISTRATORE = { role: 'admin' };
const PRESIDENTE = { role: 'presidente' };

describe('lo scout non e degli atleti', () => {
  test('per ruolo, no', () => {
    is(vede(ATLETA).includes('partita'), false);
  });

  /* IL CASO CHE CONTA. `can_score_matches` e' il permesso di chi tiene il
   * tabellino pur non essendo staff: quasi sempre un genitore. Su un atleta
   * non deve valere — sta giocando. */
  test('e nemmeno con il permesso di segnare le partite', () => {
    is(vede({ role: 'atleta', can_score_matches: true }).includes('partita'), false);
  });

  test('il genitore con quel permesso invece si: e una figura vera', () => {
    is(vede({ role: 'genitore', can_score_matches: true }).includes('partita'), true);
  });

  test('il genitore senza permesso no', () => {
    is(vede(GENITORE).includes('partita'), false);
  });

  test('il segnapunti si, per ruolo', () => {
    is(vede(SEGNAPUNTI).includes('partita'), true);
  });
});

describe('cosa vede un atleta o un genitore', () => {
  const atteso = ['home', 'rosa', 'anagrafica', 'allenamenti', 'comunicazioni', 'classifica', 'calendario'];

  test('le sette sezioni della famiglia, e solo quelle', () => {
    is(vede(ATLETA).join(','), atteso.join(','));
    is(vede(GENITORE).join(','), atteso.join(','));
  });

  test('niente presenze: la rilevazione e uno strumento dell allenatore', () => {
    is(vede(ATLETA).includes('presenze'), false);
  });

  test('niente statistiche di squadra, niente gestione, niente utenti', () => {
    ['statistiche', 'situazione', 'documenti', 'utenti', 'squadra'].forEach(id => {
      is(vede(ATLETA).includes(id), false);
    });
  });

  test('la finanza solo se un amministratore gliela apre, e non succede per ruolo', () => {
    is(vede(ATLETA).includes('finanza'), false);
    is(vede({ role: 'atleta', finance_role: 'viewer_team' }).includes('finanza'), true);
  });
});

describe('cosa vede lo staff dirigenziale', () => {
  test('anagrafica si: e il suo lavoro', () => {
    is(vede(STAFF).includes('anagrafica'), true);
    is(vede(STAFF).includes('documenti'), true);
    is(vede(STAFF).includes('presenze'), true);
  });

  /* Comporre la rosa e leggere le statistiche sono scelte tecniche: restano
   * all'allenatore e all'amministrazione. Lo staff dirigenziale tiene le
   * persone, non la squadra. */
  test('rosa, scout e statistiche no: sono scelte tecniche', () => {
    is(vede(STAFF).includes('rosa'), false);
    is(vede(STAFF).includes('partita'), false);
    is(vede(STAFF).includes('statistiche'), false);
  });

  test('e niente utenti o impostazioni: quelle sono dell amministrazione', () => {
    is(vede(STAFF).includes('utenti'), false);
    is(vede(STAFF).includes('squadra'), false);
  });
});

describe('cosa vede un allenatore', () => {
  test('tutto il tecnico', () => {
    ['rosa', 'partita', 'statistiche', 'presenze', 'anagrafica'].forEach(id => {
      ok(vede(ALLENATORE).includes(id), id);
    });
  });

  test('ma non utenti ne impostazioni', () => {
    is(vede(ALLENATORE).includes('utenti'), false);
    is(vede(ALLENATORE).includes('squadra'), false);
  });
});

describe('l amministrazione', () => {
  test('vede tutto tranne la finanza, che ha una chiave sua', () => {
    const suo = vede(AMMINISTRATORE);
    TABS.filter(t => !t.financeGated).forEach(t => ok(suo.includes(t.id), t.id));
    is(suo.includes('finanza'), false);
  });

  test('con il ruolo finanziario vede anche quella', () => {
    is(vede({ role: 'admin', finance_role: 'admin' }).includes('finanza'), true);
  });

  test('il presidente e un amministratore a tutti gli effetti', () => {
    is(vede(PRESIDENTE).join(','), vede(AMMINISTRATORE).join(','));
  });
});

describe('senza utente non si vede niente', () => {
  test('nessuna sezione', () => {
    is(vede(null).length, 0);
  });
});

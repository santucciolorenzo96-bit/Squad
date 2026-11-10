import { describe, test, is, ok, eq } from './run.mjs';
import {
  postiRimasti, statoCodice, eCodiceDiCategoria, codiceAttivo,
  inAttesaDellaCategoria, puoiInvitareNellaCategoria, messaggioDaMandare
} from '../src/utils/codiceCategoria.js';

/* IL CODICE DEGLI ATLETI DI UNA CATEGORIA.
 *
 * Un allenatore lo manda ai suoi atleti, e chi lo usa entra come atleta di
 * quella categoria — e aspetta che lui lo confermi.
 */

const ORA = '2026-11-03T10:00:00Z';

const cod = (patch) => ({
  id: 'i1', code: 'ABC123', role: 'atleta', player_id: null,
  sector_ids: ['s-open-a'], max_uses: 30, uses: 0,
  used_at: null, revoked_at: null, expires_at: '2026-12-01T00:00:00Z',
  created_at: '2026-11-01T09:00:00Z', ...patch
});

describe('quanti posti restano', () => {
  test('trenta meno quelli entrati', () => is(postiRimasti(cod({ uses: 4 })), 26));

  test('un invito nominativo vale una volta: max_uses non c’era ancora', () => {
    is(postiRimasti(cod({ max_uses: null, uses: 0 })), 1);
    is(postiRimasti(cod({ max_uses: null, uses: 1 })), 0);
  });

  test('non va sotto zero', () => is(postiRimasti(cod({ max_uses: 2, uses: 5 })), 0));

  test('niente, zero', () => is(postiRimasti(null), 0));
});

describe('lo stato, uno solo e in ordine', () => {
  test('valido', () => is(statoCodice(cod({}), ORA), 'valido'));

  test('revocato, anche se nel frattempo è scaduto', () => {
    // È quello che è successo davvero: qualcuno l'ha fermato.
    is(statoCodice(cod({ revoked_at: ORA, expires_at: '2026-10-01T00:00:00Z' }), ORA), 'revocato');
  });

  test('scaduto', () => is(statoCodice(cod({ expires_at: '2026-10-31T00:00:00Z' }), ORA), 'scaduto'));

  test('esaurito quando i posti sono finiti', () => {
    is(statoCodice(cod({ max_uses: 3, uses: 3 }), ORA), 'esaurito');
  });

  test('esaurito anche con used_at, che è come il database dice «finito»', () => {
    is(statoCodice(cod({ used_at: ORA }), ORA), 'esaurito');
  });

  test('senza scadenza resta valido', () => {
    is(statoCodice(cod({ expires_at: null }), ORA), 'valido');
  });

  test('niente, nessuno', () => is(statoCodice(null, ORA), 'nessuno'));
});

describe('quali inviti sono «il codice della categoria»', () => {
  test('quello per gli atleti di quella categoria, per più persone', () => {
    is(eCodiceDiCategoria(cod({}), 's-open-a'), true);
  });

  test('NON un invito nominativo: vale per una persona sola', () => {
    is(eCodiceDiCategoria(cod({ max_uses: 1 }), 's-open-a'), false);
    is(eCodiceDiCategoria(cod({ max_uses: null }), 's-open-a'), false);
  });

  test('NON un codice collegato a una scheda', () => {
    /* Un codice per più persone non può portarne una: la seconda si
     * ritroverebbe collegata alla scheda della prima. Il database lo rifiuta,
     * e qui non lo si mostra come se fosse quello giusto. */
    is(eCodiceDiCategoria(cod({ player_id: 'p1' }), 's-open-a'), false);
  });

  test('NON un codice per i genitori', () => {
    is(eCodiceDiCategoria(cod({ role: 'genitore' }), 's-open-a'), false);
  });

  test('NON il codice di un’altra categoria', () => {
    is(eCodiceDiCategoria(cod({}), 's-dr2'), false);
  });

  test('un codice fatto per due categorie insieme vale per tutte e due', () => {
    const due = cod({ sector_ids: ['s-open-a', 's-dr2'] });
    is(eCodiceDiCategoria(due, 's-open-a'), true);
    is(eCodiceDiCategoria(due, 's-dr2'), true);
  });

  test('un codice esaurito resta il codice di quella categoria', () => {
    // Serve a far dire «ne va fatto un altro» invece di mostrare la schermata
    // come se non ce ne fosse mai stato uno.
    is(eCodiceDiCategoria(cod({ uses: 30 }), 's-open-a'), true);
  });

  test('senza categoria aperta, no', () => is(eCodiceDiCategoria(cod({}), null), false));
});

describe('quale codice si mostra', () => {
  test('il più recente fra quelli validi', () => {
    const vecchio = cod({ id: 'vecchio', created_at: '2026-10-01T09:00:00Z' });
    const nuovo = cod({ id: 'nuovo', created_at: '2026-11-02T09:00:00Z' });
    is(codiceAttivo([vecchio, nuovo], 's-open-a', ORA).id, 'nuovo');
  });

  test('un codice revocato, scaduto o esaurito non si mostra', () => {
    is(codiceAttivo([cod({ revoked_at: ORA })], 's-open-a', ORA), null);
    is(codiceAttivo([cod({ expires_at: '2026-10-01T00:00:00Z' })], 's-open-a', ORA), null);
    is(codiceAttivo([cod({ uses: 30 })], 's-open-a', ORA), null);
  });

  test('gli inviti nominativi non si mostrano come codice di categoria', () => {
    is(codiceAttivo([cod({ max_uses: 1 }), cod({ player_id: 'p1' })], 's-open-a', ORA), null);
  });

  test('niente, null e nessun errore', () => {
    is(codiceAttivo([], 's-open-a', ORA), null);
    is(codiceAttivo(null, 's-open-a', ORA), null);
    is(codiceAttivo([null, undefined], 's-open-a', ORA), null);
  });
});

describe('chi aspetta, per questa categoria', () => {
  const righe = [
    { id: 'a', display_name: 'Marco', categorie: ['Open A'] },
    { id: 'b', display_name: 'Luca', categorie: ['DR2'] },
    { id: 'c', display_name: 'Gianni', categorie: [] }
  ];

  test('solo chi è arrivato con un codice di questa', () => {
    eq(inAttesaDellaCategoria(righe, 'Open A').map(r => r.id), ['a']);
  });

  test('il nome si confronta senza badare a maiuscole e spazi', () => {
    eq(inAttesaDellaCategoria(righe, '  open a ').map(r => r.id), ['a']);
  });

  test('chi è entrato col codice società non ha categoria: resta a Utenti', () => {
    // Là si vede tutta la società, che è dove quel codice va guardato.
    eq(inAttesaDellaCategoria(righe, 'Open A').map(r => r.id).indexOf('c'), -1);
  });

  test('senza categoria aperta, elenco vuoto', () => {
    eq(inAttesaDellaCategoria(righe, ''), []);
    eq(inAttesaDellaCategoria(righe, null), []);
  });

  test('righe vuote non fanno cadere tutto', () => {
    eq(inAttesaDellaCategoria([null, righe[0]], 'Open A').length, 1);
  });
});

describe('chi può fare il codice', () => {
  const settori = { u1: ['s-open-a'] };

  test('l’allenatore della categoria sì', () => {
    is(puoiInvitareNellaCategoria({ id: 'u1', role: 'allenatore' }, 's-open-a', settori), true);
  });

  test('ma non di una categoria che non gestisce', () => {
    is(puoiInvitareNellaCategoria({ id: 'u1', role: 'allenatore' }, 's-dr2', settori), false);
  });

  test('un amministratore sì, in tutte', () => {
    is(puoiInvitareNellaCategoria({ id: 'u9', role: 'admin' }, 's-dr2', {}), true);
  });

  test('UN ATLETA NO, nemmeno nella propria categoria', () => {
    /* Essere della DR2 non dà nessun potere sulla DR2: il ruolo dice cosa
     * gestisci, il collegamento dice di chi è la scheda. */
    is(puoiInvitareNellaCategoria({ id: 'u2', role: 'atleta' }, 's-open-a', { u2: ['s-open-a'] }), false);
    is(puoiInvitareNellaCategoria({ id: 'u2', role: 'genitore' }, 's-open-a', { u2: ['s-open-a'] }), false);
  });

  test('un segnapunti no: segna le partite, non compone la squadra', () => {
    is(puoiInvitareNellaCategoria({ id: 'u3', role: 'segnapunti' }, 's-open-a', { u3: ['s-open-a'] }), false);
  });

  test('senza utente o senza categoria, no', () => {
    is(puoiInvitareNellaCategoria(null, 's-open-a', settori), false);
    is(puoiInvitareNellaCategoria({ id: 'u1', role: 'allenatore' }, null, settori), false);
  });
});

describe('il messaggio da mandare', () => {
  test('porta il codice, la società e la categoria', () => {
    const m = messaggioDaMandare('ABC123', 'Open A', 'Cestistica Etnea');
    ok(m.indexOf('ABC123') >= 0, 'manca il codice');
    ok(m.indexOf('Open A') >= 0, 'manca la categoria');
    ok(m.indexOf('Cestistica Etnea') >= 0, 'manca la società');
  });

  test('e dice di scrivere il nome come è in rosa, che è ciò che serve dopo', () => {
    // Senza quello, chi conferma non sa chi è: il collegamento alla scheda si
    // fa su quel nome.
    ok(/in rosa/.test(messaggioDaMandare('ABC123', 'Open A', 'X')), 'non lo dice');
  });

  test('dice DOVE registrarsi, quando l’indirizzo è noto', () => {
    const m = messaggioDaMandare('ABC123', 'Open A', 'Cestistica Etnea', 'https://squad-steel.vercel.app');
    ok(m.indexOf('https://squad-steel.vercel.app') >= 0, 'manca l’indirizzo');
    ok(m.indexOf('ABC123') >= 0, 'manca il codice');
  });

  test('senza indirizzo il messaggio non ne inventa uno', () => {
    ok(messaggioDaMandare('ABC123', 'Open A', 'X').indexOf('http') < 0);
    ok(messaggioDaMandare('ABC123', 'Open A', 'X', '   ').indexOf('apri') < 0);
  });

  test('senza società o categoria resta una frase sensata', () => {
    const m = messaggioDaMandare('ABC123', '', '');
    ok(m.indexOf('ABC123') >= 0, 'manca il codice');
    ok(m.indexOf('  ') < 0, 'doppio spazio: una frase incollata male');
  });
});

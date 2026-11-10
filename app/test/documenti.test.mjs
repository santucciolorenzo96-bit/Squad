import { describe, test, is, ok } from './run.mjs';
import {
  controllaFile, estensioneDa, descriviErroreCaricamento, eFotografia, MAX_DOCUMENTO_MB
} from '../src/utils/documenti.js';

/* CARICARE UN DOCUMENTO: la famiglia carica dal telefono, e quello che va
 * storto deve arrivare in parole che dicano cosa fare. */

const file = (patch) => ({ name: 'cert.jpg', type: 'image/jpeg', size: 400 * 1024, ...patch });

describe('un file va bene, o si dice perché no', () => {
  test('una fotografia normale passa', () => is(controllaFile(file({})), null));
  test('un PDF passa', () => is(controllaFile(file({ name: 'c.pdf', type: 'application/pdf' })), null));

  test('senza file si chiede di sceglierlo', () => ok(/Scegli/.test(controllaFile(null))));

  test('un file vuoto non si carica: è una foto non ancora scaricata dal telefono', () => {
    ok(/vuoto/.test(controllaFile(file({ size: 0 }))));
  });

  test('troppo grande: dice quanto pesa e qual è il limite', () => {
    const m = controllaFile(file({ size: 14 * 1024 * 1024 }));
    ok(/14,0 MB/.test(m) && new RegExp(String(MAX_DOCUMENTO_MB)).test(m), m);
  });

  test('esattamente al limite passa', () => {
    is(controllaFile(file({ size: MAX_DOCUMENTO_MB * 1024 * 1024 })), null);
  });

  test('un tipo strano no', () => {
    ok(controllaFile(file({ name: 'a.exe', type: 'application/x-msdownload' })) !== null);
  });

  test('HEIC dall’iPhone si accetta: poi si riduce', () => {
    is(controllaFile(file({ name: 'IMG_1.HEIC', type: 'image/heic' })), null);
  });

  test('senza tipo dichiarato si guarda l’estensione', () => {
    is(controllaFile(file({ name: 'cert.pdf', type: '' })), null);
    ok(controllaFile(file({ name: 'cert.zip', type: '' })) !== null);
  });
});

describe('l’estensione dice cosa c’è dentro', () => {
  test('una foto ridotta è un JPEG anche se si chiamava .heic', () => {
    is(estensioneDa({ type: 'image/jpeg' }, 'IMG_1.heic'), 'jpg');
  });
  test('un PDF resta pdf', () => is(estensioneDa({ type: 'application/pdf' }, 'x.PDF'), 'pdf'));
  test('senza tipo si usa il nome', () => is(estensioneDa({ type: '' }, 'x.PNG'), 'png'));
  test('senza niente, jpg', () => is(estensioneDa(null, ''), 'jpg'));
});

describe('l’errore in parole di chi carica', () => {
  test('rete caduta: non è stato caricato niente', () => {
    ok(/connessione/.test(descriviErroreCaricamento(new Error('Failed to fetch'))));
    ok(/connessione/.test(descriviErroreCaricamento(new Error('Load failed'))));
  });
  test('permesso negato: non il messaggio grezzo del database', () => {
    const m = descriviErroreCaricamento(new Error('new row violates row-level security policy'));
    ok(/permesso/.test(m) && !/row-level/.test(m), m);
  });
  test('403 senza messaggio è un permesso', () => {
    ok(/permesso/.test(descriviErroreCaricamento({ statusCode: '403', message: '' })));
  });
  test('troppo grande dal server', () => {
    ok(/troppo grande/.test(descriviErroreCaricamento({ statusCode: '413', message: 'Payload too large' })));
  });
  test('già caricato', () => {
    ok(/già caricato/.test(descriviErroreCaricamento(new Error('The resource already exists'))));
  });
  test('uno sconosciuto conserva il testo, per poterlo riferire', () => {
    ok(/boh strano/.test(descriviErroreCaricamento(new Error('boh strano'))));
  });
  test('senza niente, una frase comunque', () => {
    ok(descriviErroreCaricamento(undefined).length > 10);
  });
});

describe('fotografia o no', () => {
  test('sì', () => is(eFotografia({ type: 'image/heic' }), true));
  test('un pdf no', () => is(eFotografia({ type: 'application/pdf' }), false));
  test('niente, no', () => is(eFotografia(null), false));
});

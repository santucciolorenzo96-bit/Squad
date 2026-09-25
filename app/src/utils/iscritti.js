/* Chi bussa alla porta della società.
 *
 * Chi si registra con il codice della società scrive il nome del proprio
 * atleta — «sono il genitore di Luca Rossi» — e un amministratore conferma.
 * Qui c'è la parte che gli risparmia il lavoro: trovare, fra i ragazzi in
 * rosa, quello che quel nome intende.
 *
 * SI SCRIVE, NON SI SCEGLIE DA UN ELENCO
 *
 * Un elenco da cui scegliere vorrebbe dire mostrare i nomi di tutti i ragazzi
 * della società a chiunque abbia il codice, prima ancora di sapere chi è. Il
 * nome scritto a mano non svela niente, e all'amministratore basta lo stesso:
 * gli proponiamo l'atleta che somiglia di più, e lui conferma con un tocco.
 *
 * E QUANDO NON SI È SICURI NON SI PROPONE
 *
 * Una proposta sbagliata è peggio di nessuna proposta: chi conferma con un
 * tocco si fida del tocco, e collegare un genitore al figlio di un altro è un
 * errore che nessuno andrà a ricontrollare. Quindi due nomi ugualmente vicini
 * non producono una scelta a caso: producono niente, e l'amministratore
 * sceglie a mano.
 */

import { senzaAccenti } from './format.js';

function normalizza(x) {
  return senzaAccenti(String(x || '')).toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parole(x) {
  return normalizza(x).split(' ').filter(Boolean);
}

/* Quanto due nomi si somigliano, da 0 a 1.
 *
 * Non è una distanza fra stringhe: è quante parole hanno in comune. «Rossi
 * Luca» e «Luca Rossi» sono la stessa persona scritta da due persone diverse,
 * e una distanza fra caratteri direbbe di no. I nomi doppi — «Mario José» —
 * si somigliano a metà, che è onesto: è un candidato, non una certezza.
 */
export function somiglianza(a, b) {
  const pa = parole(a);
  const pb = parole(b);
  if (pa.length === 0 || pb.length === 0) return 0;
  const comuni = pa.filter(x => pb.indexOf(x) >= 0).length;
  return comuni / Math.max(pa.length, pb.length);
}

export const SOGLIA_PROPOSTA = 0.5;

/* L'atleta che quel nome intende, o null.
 *
 * Null in tre casi, e sono tre casi diversi che qui producono lo stesso
 * risultato di proposito: nessun nome scritto, nessuno che somigli abbastanza,
 * o due che somigliano uguale. In tutti e tre l'amministratore sceglie a mano,
 * ed è giusto che sia così: la certezza non c'è.
 */
export function proponiAtleta(scritto, rosa) {
  if (!scritto || !rosa || rosa.length === 0) return null;
  const punteggi = rosa
    .map(p => ({ p, s: somiglianza(scritto, p.name) }))
    .filter(x => x.s >= SOGLIA_PROPOSTA)
    .sort((a, b) => b.s - a.s);

  if (punteggi.length === 0) return null;
  if (punteggi.length > 1 && punteggi[0].s === punteggi[1].s) return null;
  return punteggi[0].p;
}

/* Gli altri candidati da mostrare sotto la proposta.
 *
 * Perché la proposta giusta possa essere corretta senza cercare in un elenco
 * di quaranta nomi: se il primo non è lui, quasi sempre è il secondo.
 */
export function altriCandidati(scritto, rosa, quanti = 4) {
  if (!rosa) return [];
  const proposto = proponiAtleta(scritto, rosa);
  return rosa
    .map(p => ({ p, s: somiglianza(scritto, p.name) }))
    .filter(x => x.s > 0 && (!proposto || x.p.id !== proposto.id))
    .sort((a, b) => b.s - a.s)
    .slice(0, quanti)
    .map(x => x.p);
}

import { MANAGER_ROLES, managesSector } from './permissions.js';

/* IL CODICE DEGLI ATLETI DI UNA CATEGORIA.
 *
 * Un allenatore manda un codice agli atleti della sua categoria, e chi lo usa
 * entra come atleta di quella categoria. È un invito come gli altri — stessa
 * tabella, stesso riscatto — con tre differenze che lo rendono una cosa a sé:
 *
 *   — vale per PIÙ persone (`max_uses` oltre 1), perché va in un gruppo;
 *   — NON è collegato a una scheda, perché non può esserlo: la seconda persona
 *     si ritroverebbe collegata alla scheda della prima;
 *   — chi entra ASPETTA conferma. Un invito nominativo è già l'approvazione —
 *     l'ha creato qualcuno sapendo chi stava invitando — ma un codice mandato
 *     in un gruppo si gira, e allora chi l'ha creato guarda chi è arrivato.
 *
 * Quello che il codice porta e il codice società no: il ruolo è deciso prima e
 * non si dichiara, la categoria è scritta sul codice, e scade.
 *
 * UNO PER CATEGORIA, E SI MOSTRA QUELLO CHE C'È.
 * Un pulsante che genera un codice nuovo a ogni tocco riempie la società di
 * codici vivi che nessuno ha revocato, e chi ha ricevuto il primo si sente
 * dire che non vale più. Quindi: se un codice valido c'è, si mostra; un codice
 * nuovo lo si fa solo dopo aver revocato quello vecchio.
 */

export const POSTI_PREDEFINITI = 30;
export const GIORNI_PREDEFINITI = 30;

function quando(x) {
  const t = x ? new Date(x).getTime() : NaN;
  return isNaN(t) ? null : t;
}

/* Quante persone possono ancora entrare. `max_uses` assente vuol dire 1: gli
 * inviti nominativi sono nati prima del conteggio e valgono una volta. */
export function postiRimasti(inv) {
  if (!inv) return 0;
  const max = inv.max_uses == null ? 1 : Number(inv.max_uses);
  const fatti = inv.uses == null ? 0 : Number(inv.uses);
  return Math.max(0, max - fatti);
}

/* Uno stato solo, e in quest'ordine: un codice revocato che nel frattempo è
 * scaduto resta «revocato», perché è quello che è successo davvero. */
export function statoCodice(inv, adesso) {
  if (!inv) return 'nessuno';
  if (inv.revoked_at) return 'revocato';
  const ora = adesso ? new Date(adesso).getTime() : Date.now();
  const scade = quando(inv.expires_at);
  if (scade != null && scade <= ora) return 'scaduto';
  if (inv.used_at || postiRimasti(inv) <= 0) return 'esaurito';
  return 'valido';
}

/* È il codice degli atleti DI QUESTA categoria?
 *
 * Il settore si confronta per appartenenza e non per uguaglianza dell'elenco:
 * un amministratore può aver fatto un codice per due categorie insieme, e per
 * chi guarda l'Open A quello è il codice dell'Open A. Un codice collegato a
 * una scheda non è di categoria: è nominativo, per una persona. */
export function eCodiceDiCategoria(inv, sectorId) {
  if (!inv || !sectorId) return false;
  if (inv.role !== 'atleta') return false;
  if (inv.player_id) return false;
  // Che sia ancora spendibile lo dice `statoCodice`: un codice esaurito resta
  // il codice di quella categoria, ed e` cosi` che si sa di doverne fare un
  // altro invece di vedere la schermata come se non ce ne fosse mai stato uno.
  if ((inv.max_uses == null ? 1 : Number(inv.max_uses)) <= 1) return false;
  return (inv.sector_ids || []).indexOf(sectorId) >= 0;
}

/* Il codice da mostrare: fra quelli validi, il più recente. Gli altri sono
 * storia e stanno nell'elenco degli inviti, che è dove si guarda la storia. */
export function codiceAttivo(inviti, sectorId, adesso) {
  const buoni = (Array.isArray(inviti) ? inviti : [])
    .filter(i => eCodiceDiCategoria(i, sectorId) && statoCodice(i, adesso) === 'valido');
  if (buoni.length === 0) return null;
  return buoni.slice().sort((a, b) =>
    String(b.created_at || '').localeCompare(String(a.created_at || ''))
  )[0];
}

/* Chi aspetta, per questa categoria.
 *
 * `chi_aspetta()` restituisce i nomi delle categorie dell'invito con cui uno è
 * entrato — non gli id, perché quella funzione serve anche a un
 * amministratore, che guarda tutta la società e non una categoria aperta. Qui
 * si tiene chi è arrivato con un codice di QUESTA. Chi è entrato col codice
 * società non ha nessuna categoria scritta: resta all'amministratore, in
 * Utenti, dove si vede tutto. */
export function inAttesaDellaCategoria(righe, nomeCategoria) {
  const nome = String(nomeCategoria || '').trim().toLowerCase();
  if (!nome) return [];
  return (Array.isArray(righe) ? righe : []).filter(r =>
    r && (r.categorie || []).some(c => String(c || '').trim().toLowerCase() === nome)
  );
}

/* Chi può fare il codice di una categoria: chi quella categoria la gestisce.
 *
 * È `managesSector` più il ruolo, come in ogni altra scrittura di categoria, e
 * non un permesso nuovo: creare un invito per i propri atleti è una cosa che
 * l'allenatore fa già a voce. Lo stesso controllo c'è in `create_invite`
 * (migrazione 064), che è quello che conta — questo serve solo a non mostrare
 * un pulsante che il database rifiuterebbe. */
export function puoiInvitareNellaCategoria(user, sectorId, staffSectors) {
  if (!user || !sectorId) return false;
  if (!MANAGER_ROLES.includes(user.role)) return false;
  return managesSector(user, sectorId, staffSectors);
}

/* Il messaggio da mandare. Il codice da solo non dice cosa farne, e la
 * domanda che arriva dopo è sempre la stessa: «dove lo metto?». E prima ancora:
 * «dove mi registro?» — per questo c'è l'indirizzo dell'app, quando lo si
 * conosce: un messaggio che dice «registrati» senza dire dove manda i ragazzi a
 * chiedere in chat. */
export function messaggioDaMandare(codice, nomeCategoria, nomeSocieta, indirizzo = '') {
  const dove = nomeSocieta ? ' di ' + nomeSocieta : '';
  const link = String(indirizzo || '').trim();
  return 'Ciao! Per entrare su SQUAD con la squadra' + dove
    + (nomeCategoria ? ' (' + nomeCategoria + ')' : '')
    + (link ? ': apri ' + link + ', registrati' : ': registrati')
    + ' con la tua email e inserisci il codice ' + codice
    + '. Scrivi il tuo nome e cognome come sono in rosa, così ti collego alla tua scheda.';
}

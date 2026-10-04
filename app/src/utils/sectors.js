import { isAdmin } from './permissions.js';

/* LE CATEGORIE SONO PIATTE.
 *
 * C'è stata una gerarchia: un settore poteva avere un genitore, e «Under 15 ·
 * Blu» era una sottocategoria di «Under 15». È stata tolta, e vale la pena
 * dire perché, perché l'idea tornerà in mente a qualcuno.
 *
 * Non la usava nessuna società — zero righe in tutto il database — e intanto
 * costava un livello di complessità a ogni schermata che elenca le categorie,
 * più una colonna, un indice e un trigger per impedire le ricorsioni.
 *
 * E aveva un buco che non si poteva chiudere senza inventare una semantica
 * nuova: NESSUNA lettura aggregava i figli. Rosa, allenamenti, calendario,
 * partite e statistiche cercano tutte il settore per corrispondenza esatta,
 * quindi aprire una categoria che aveva sottocategorie mostrava una rosa
 * vuota, nessun allenamento e nessuna partita — senza una riga che dicesse
 * perché. Da fuori non sembrava una scelta: sembrava un guasto.
 *
 * Aggregare i figli avrebbe risolto quel sintomo e aperto tre domande peggiori
 * — dove si aggiunge un atleta, di chi è una partita, quale calendario si sta
 * guardando. Una categoria è una squadra: se due gruppi si allenano e giocano
 * separati sono due categorie, e se non lo fanno sono una.
 */

// In ordine: quello scelto dalla società, e a parità il nome.
export function orderedSectors(sectors) {
  return (sectors || []).slice()
    .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
}

/* Il nome da mostrare. Oggi è il nome e basta.
 *
 * Resta una funzione invece di diventare `s.name` ovunque perché è chiamata da
 * una decina di punti, e il giorno in cui il nome dovesse portarsi dietro
 * qualcos'altro — la stagione, la società, per un amministratore che ne vede
 * più di una — il posto dove scriverlo è questo, uno solo.
 */
export function sectorFullName(sector) {
  return sector ? sector.name : '';
}

/* Le categorie che un account puo' aprire.
 *
 * Due strade, e SI SOMMANO: quelle assegnate come staff, e quelle dove c'e' una
 * scheda atleta collegata al suo account.
 *
 * Sommarle e' quello che serve a chi nella societa' fa due cose — l'allenatore
 * dell'Open A che gioca in Prima Squadra, il genitore che allena un'altra
 * categoria. Prima se ne vedeva una sola delle due, e quale dipendeva dal ruolo
 * scritto sull'account: un allenatore non vedeva la categoria di suo figlio,
 * un genitore non vedeva quella che allenava.
 *
 * Dice cosa si VEDE, mai cosa si puo' cambiare: per quello c'e' managesSector,
 * e comunque il database non lascerebbe passare la scrittura.
 */
export function sectorIdsFor(user, { staffSectors, familySectorIds, sectors }) {
  if (isAdmin(user)) return (sectors || []).map(s => s.id);
  const dentro = [];
  const aggiungi = (id) => { if (id && dentro.indexOf(id) < 0) dentro.push(id); };
  (((staffSectors || {})[user && user.id]) || []).forEach(aggiungi);
  (familySectorIds || []).forEach(aggiungi);
  return dentro;
}

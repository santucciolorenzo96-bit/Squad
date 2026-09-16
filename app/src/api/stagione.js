/* La stagione attiva, in un posto solo.
 *
 * Quasi tutto quello che una società scrive appartiene a una stagione:
 * allenamenti, calendario, partite, classifica, rose. Chi legge quei dati
 * filtra per la stagione in corso, ed è giusto — senza il filtro i numeri di
 * anni diversi si sommerebbero fra loro.
 *
 * Il guaio è che finora la stagione la doveva ricordare OGNI punto in cui si
 * scrive, passandola come ultimo argomento. Dimenticarla non dava nessun
 * errore: la riga finiva nel database con `season_id` vuoto, e da quel momento
 * non la trovava più nessuno, perché ogni lettura chiede la stagione. Da fuori
 * sembrava che il salvataggio non fosse mai avvenuto.
 *
 * È il modo peggiore in cui un dato può sparire: senza lasciare traccia di sé,
 * e facendo sembrare rotto il salvataggio invece della lettura.
 *
 * Qui la stagione sta in un posto solo, e le funzioni di scrittura se la
 * prendono da sole quando nessuno gliela passa. Non legge direttamente lo
 * `state` dell'app perché questo strato non lo conosce — e non deve: è il
 * router a collegarcelo, una volta, appena si avvia.
 */

let leggi = () => null;

// Chiamata una volta sola dal router, che è l'unico posto che sa dove vive la
// stagione. Una funzione e non un valore: così non può diventare vecchia
// quando qualcuno cambia stagione a metà sessione.
export function collegaStagione(fn) {
  leggi = typeof fn === 'function' ? fn : (() => null);
}

export function stagioneAttiva() {
  try {
    return leggi() || null;
  } catch (e) {
    // Una scrittura non deve fallire perché non si è capito in che stagione
    // siamo: meglio senza stagione che niente del tutto.
    return null;
  }
}

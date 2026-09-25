/* I numeri di maglia.
 *
 * Undici atleti su tredici non ne avevano uno: quando si crea un giocatore il
 * numero è facoltativo — giustamente, in palestra si inserisce una rosa di
 * corsa — ma nessuno tornava a riempirlo, e nello scout quei ragazzi si
 * distinguevano solo dal nome.
 *
 * Ora il numero lo può mettere la società (tutti in una volta) o l'atleta
 * stesso (il proprio, se non ce l'ha). Due strade diverse, ma le regole di
 * cosa sia un numero valido e di quali siano liberi devono essere le stesse,
 * altrimenti la società propone un numero che poi il database rifiuta. Stanno
 * qui, ed è questo file che i test guardano.
 *
 * Le stesse regole sono scritte anche in choose_my_number() (migrazione 040):
 * lì sono la difesa, qui sono la cortesia. Se cambiano di là, cambiano di qua.
 */

// Il segnaposto con cui nasce un giocatore senza numero.
export const SENZA_NUMERO = '-';

/* Che cosa è un numero di maglia.
 *
 * Solo cifre, al massimo tre. «07» e «7» sono lo stesso numero e non possono
 * convivere in una rosa, quindi lo zero davanti si toglie — tranne quando il
 * numero È lo zero: nel basket «0» e «00» sono due numeri diversi, assegnati a
 * due persone diverse, e vanno tenuti come sono stati scritti.
 *
 * Torna '' quando non è un numero: chi chiama decide se è un errore da dire o
 * un campo lasciato vuoto.
 */
export function normalizzaNumero(testo) {
  const grezzo = String(testo == null ? '' : testo).trim();
  if (!/^[0-9]{1,3}$/.test(grezzo)) return '';
  if (/^0+$/.test(grezzo)) return grezzo.slice(0, 2);
  return grezzo.replace(/^0+/, '');
}

// Un atleta senza numero: né vuoto, né il segnaposto.
export function senzaNumero(p) {
  const n = String((p && p.number) || '').trim();
  return n === '' || n === SENZA_NUMERO;
}

/* I numeri già addosso a qualcuno, escluso l'atleta che stiamo vestendo.
 *
 * `esclusi` accetta anche più di un id: serve al pannello della società, dove
 * si assegnano più numeri insieme e nessuno dei presenti nel modulo deve
 * bloccare gli altri.
 */
export function numeriOccupati(rosa, esclusi) {
  const fuori = Array.isArray(esclusi) ? esclusi : (esclusi ? [esclusi] : []);
  const presi = {};
  (rosa || []).forEach(p => {
    if (!p || fuori.indexOf(p.id) >= 0 || senzaNumero(p)) return;
    const n = normalizzaNumero(p.number);
    if (n) presi[n] = p.name || true;
  });
  return presi;
}

/* I primi numeri liberi da proporre.
 *
 * Non è un elenco esaustivo — chi vuole il 74 lo scrive — sono i suggerimenti
 * da toccare con un dito: partono da 0 e saltano quelli presi. Nella
 * pallacanestro i numeri da 1 a 5 hanno un significato tattico e nella
 * pallavolo no, ma non è affare nostro: proponiamo, non consigliamo.
 */
export function numeriLiberi(rosa, esclusi, quanti = 12) {
  const presi = numeriOccupati(rosa, esclusi);
  const liberi = [];
  for (let n = 0; n <= 99 && liberi.length < quanti; n++) {
    if (!presi[String(n)]) liberi.push(String(n));
  }
  return liberi;
}

/* Il controllo prima di salvare: torna il motivo del no, oppure null.
 *
 * Una frase, non un codice: la legge un genitore sul telefono.
 */
export function obiezioneNumero(testo, rosa, esclusi) {
  const n = normalizzaNumero(testo);
  if (!n) return 'Il numero di maglia si scrive in cifre, da 0 a 99.';
  const presi = numeriOccupati(rosa, esclusi);
  const chi = presi[n];
  if (chi) {
    return typeof chi === 'string'
      ? `Il numero ${n} ce l'ha già ${chi}.`
      : `Il numero ${n} ce l'ha già un compagno di squadra.`;
  }
  return null;
}

/* I doppioni dentro un modulo che non è ancora stato salvato.
 *
 * Il pannello della società assegna più numeri in una volta: due caselle con
 * lo stesso numero non le vede `numeriOccupati`, perché nessuno dei due è
 * ancora in rosa. Torna { [numero]: [id, id] } per i soli numeri ripetuti.
 */
export function doppioniNelModulo(scelte) {
  const per = {};
  Object.keys(scelte || {}).forEach(id => {
    const n = normalizzaNumero(scelte[id]);
    if (!n) return;
    (per[n] = per[n] || []).push(id);
  });
  const doppi = {};
  Object.keys(per).forEach(n => { if (per[n].length > 1) doppi[n] = per[n]; });
  return doppi;
}

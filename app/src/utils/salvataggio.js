/* PERCHÉ UN SALVATAGGIO NON HA SCRITTO NIENTE.
 *
 * `salva_tabellino` è la funzione che impedisce a due dispositivi di
 * scriversi sopra: aggiorna la riga solo se la revisione è ancora quella da cui
 * il dispositivo è partito. Se non aggiorna niente restituisce null.
 *
 * Ma la sua condizione ha TRE parti — l'id, la revisione, e `status = 'live'` —
 * e per molto tempo quel null è stato letto come se ne avesse una sola: «un
 * altro dispositivo è arrivato prima».
 *
 * Il caso che non veniva riconosciuto è il peggiore dei tre. Se la partita è
 * stata CHIUSA, da quel momento ogni singolo salvataggio fallisce, per sempre,
 * e nessun messaggio su «qualcun altro che sta segnando» ha senso: non c'è
 * nessun altro, c'è una porta chiusa. Lo scout mostrava una finestra che non si
 * poteva chiudere, con un solo pulsante che ricaricava — e prima di ricaricare
 * cancellava la copia locale, cioè l'unico posto dove le azioni non salvate
 * esistevano ancora.
 *
 * È così che uno scout «è crashato» in mezzo a un'amichevole: nessuna
 * eccezione, nessuna pagina bianca, nessun errore da nessuna parte. Solo un
 * messaggio sbagliato e una via d'uscita che distruggeva il lavoro.
 *
 * Questa funzione guarda la riga come sta nel database e dice quale dei tre è.
 * Sta fuori dal client del database di proposito: è la regola, e una regola si
 * prova.
 */

export const MOTIVI = ['chiusa', 'assente', 'superata'];

/**
 * @param riga             la riga di `games` come sta adesso, o null se non c'è
 * @param revisioneNostra  la revisione da cui è partito questo dispositivo
 */
export function motivoDelRifiuto(riga, revisioneNostra) {
  if (!riga) return { motivo: 'assente' };

  /* L'ORDINE CONTA, E QUESTO VA PER PRIMO.
   *
   * Una partita chiusa ha quasi sempre ANCHE la revisione diversa dalla
   * nostra: chi l'ha chiusa ha scritto. Se si controllasse prima la
   * revisione, una partita chiusa verrebbe raccontata come un sorpasso — che
   * è esattamente il difetto da cui nasce questo file. */
  if (riga.status !== 'live') return { motivo: 'chiusa', stato: riga.status };

  if ((riga.revisione || 0) !== (revisioneNostra || 0)) {
    return { motivo: 'superata', tenutoDa: riga.tenuto_da, tenutoAlle: riga.tenuto_alle };
  }

  /* La riga è viva e la revisione è la nostra: da qui il rifiuto non si
   * spiega. Capita se fra il salvataggio e questa lettura qualcuno ha rimesso
   * le cose a posto. Si tratta come un sorpasso, che è il caso prudente —
   * quello in cui non si riprova a scrivere sopra. */
  return { motivo: 'superata' };
}

export const SPIEGAZIONE = {
  chiusa: 'Questa partita è stata chiusa e archiviata: da qui non si salva più niente.',
  assente: 'Questa partita non c’è più: è stata scartata.',
  superata: 'Questa partita è stata modificata da un altro dispositivo: le ultime azioni '
    + 'segnate qui non sono state salvate.',
  rete: 'Non riesco a raggiungere il database.'
};

/* Se si riprova da soli, oppure no.
 *
 * Solo la rete assente si riprova: è la palestra senza segnale, ed è il caso
 * per cui la riprova automatica esiste. Su una partita chiusa non c'è niente
 * da riprovare, e su un sorpasso riprovare vorrebbe dire insistere a scrivere
 * sopra al lavoro di qualcun altro — con la certezza di riuscirci, prima o poi.
 */
export function siRiprova(motivo) {
  return motivo === 'rete';
}

/* COSA APPARTIENE ALLA PARTITA, E COSA ALLA RIGA SUL SERVER.
 *
 * `revisione`, `tenutoDa` e `tenutoAlle` non sono dati della partita: sono lo
 * stato della RIGA nel database — «da quale versione parti» e «chi l'ha toccata
 * per ultimo». Viaggiano dentro lo stesso oggetto di punti e statistiche, e per
 * questo si portano dietro per sbaglio ogni volta che quell'oggetto viene
 * sostituito con una copia.
 *
 * È già successo due volte, in due posti diversi:
 *
 *   — riprendendo la copia locale all'apertura: la copia si scrive PRIMA del
 *     salvataggio, quindi porta una revisione vecchia per definizione, e il
 *     primo salvataggio si sentiva rispondere «un altro è arrivato prima» a un
 *     utente solo su un dispositivo solo;
 *
 *   — ANNULLANDO un'azione: l'annulla sostituisce la partita con la copia
 *     fotografata prima del tocco, e quella copia è stata scattata prima del
 *     salvataggio che è seguito. Ripristinandola per intero si torna indietro
 *     anche di una revisione, e il salvataggio successivo viene rifiutato.
 *
 * La regola è una sola e sta qui: IL CONTENUTO SI PRENDE DALLA COPIA, LO STATO
 * DELLA RIGA DA QUELLO CHE C'È ADESSO.
 */
export const STATO_DELLA_RIGA = ['revisione', 'tenutoDa', 'tenutoAlle'];

export function conStatoDellaRiga(copia, corrente) {
  if (!copia) return copia;
  const fuori = { ...copia };
  STATO_DELLA_RIGA.forEach(k => {
    if (corrente && corrente[k] !== undefined) fuori[k] = corrente[k];
  });
  return fuori;
}

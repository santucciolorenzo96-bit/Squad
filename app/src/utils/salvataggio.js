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

/* PERCHÉ UNA PARTITA NON SI È ARCHIVIATA.
 *
 * È lo stesso difetto di sopra in un altro punto, e questo è quello che è
 * costato una partita vera.
 *
 * `endGame` faceva un `update ... where id = ...` e si fidava dell'assenza di
 * errori. Ma un update che non trova nessuna riga — perché la riga non c'è
 * più, o perché la sicurezza a livello di riga la filtra via — **non è un
 * errore**: è un update di zero righe, che torna indietro senza dire niente.
 *
 * E quello che veniva dopo era irreparabile, in quest'ordine: il risultato
 * finiva sulla riga di calendario, la copia locale veniva cancellata, la
 * partita veniva tolta dalla memoria, e lo scout annunciava «Partita
 * archiviata».
 *
 * Il risultato, visto dopo: in calendario la partita risulta giocata, con il
 * punteggio giusto; in `games` non c'è nessuna riga; sul tablet non c'è più
 * nessuna copia. Il tabellino di quella partita — chi ha segnato, chi ha
 * rimbalzato, i falli di ognuno — non esiste in nessun posto, e non è rimasta
 * traccia di cosa sia andato storto. Da fuori sembra che qualcuno l'abbia
 * cancellata.
 *
 * Due partite sono finite così, il 21 e il 26 ottobre 2026, e nessuno ha visto
 * un errore.
 *
 * Adesso `endGame` si fa restituire la riga che ha scritto, e se non ne ha
 * scritta nessuna chiede al database perché. Non si riprova da soli e non si
 * sistema niente di nascosto: si LANCIA, perché è l'unico modo di fermare le
 * tre righe che vengono dopo. La finestra di conferma mostra l'errore e non si
 * chiude, quindi la copia locale resta dov'è e la partita resta segnabile.
 *
 * La cosa che ogni messaggio deve dire, prima di tutto il resto: la partita
 * non è archiviata, e il tabellino è ancora tutto qui.
 */

export const MOTIVI_ARCHIVIO = ['assente', 'rifiutata', 'rete'];

/**
 * @param riga  la riga di `games` riletta per id, o null se non c'è
 * @param opt   `rete: true` se nemmeno la rilettura è passata
 */
export function motivoArchivioMancato(riga, { rete = false } = {}) {
  // Se non si riesce a rileggere, il problema non era il permesso: era la
  // palestra senza segnale. È l'unico caso che si risolve da sé, riprovando.
  if (rete) return { motivo: 'rete' };

  /* Nessuna riga con quell'id. La partita che lo scout ha in mano non esiste
   * sul server: o non è mai stata creata, o è stata eliminata mentre si
   * segnava. In tutti e due i casi la copia locale è l'unica che ce l'ha. */
  if (!riga) return { motivo: 'assente' };

  /* La riga c'è ma l'update non l'ha toccata: l'ha filtrata una policy.
   * Succede a chi ha perso l'accesso a quella categoria mentre segnava. */
  return { motivo: 'rifiutata' };
}

const RESTA_QUI = ' La partita NON è archiviata e il tabellino è ancora tutto qui, '
  + 'su questo dispositivo: non chiudere l’app e non ricaricare la pagina.';

export const SPIEGAZIONE_ARCHIVIO = {
  assente: 'Questo tabellino non esiste più sul server: la riga della partita non c’è.'
    + RESTA_QUI
    + ' Esci dallo scout e rientra: ti verrà proposto di riprendere da questa copia.',
  rifiutata: 'Il database ha rifiutato di archiviare la partita: su questa categoria '
    + 'non hai il permesso di scrivere.' + RESTA_QUI
    + ' Chiedi a un amministratore di darti l’accesso, poi riprova.',
  rete: 'Non è stato possibile archiviare la partita: manca la rete.' + RESTA_QUI
    + ' Riprova quando il segnale torna.'
};

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

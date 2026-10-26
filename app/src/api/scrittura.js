/* UNA SCRITTURA CHE DEVE AVER TOCCATO UNA RIGA.
 *
 * Con la sicurezza a livello di riga, un `update` o un `delete` che non trova
 * niente da scrivere NON È UN ERRORE: è una scrittura di zero righe, che torna
 * indietro con `error: null`. Il client del database si comporta esattamente
 * come se fosse andata a buon fine, perché dal suo punto di vista è andata a
 * buon fine: la richiesta è arrivata, il database ha risposto, nessuno si è
 * lamentato.
 *
 * L'app invece ci costruisce sopra: annuncia «eliminato», toglie la riga
 * dall'elenco che ha in memoria, chiude la finestra. Il risultato è che
 * qualcosa che non è stato fatto viene raccontato come fatto — e lo si scopre
 * alla prossima ricarica, quando la riga ricompare, se qualcuno ricarica.
 *
 * È già costato due volte in questo programma:
 *
 *   — un tabellino «scartato» che restava dov'era (migrazione 035);
 *   — e il caso grave: `endGame` che non si accorgeva di non aver archiviato,
 *     scriveva comunque il risultato in calendario, cancellava la copia locale
 *     e annunciava «Partita archiviata». Due partite sono finite così, il 21 e
 *     il 26 ottobre 2026, e il tabellino non esisteva più in nessun posto.
 *
 * Dopo il secondo ne restavano trentadue, tutte della stessa forma. Sette
 * stanno bene come sono e NON passano da qui, perché per loro zero righe è un
 * esito legittimo: i ripristini dopo un errore (si cancella quello che si era
 * appena creato, e se non c'è più va bene così), e le pulizie idempotenti —
 * svuotare una lista, togliere un contrassegno da tutte le altre righe,
 * ritirare una giustificazione che forse era già stata ritirata. Pretendere
 * una riga da quelle vorrebbe dire inventare errori dove non ce ne sono, che è
 * il modo più rapido per insegnare a ignorarli.
 *
 * Le altre venticinque passano da qui. Il messaggio dice la cosa che serve a
 * chi legge — non hai il permesso — e quella che serve subito dopo: ricarica,
 * perché quello che vedi sullo schermo adesso non è vero.
 */

export function esigiRiga(data, cosa) {
  if (data && data.length > 0) return data;
  throw new Error(
    'Non è stato possibile ' + cosa + ': il database ha rifiutato senza dare un errore. '
    + 'Quasi sempre vuol dire che non hai il permesso di farlo. '
    + 'Ricarica la pagina: quello che vedi adesso potrebbe non essere aggiornato.'
  );
}

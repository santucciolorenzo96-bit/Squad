/* QUANTI PERIODI HA UNA PARTITA, E COME SI CHIAMANO.
 *
 * Era una domanda, all'avvio: «quanti periodi?», con i numeri da 2 a 6. È la
 * domanda sbagliata in tutti e due i casi che esistono.
 *
 * In AMICHEVOLE non interessa a nessuno. Si gioca finché si gioca: se le due
 * squadre decidono di chiudere al terzo si chiude al terzo, se vogliono farne
 * cinque se ne fanno cinque. Un numero deciso mezz'ora prima non vincola
 * niente, e la finestra che a fine partita avvisava «ne restano ancora due da
 * chiudere» stava allarmando chi aveva fatto esattamente quello che voleva.
 *
 * In una partita UFFICIALE la risposta la dà il regolamento, non chi segna:
 * quattro quarti. E se dopo il quarto le squadre sono in parità la partita non
 * è finita — si gioca un supplementare, e se anche quello finisce pari un
 * altro, finché qualcuno non vince. Un massimo non c'è, perché il regolamento
 * non ne prevede uno.
 *
 * Da qui discende l'altra cosa che questo file sa fare: il periodo numero
 * cinque di una partita ufficiale non è «il quinto quarto», è il PRIMO
 * SUPPLEMENTARE. Chiamarlo col numero assoluto costringe chi legge a fare la
 * sottrazione, e in un referto dove i periodi stanno in colonna quella
 * sottrazione la si fa sbagliata.
 *
 * In amichevole, invece, il quinto periodo è il quinto periodo: non c'è
 * nessuna fine prevista, quindi non c'è niente che venga «dopo».
 *
 * Quale sport ha i supplementari numerati e quale no non si indovina dal
 * conteggio: la pallavolo ha `count: 3` e arriva a cinque set, ma il quarto
 * set è il quarto set e non «il primo supplementare». Lo dicono gli sport, con
 * `period.extraNumerati`.
 */

/** Quanti periodi prevede il regolamento, supplementari esclusi. */
export function periodiRegolamentari(conf) {
  const n = conf && conf.period && conf.period.count;
  return n > 0 ? n : 1;
}

/** Questo periodo è un supplementare? In amichevole: mai. */
export function eSupplementare(conf, n, { amichevole = false } = {}) {
  if (amichevole) return false;
  if (!conf || !conf.period || !conf.period.extraNumerati) return false;
  return n > periodiRegolamentari(conf);
}

/* Il nome del periodo: «3º Periodo», «1º Supplementare».
 *
 * `breve` è per il tabellone, dove lo spazio è quello di un gettone: «P3»,
 * «S1». La lettera del supplementare viene dal suo nome, così non c'è una
 * seconda abbreviazione da tenere d'accordo con la prima.
 */
export function nomePeriodo(conf, n, { amichevole = false, breve = false } = {}) {
  const p = (conf && conf.period) || {};
  const numero = n > 0 ? n : 1;
  if (eSupplementare(conf, numero, { amichevole })) {
    const k = numero - periodiRegolamentari(conf);
    const nome = p.extraLabel || 'Supplementare';
    return breve ? nome.charAt(0).toUpperCase() + k : k + 'º ' + nome;
  }
  return breve
    ? (p.short || 'P') + numero
    : numero + 'º ' + (p.label || 'Periodo');
}

/* Quanti periodi restano da chiudere prima della fine PREVISTA.
 *
 * `chiusi` lo conta chi chiama (`quantiChiusi`, in referto.js): qui non si
 * importa, perché questo file lo legge anche il referto e due file che si
 * importano a vicenda non si caricano.
 *
 * In amichevole è sempre zero, e non è un'approssimazione: un'amichevole non
 * ha una fine prevista, quindi non c'è niente che le manchi.
 *
 * I periodi previsti sono quelli del REGOLAMENTO, non `numQuarters`. È una
 * differenza che si vede in partita: chiudendo il quarto periodo lo scout
 * apre comunque il quinto — serve, perché se la partita è pari il
 * supplementare si gioca e non c'è un altro modo di aprirlo — e così
 * `numQuarters` diventa cinque. Contando da lì, una normale vittoria
 * ufficiale al quarto quarto finiva con l'avviso «ne resta ancora uno da
 * chiudere» e il pulsante rosso: un allarme su una partita giocata per
 * intero, cioè il modo più rapido di insegnare a ignorare gli allarmi.
 *
 * Un supplementare non «manca» mai: esiste solo se è stato giocato, e se è
 * stato giocato è anche chiuso.
 */
export function periodiMancanti(conf, partita, chiusi) {
  if (!partita || partita.friendly) return 0;
  return Math.max(0, periodiRegolamentari(conf) - (chiusi > 0 ? chiusi : 0));
}

/* LA PARITÀ CHE NON È UN RISULTATO.
 *
 * Nel basket una partita ufficiale non può finire pari: si gioca un
 * supplementare. Nel calcio sì — un campionato finisce 1–1 e quello è il
 * risultato — e nella pallavolo non ci si arriva nemmeno, perché si contano i
 * set. Quindi non è una regola dello scout: è una regola dello SPORT, e sta
 * scritta là (`pareggioVietato`).
 *
 * In amichevole non vale: un'amichevole finisce quando le due squadre hanno
 * finito, e un pareggio è un pareggio.
 *
 * Non impedisce di archiviare, e non deve: una partita sospesa per un
 * infortunio al secondo quarto va messa via com'è. Serve a dire a chi sta per
 * chiuderla che quello che vede non è un risultato possibile — che è l'unica
 * cosa che l'app sa, e che chi segna può non aver guardato.
 */
export function pareggioImpossibile(conf, partita) {
  if (!conf || !conf.pareggioVietato) return false;
  if (!partita || partita.friendly) return false;
  return (partita.teamScore || 0) === (partita.oppScore || 0);
}

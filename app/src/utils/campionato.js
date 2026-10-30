/* I RISULTATI DEL CAMPIONATO.
 *
 * La classifica si può tenere in due modi, e l'app ha sempre avuto entrambi:
 *
 *   — DIGITATA: si scrivono le righe a mano, nome per nome, con giocate,
 *     vinte, perse e punti. Veloce il primo giorno, e sbagliata dal secondo —
 *     perché va riscritta ogni domenica e nessuno lo fa;
 *   — CALCOLATA: si inseriscono i RISULTATI delle partite del girone, e la
 *     classifica viene da sé, con le regole punti dello sport.
 *
 * La seconda era già costruita per intero — `computeStandings` sa fare
 * l'aritmetica di tutti e tre gli sport — ma viveva nella vecchia interfaccia,
 * e nella nuova non c'era nessun posto da cui inserire un risultato. Quindi la
 * classifica non si aggiornava mai, perché l'unica che si poteva usare era
 * quella da riscrivere a mano.
 *
 * QUALE DELLE DUE VALE non è una preferenza da chiedere: lo dicono i dati.
 * Appena esiste un risultato giocato la classifica si calcola; finché non ce
 * n'è nessuno resta quella digitata. Così chi aveva già scritto la sua tabella
 * non la perde, e chi inserisce il primo risultato non deve anche ricordarsi
 * di cambiare un interruttore.
 *
 * Qui dentro ci sono le regole, senza niente che riguardi lo schermo o il
 * database: quali partite contano, quando la classifica si calcola, e qual è
 * la riga di calendario che corrisponde a un risultato.
 */

/* Solo la stagione regolare fa classifica. I playoff sono un altro tabellone,
 * e sommarli al girone darebbe una classifica che non esiste in nessun
 * documento della federazione. */
export function soloRegolare(partite) {
  return (Array.isArray(partite) ? partite : [])
    .filter(m => m && (m.phase || 'regular') === 'regular');
}

/* Giocata vuol dire che ci sono TUTTI E DUE i punteggi. Con uno solo non si sa
 * chi ha vinto, e una riga mezza riempita non deve muovere una classifica. */
export function giocate(partite) {
  return (Array.isArray(partite) ? partite : [])
    .filter(m => m && m.home_score != null && m.away_score != null);
}

/** La classifica si calcola appena c'è un risultato vero. */
export function siCalcola(partite) {
  return giocate(soloRegolare(partite)).length > 0;
}

const chiave = (s) => String(s || '').trim().toLowerCase();

/* LA PARTITA È NOSTRA?
 *
 * Il confronto è sul nome, perché una riga di campionato ha due nomi di
 * squadra e non due identificativi: i risultati delle altre squadre li scrive
 * una persona leggendo un sito, e quella persona scrive nomi.
 *
 * Confronto esatto, non «contiene». Con «contiene», una società che si chiama
 * «Basket» riconoscerebbe come propria ogni partita del girone — e si
 * porterebbe in calendario i risultati di tutti. Il nome va scritto come
 * quello della società: se non combacia, la partita è di altri, che è il caso
 * prudente.
 */
export function nostraPartita(m, nostroNome) {
  if (!m) return null;
  const noi = chiave(nostroNome);
  if (!noi) return null;
  const inCasa = chiave(m.home_team) === noi;
  const fuori = chiave(m.away_team) === noi;
  if (!inCasa && !fuori) return null;
  return {
    inCasa,
    avversario: inCasa ? m.away_team : m.home_team,
    nostriPunti: inCasa ? m.home_score : m.away_score,
    loroPunti: inCasa ? m.away_score : m.home_score
  };
}

/* LA RIGA DI CALENDARIO CHE CORRISPONDE A UN RISULTATO.
 *
 * Serve perché due schermate che si contraddicono sullo stesso evento sono
 * peggio di una sola incompleta: inserito il nostro risultato, quella partita
 * non deve restare «da giocare» in calendario.
 *
 * Si riconosce per giornata e avversario, oppure per data e avversario. Due
 * vie perché un calendario caricato da un PDF può avere la giornata e non la
 * data giusta — una partita rinviata — o la data e non la giornata.
 *
 * Senza punteggi non si cerca niente: un accoppiamento inserito in anticipo,
 * senza risultato, non deve dichiarare giocata nessuna partita.
 */
export function rigaDiCalendario(calendario, m, nostroNome) {
  const nostra = nostraPartita(m, nostroNome);
  if (!nostra || nostra.nostriPunti == null || nostra.loroPunti == null) return null;
  const avv = chiave(nostra.avversario);
  if (!avv) return null;

  return (Array.isArray(calendario) ? calendario : []).find(x => x && (
    (m.giornata != null && x.giornata === m.giornata && chiave(x.opponent) === avv)
    || (m.date && x.date === m.date && chiave(x.opponent) === avv)
  )) || null;
}

/* Le partite raggruppate per giornata, dalla più recente.
 *
 * Dalla più recente perché è quella che si sta inserendo: una domenica si
 * aprono i risultati per scrivere quelli di oggi, non per rileggere la prima
 * giornata. Le partite senza giornata — un recupero, un'amichevole finita qui
 * per sbaglio — stanno in fondo, in un gruppo senza numero: non si nascondono,
 * perché una riga che non si vede è una riga che si inserisce due volte.
 */
export function perGiornata(partite) {
  const gruppi = new Map();
  (Array.isArray(partite) ? partite : []).forEach(m => {
    if (!m) return;
    const g = m.giornata == null ? null : Number(m.giornata);
    const k = g == null ? 'senza' : g;
    if (!gruppi.has(k)) gruppi.set(k, { giornata: g, partite: [] });
    gruppi.get(k).partite.push(m);
  });

  const conNumero = [...gruppi.values()].filter(x => x.giornata != null)
    .sort((a, b) => b.giornata - a.giornata);
  const senza = gruppi.get('senza');
  return senza ? [...conNumero, senza] : conNumero;
}

/* La giornata su cui si sta lavorando: la più alta vista finora.
 *
 * È il valore con cui si apre il modulo di un risultato nuovo, e fa risparmiare
 * il gesto che si ripete di più — inserendo cinque risultati della stessa
 * giornata, quattro volte su cinque il numero è già quello giusto.
 */
export function giornataInCorso(partite) {
  let massima = 0;
  (Array.isArray(partite) ? partite : []).forEach(m => {
    const g = m && m.giornata != null ? Number(m.giornata) : 0;
    if (g > massima) massima = g;
  });
  return massima > 0 ? massima : 1;
}

/* LE PARTITE DI UNA SQUADRA, dal suo punto di vista.
 *
 * `nostraPartita` sa già girare una riga dal punto di vista di un nome — e
 * quel nome non deve essere il nostro: è parametrico, e quindi serve anche per
 * guardare una squadra avversaria dalla sua parte.
 *
 * Si tengono anche le partite SENZA punteggio: sono il calendario di quella
 * squadra, e vederle in fondo dice quante ne ha ancora da giocare. Una scheda
 * che mostra solo le giocate fa sembrare finito un campionato a metà.
 */
export function partiteDi(partite, nome) {
  return (Array.isArray(partite) ? partite : [])
    .map(m => {
      const vista = nostraPartita(m, nome);
      if (!vista) return null;
      const giocata = vista.nostriPunti != null && vista.loroPunti != null;
      return {
        partita: m,
        giornata: m.giornata == null ? null : Number(m.giornata),
        date: m.date || null,
        inCasa: vista.inCasa,
        avversario: vista.avversario,
        punti: vista.nostriPunti,
        subiti: vista.loroPunti,
        giocata,
        // `null` e non `false` per una partita da giocare: «non ha vinto» e
        // «non ha ancora giocato» sono due cose diverse, e un colore che le
        // mescola racconta una sconfitta che non c'è stata.
        vinta: giocata ? vista.nostriPunti > vista.loroPunti : null,
        pari: giocata ? vista.nostriPunti === vista.loroPunti : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      // Per giornata, e le senza giornata in fondo: è l'ordine in cui un
      // campionato si legge.
      if (a.giornata == null) return b.giornata == null ? 0 : 1;
      if (b.giornata == null) return -1;
      return a.giornata - b.giornata;
    });
}

/* I NUMERI DI UNA RIGA DI CLASSIFICA, con le medie.
 *
 * I totali li ha già calcolati `computeStandings` con le regole dello sport:
 * qui non si ricontano, si dividono. Ricontarli vorrebbe dire una seconda
 * aritmetica che prima o poi dice un numero diverso dalla tabella accanto.
 *
 * Le medie sono `null` senza partite giocate, non zero: una squadra che non ha
 * ancora giocato non ha una media di zero punti, non ha una media.
 */
export function numeriSquadra(riga, sport) {
  const extras = ((sport && sport.standings) || {}).extras || [];
  const chiaveFatti = (extras.find(e => e.role === 'scored') || {}).key;
  const chiaveSubiti = (extras.find(e => e.role === 'conceded') || {}).key;
  const stats = (riga && riga.stats) || {};
  const num = (k) => {
    const v = k ? stats[k] : null;
    return typeof v === 'number' ? v : (parseInt(v, 10) || 0);
  };

  const giocate = Math.max(0, Number((riga || {}).played) || 0);
  const fatti = num(chiaveFatti);
  const subiti = num(chiaveSubiti);

  return {
    giocate,
    vinte: Number((riga || {}).wins) || 0,
    pari: Number((riga || {}).draws) || 0,
    perse: Number((riga || {}).losses) || 0,
    punti: Number((riga || {}).points) || 0,
    fatti,
    subiti,
    differenza: fatti - subiti,
    mediaFatti: giocate ? fatti / giocate : null,
    mediaSubiti: giocate ? subiti / giocate : null
  };
}

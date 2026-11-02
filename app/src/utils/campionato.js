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

/* SIAMO NOI?
 *
 * Il nome con cui una società si chiama in anagrafica e quello con cui la
 * scrive la federazione non sono lo stesso: «Cestistica Etnea» contro
 * «CESTISTICA ETNEA BASKET». Confrontandoli per intero non combaciano, e da
 * quel confronto dipendono tre cose che l'utente vede:
 *
 *   — la riga della propria squadra evidenziata in classifica;
 *   — il logo della propria società, che vive in un altro posto
 *     (`teams.logo_url`) e si attacca per nome;
 *   — la posizione in classifica mostrata nella scheda della prossima partita.
 *
 * Tutte e tre non funzionavano, e il sintomo era uno solo: «perché il nostro
 * logo non appare?».
 *
 * LA REGOLA NON È «CONTIENE», ed è importante: una società che si chiama
 * «Basket» riconoscerebbe come propria ogni squadra del girone. Il nome corto
 * deve stare all'INIZIO o alla FINE di quello lungo, e su un confine di parola
 * — «CESTISTICA ETNEA BASKET» comincia con «Cestistica Etnea» seguito da uno
 * spazio — e deve essere lungo almeno cinque caratteri, perché con tre lettere
 * le coincidenze non sono coincidenze.
 */
export function siamoNoi(nome, nostroNome) {
  const a = chiave(nome);
  const b = chiave(nostroNome);
  if (!a || !b) return false;
  if (a === b) return true;

  const lungo = a.length >= b.length ? a : b;
  const corto = a.length >= b.length ? b : a;
  if (corto.length < 5) return false;

  if (lungo.startsWith(corto) && lungo.charAt(corto.length) === ' ') return true;
  if (lungo.endsWith(corto) && lungo.charAt(lungo.length - corto.length - 1) === ' ') return true;
  return false;
}

/* IL LOGO DI UNA SQUADRA, da qualunque dei due posti arrivi.
 *
 * Quelli delle avversarie stanno sulla riga di classifica (`logo_path`, da cui
 * si ricava un URL firmato); il nostro vive in `teams.logo_url`, perché è il
 * logo della società e lo si carica una volta sola da Squadra.
 *
 * Il più specifico vince: se qualcuno ha caricato un logo sulla NOSTRA riga di
 * classifica, è quello che voleva vedere in classifica. Altrimenti si ricade
 * sul logo della società — che è la risposta a «perché il nostro non appare
 * in automatico?»: appariva solo caricandolo due volte.
 */
export function logoDi(nome, loghi, { nostroNome, logoNostro } = {}) {
  const k = chiave(nome);
  if (!k) return null;
  const suo = (loghi || {})[k];
  if (suo) return suo;
  if (logoNostro && siamoNoi(nome, nostroNome)) return logoNostro;
  return null;
}

/* COME CI CHIAMA QUESTO CAMPIONATO.
 *
 * Due nomi per la stessa società: «Cestistica Etnea» in anagrafica,
 * «CESTISTICA ETNEA BASKET» nei documenti della federazione.
 *
 * La tentazione è rinominare la società col nome federale, per averne uno
 * solo. Sarebbe un errore, e per tre ragioni:
 *
 *   — quel nome è in maiuscolo e porta le sigle. Finisce nel tabellone durante
 *     la partita, nell'intestazione di ogni referto, nella scheda della
 *     prossima partita: posti dove si legge di sfuggita e dove ventitré
 *     caratteri in maiuscolo vengono troncati;
 *   — cambia da un documento all'altro. «BASKET», «ASD», «POL.», «S.S.D.»:
 *     allineandosi a questo PDF si sbaglia col prossimo, e la coincidenza
 *     tornerebbe a rompersi senza dirlo;
 *   — una società con due sezioni ha DUE nomi federali, uno per federazione.
 *     Il nome della società non può essere entrambi.
 *
 * Il nome da mostrare e il nome con cui ci chiama il campionato sono due cose
 * diverse. La seconda però non va indovinata ogni volta: si trova UNA volta
 * nell'elenco delle squadre del girone — la riga contrassegnata «siamo noi» —
 * e da lì in poi i confronti con i risultati sono esatti, non somiglianze.
 *
 * `siamoNoi` resta, e serve esattamente per trovare quella riga la prima volta
 * e per attaccare il logo della società al nome federale.
 */
export function nomeDiLega(standings, nostroNome) {
  const righe = Array.isArray(standings) ? standings : [];
  const nostra = righe.find(r => r && r.is_us && String(r.team_name || '').trim());
  if (nostra) return String(nostra.team_name).trim();
  // Nessuna riga contrassegnata: si cerca quella che somiglia, e la si usa
  // senza scriverla da nessuna parte.
  const simile = righe.find(r => r && siamoNoi(r.team_name, nostroNome));
  if (simile) return String(simile.team_name).trim();
  // Nessun girone caricato: il nome della società è l'unico che c'è.
  return String(nostroNome || '').trim();
}

/* QUALE RIGA DEL GIRONE È LA NOSTRA, IN UNA GIORNATA.
 *
 * Serve a far entrare in classifica il risultato di una partita segnata con lo
 * scout, aggiornando la riga che il calendario aveva già caricato invece di
 * crearne una seconda.
 *
 * L'ancoraggio è la GIORNATA più il nostro nome, e non la coppia dei due nomi.
 * Con la coppia basta che l'avversario sia scritto in modo diverso nelle due
 * schermate — e succede, perché caricando il calendario i nomi federali si
 * possono accorciare — e il risultato finirebbe su una riga nuova: due righe
 * per la stessa partita, una col punteggio e una «da giocare».
 *
 * In un girone una squadra gioca una partita per giornata, quindi la giornata
 * e il nostro nome identificano una riga sola. Se ce ne fosse più di una —
 * un recupero inserito a mano nella stessa giornata — non si indovina: si
 * restituisce null e il risultato si scrive a mano, che è il caso prudente.
 */
export function rigaNostraDiGiornata(righe, nomeLega, giornata) {
  const noi = chiave(nomeLega);
  if (!noi) return null;
  const g = giornata == null ? null : Number(giornata);

  const nostre = (Array.isArray(righe) ? righe : []).filter(m => m
    && (m.giornata == null ? null : Number(m.giornata)) === g
    && (chiave(m.home_team) === noi || chiave(m.away_team) === noi));

  return nostre.length === 1 ? nostre[0] : null;
}

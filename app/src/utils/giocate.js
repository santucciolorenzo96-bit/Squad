import { doveSiGioca, IGNOTO } from './dove.js';

/* LE PARTITE GIOCATE, UNA VOLTA SOLA.
 *
 * «Calendario → Giocate» e «Classifica → Storico» erano due elenchi diversi
 * della stessa cosa, e non concordavano:
 *
 *   — Giocate erano le righe di CALENDARIO con un risultato. Una partita
 *     seguita con lo scout senza una riga di calendario — si apre lo scout e
 *     si scrive il nome dell'avversario — non c'era;
 *   — lo Storico erano i TABELLINI archiviati. Una partita il cui punteggio è
 *     stato scritto a mano in calendario, senza scout, non c'era;
 *   — e una partita che ha tutte e due le cose compariva in tutti e due, come
 *     se fossero due partite.
 *
 * Una partita giocata è UN evento con al massimo due corpi: il risultato — che
 * c'è sempre — e il tabellino, che c'è solo se qualcuno l'ha seguita. Qui i due
 * elenchi diventano uno.
 *
 * COME SI RICONOSCE CHE SONO LA STESSA PARTITA: `calendarMatchId`, che il
 * tabellino porta da quando è stato aperto da quella riga. Dove non c'è — le
 * partite aperte prima che quel legame esistesse — si prova con avversario e
 * data, che è il legame che un umano usa e che sbaglia solo se la stessa
 * squadra si affronta due volte nello stesso giorno.
 *
 * QUANDO I DUE PUNTEGGI NON COINCIDONO vince il TABELLINO, e non si nasconde
 * la discordanza: il tabellino è il risultato che qualcuno ha segnato azione
 * per azione, la riga di calendario ne è la copia scritta a fine partita. Se
 * differiscono, qualcuno ha corretto una delle due a mano, e chi guarda deve
 * poterlo sapere invece di vedere due numeri diversi in due schermate.
 */

const chiave = (s) => String(s || '').trim().toLowerCase();
const giorno = (d) => String(d || '').slice(0, 10);

/* La riga di calendario di un tabellino. Prima per legame, poi per avversario
 * e data. */
export function rigaDelTabellino(calendario, g) {
  const righe = Array.isArray(calendario) ? calendario : [];
  if (!g) return null;
  if (g.calendarMatchId) {
    const per = righe.find(m => m && m.id === g.calendarMatchId);
    if (per) return per;
  }
  const avv = chiave(g.oppName);
  const data = giorno(g.date);
  if (!avv || !data) return null;
  return righe.find(m => m && chiave(m.opponent) === avv && giorno(m.date) === data) || null;
}

function daRiga(m, tabellino) {
  const nostriRiga = m.team_score == null ? null : Number(m.team_score);
  const loroRiga = m.opp_score == null ? null : Number(m.opp_score);
  const nostriTab = tabellino ? Number(tabellino.teamScore) : null;
  const loroTab = tabellino ? Number(tabellino.oppScore) : null;

  return {
    chiave: 'c' + m.id,
    data: m.date || (tabellino ? giorno(tabellino.date) : null),
    giornata: m.giornata == null ? null : Number(m.giornata),
    avversario: m.opponent || (tabellino ? tabellino.oppName : ''),
    dove: doveSiGioca(m),
    // Il tabellino vince: e` il risultato segnato azione per azione.
    nostriPunti: tabellino ? nostriTab : nostriRiga,
    loroPunti: tabellino ? loroTab : loroRiga,
    amichevole: !!(tabellino ? tabellino.friendly : m.friendly),
    rigaCalendario: m,
    tabellino: tabellino || null,
    /* I due numeri non coincidono: qualcuno ne ha corretto uno a mano. Non si
     * sceglie in silenzio — si dice, perche` l'altro numero esiste ancora da
     * qualche parte e prima o poi qualcuno lo trovera`. */
    discorde: !!(tabellino && nostriRiga != null && loroRiga != null
      && (nostriRiga !== nostriTab || loroRiga !== loroTab)),
    puntiCalendario: nostriRiga == null || loroRiga == null ? null : { us: nostriRiga, them: loroRiga }
  };
}

function daTabellino(g) {
  return {
    chiave: 'g' + (g.id || g.oppName + giorno(g.date)),
    data: giorno(g.date),
    giornata: null,
    avversario: g.oppName || '',
    // Una partita aperta dallo scout non sa dove si gioca: `games` non ha quel
    // campo. Resta «da definire» invece di diventare «in casa».
    dove: IGNOTO,
    nostriPunti: g.teamScore == null ? null : Number(g.teamScore),
    loroPunti: g.oppScore == null ? null : Number(g.oppScore),
    amichevole: !!g.friendly,
    rigaCalendario: null,
    tabellino: g,
    discorde: false,
    puntiCalendario: null
  };
}

/**
 * Tutte le partite giocate, dalla più recente.
 *
 * @param calendario `state.calendar`
 * @param storico    `state.history` — i tabellini archiviati
 */
export function partiteGiocate(calendario, storico) {
  const righe = Array.isArray(calendario) ? calendario : [];
  const tabellini = Array.isArray(storico) ? storico : [];

  // A ogni riga di calendario il suo tabellino, se c'è.
  const usati = new Set();
  const perRiga = new Map();
  tabellini.forEach(g => {
    if (!g) return;
    const m = rigaDelTabellino(righe, g);
    if (!m) return;
    // Due tabellini sulla stessa riga non dovrebbero esistere; se succede
    // vince il primo e il secondo resta una partita a sé, visibile.
    if (perRiga.has(m.id)) return;
    perRiga.set(m.id, g);
    usati.add(g);
  });

  const fuori = [];
  righe.forEach(m => {
    if (!m) return;
    const tab = perRiga.get(m.id) || null;
    // Giocata vuol dire: ha un risultato in calendario, oppure ha un
    // tabellino archiviato. Senza nessuno dei due è una partita da giocare.
    if (!m.played && !tab) return;
    fuori.push(daRiga(m, tab));
  });

  // I tabellini che non hanno trovato una riga: sono partite giocate anche
  // loro, e prima si vedevano solo nello Storico.
  tabellini.forEach(g => { if (g && !usati.has(g)) fuori.push(daTabellino(g)); });

  return fuori.sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')));
}

/* UNA VOCE DELL'ELENCO, NELLA FORMA DI UNA RIGA DI CALENDARIO.
 *
 * Le due schermate hanno righe già rifinite, costruite su quella forma — il
 * riquadro della giornata, la pastiglia del campo, il punteggio a destra — e
 * riscriverle per unire i due elenchi vorrebbe dire rifare due disegni che
 * funzionano. Qui una partita che esiste solo come tabellino prende quella
 * forma: così l'elenco diventa uno e il disegno resta quello.
 *
 * `voce` resta attaccata, perché porta le cose che una riga di calendario non
 * sa dire: il tabellino da aprire e la discordanza fra i due punteggi.
 * `soloTabellino` dice che non c'è una riga vera dietro, e quindi che i comandi
 * del calendario — modifica, elimina, segna il risultato — non hanno niente su
 * cui agire.
 */
export function comeRigaDiCalendario(voce) {
  if (!voce) return null;
  if (voce.rigaCalendario) {
    return { ...voce.rigaCalendario, voce, soloTabellino: false };
  }
  const g = voce.tabellino || {};
  return {
    id: voce.chiave,
    opponent: voce.avversario,
    date: voce.data,
    time: null,
    location: null,
    giornata: null,
    home: null,              // `games` non sa dove si gioca: non si indovina
    played: true,
    team_score: voce.nostriPunti,
    opp_score: voce.loroPunti,
    friendly: voce.amichevole,
    sector_id: g.sectorId || null,
    voce,
    soloTabellino: true
  };
}

/* LE VOCI NELLA FORMA CHE SI ASPETTANO I CONTI DI STAGIONE.
 *
 * `computeRecord`, `computeStreak` e `computeTeamPPG` leggono i tabellini:
 * `teamScore`, `oppScore`, `friendly`. Finora ricevevano `state.history`, cioè
 * i soli tabellini archiviati — quindi un risultato scritto a mano in
 * calendario non entrava nel bilancio della stagione: la squadra aveva vinto
 * una partita e il record diceva un'altra cosa.
 *
 * Due accortezze, e sono entrambe difetti se mancano:
 *
 *   — in ordine CRONOLOGICO crescente, perché `computeStreak` conta la serie
 *     partendo dal fondo: con l'ordine rovesciato darebbe la serie più vecchia
 *     invece di quella in corso;
 *   — senza le partite SENZA punteggio, perché «null contro null» passerebbe
 *     per un pareggio e il record conterebbe pareggi che nessuno ha giocato.
 */
export function comeTabellini(voci) {
  return (Array.isArray(voci) ? voci : [])
    .filter(v => v && v.nostriPunti != null && v.loroPunti != null)
    .slice()
    .sort((a, b) => String(a.data || '').localeCompare(String(b.data || '')))
    .map(v => ({
      teamScore: v.nostriPunti,
      oppScore: v.loroPunti,
      friendly: v.amichevole,
      date: v.data,
      players: (v.tabellino && v.tabellino.players) || []
    }));
}

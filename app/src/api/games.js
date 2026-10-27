import { supabase } from '../supabaseClient.js';
import { stagioneAttiva } from './stagione.js';
import {
  motivoDelRifiuto, SPIEGAZIONE, siRiprova,
  motivoArchivioMancato, SPIEGAZIONE_ARCHIVIO
} from '../utils/salvataggio.js';

function fromDbGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    sectorId: row.sector_id,
    oppName: row.opp_name,
    quarterLength: row.quarter_length,
    numQuarters: row.num_quarters,
    quarter: row.quarter,
    clock: row.clock,
    clockRunning: row.clock_running,
    /* Da quando il cronometro sta scorrendo (062). Senza questo istante
     * «quanto manca adesso» non si puo' calcolare, e una pagina ricaricata a
     * meta' periodo ritroverebbe il tempo di quando e' stato avviato. */
    clockFrom: row.clock_from || null,
    teamScore: row.team_score,
    oppScore: row.opp_score,
    quarterFouls: row.quarter_fouls || {},
    periodScores: row.period_scores || [],
    calendarMatchId: row.calendar_match_id || null,
    friendly: !!row.friendly,
    // Il registro dei quintetti e il turno aperto: senza di loro il piu'/meno
    // si azzererebbe a ogni ricaricamento della pagina, e il tabellino
    // tornerebbe indietro senza dire niente.
    quintetti: row.quintetti || {},
    turno: row.turno || null,
    /* Quanti periodi sono finiti, e se la partita è finita.
     *
     * `chiusi` non veniva né letto né scritto: viveva solo in memoria durante
     * la partita e spariva al primo salvataggio. Il referto di un 3-0
     * archiviato ne mostrava due, perché senza quel numero ripiega sul set in
     * corso meno uno — e l'ultimo set di una partita decisa non ne apre un
     * altro. Il punteggio invece era giusto, calcolato mentre il dato c'era:
     * il documento si contraddiceva da solo. */
    chiusi: row.chiusi || 0,
    status: row.status,
    /* Il registro delle azioni, in ordine. I totali dicono quanto, questo dice
     * quando — ed e' l'unico modo per sapere il massimo vantaggio, il parziale
     * piu' lungo e com'e' andato ogni quarto. Le partite archiviate prima
     * della migrazione 054 non ce l'hanno, e le sezioni che ci si appoggiano
     * semplicemente non compaiono. */
    storia: row.storia || [],
    // Da quale versione parte questo dispositivo, e chi ha scritto per ultimo.
    revisione: row.revisione || 0,
    tenutoDa: row.tenuto_da || null,
    tenutoAlle: row.tenuto_alle || null,
    players: row.players || [],
    startedBy: row.started_by,
    startedAt: row.started_at,
    date: row.ended_at || row.started_at
  };
}

function toDbPatch(g) {
  const patch = {};
  if ('oppName' in g) patch.opp_name = g.oppName;
  if ('quarterLength' in g) patch.quarter_length = g.quarterLength;
  if ('numQuarters' in g) patch.num_quarters = g.numQuarters;
  if ('quarter' in g) patch.quarter = g.quarter;
  if ('clock' in g) patch.clock = g.clock;
  if ('clockRunning' in g) patch.clock_running = g.clockRunning;
  // Fermare il cronometro mette `clockFrom` a null, e quel null va scritto:
  // e' l'informazione «il numero in `clock` e' quello giusto».
  if ('clockFrom' in g) patch.clock_from = g.clockFrom || null;
  if ('teamScore' in g) patch.team_score = g.teamScore;
  if ('oppScore' in g) patch.opp_score = g.oppScore;
  if ('quarterFouls' in g) patch.quarter_fouls = g.quarterFouls;
  if ('periodScores' in g) patch.period_scores = g.periodScores;
  if ('calendarMatchId' in g) patch.calendar_match_id = g.calendarMatchId;
  if ('friendly' in g) patch.friendly = !!g.friendly;
  if ('quintetti' in g) patch.quintetti = g.quintetti || {};
  if ('turno' in g) patch.turno = g.turno || null;
  if ('storia' in g) patch.storia = g.storia || [];
  if ('chiusi' in g) patch.chiusi = g.chiusi || 0;
  if ('players' in g) patch.players = g.players;
  return patch;
}

// Una colonna mancante significa quasi sempre una migrazione non ancora
// eseguita. Il messaggio di Postgres è corretto ma criptico: qui diventa
// un'istruzione, altrimenti l'unico sintomo è "non funziona".
function describeWriteError(error) {
  const msg = (error && error.message) || '';
  if (/period_scores/.test(msg)) {
    return new Error('Manca la colonna period_scores sulla tabella games: esegui la migrazione 017 su Supabase, poi riprova.');
  }
  if (/quintetti|turno/.test(msg)) {
    return new Error('Mancano le colonne quintetti e turno sulla tabella games: esegui la migrazione 036 su Supabase, poi riprova.');
  }
  if (/\bstoria\b/.test(msg)) {
    return new Error('Manca la colonna storia sulla tabella games: esegui la migrazione 054 su Supabase, poi riprova.');
  }
  if (/\bchiusi\b/.test(msg)) {
    return new Error('Manca la colonna chiusi sulla tabella games: esegui la migrazione 055 su Supabase, poi riprova.');
  }
  if (/salva_tabellino|revisione|tenuto_/.test(msg)) {
    return new Error('Manca la funzione salva_tabellino: esegui la migrazione 038 su Supabase, poi riprova.');
  }
  return error;
}

export async function fetchLiveGame(sectorId) {
  // `is('deleted_at', null)`: un tabellino nel cestino non e` una partita in
  // corso. Senza questo filtro lo scout lo riaprirebbe come se niente fosse,
  // e `salva_tabellino` poi rifiuterebbe ogni azione.
  const { data, error } = await supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'live')
    .is('deleted_at', null).maybeSingle();
  if (error) throw error;
  return fromDbGame(data);
}

// Lo storico e' quello della stagione: senza il filtro, media punti, record e
// miglior marcatore continuerebbero a sommarsi di anno in anno.
export async function fetchHistory(sectorId, seasonId) {
  let q = supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'finished')
    .is('deleted_at', null);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q.order('started_at');
  if (error) throw error;
  return data.map(fromDbGame);
}

export async function startGame(teamId, sectorId, liveGame, startedByProfileId) {
  const { data, error } = await supabase.from('games').insert({
    team_id: teamId,
    sector_id: sectorId,
    // Senza stagione la partita spariva dallo storico appena finita:
    // `fetchHistory` filtra per stagione, e una riga senza non la trova
    // nessuna stagione. Vedi api/stagione.js.
    season_id: stagioneAttiva(),
    status: 'live',
    ...toDbPatch(liveGame),
    started_by: startedByProfileId
  }).select().single();
  if (error) throw describeWriteError(error);
  return fromDbGame(data);
}

/* IL SALVATAGGIO CHE NON PUO' SOVRASCRIVERE NESSUNO.
 *
 * Prima era un UPDATE cieco: prendeva tutto quello che aveva in mano il
 * dispositivo e lo scriveva sopra a quello che c'era. Bastava la curiosita'
 * per perdere una partita — il dirigente che apre Scout dal telefono per
 * guardare il punteggio riscriveva l'intera riga con la sua copia, e tutto
 * quello che il tablet aveva segnato nel frattempo spariva. Senza un errore.
 *
 * Adesso ogni salvataggio dichiara da quale revisione parte, e il database
 * scrive solo se e' ancora quella. Se non lo e' non scrive niente e risponde
 * null: non e' un guasto tecnico, e' «un altro e' arrivato prima», ed e' una
 * cosa che va detta a chi sta segnando invece che riprovata di nascosto.
 *
 * Il confronto e la scrittura stanno nella stessa funzione del database
 * perche' devono essere un gesto solo: leggere, confrontare e scrivere in tre
 * richieste separate lascia in mezzo lo spazio perche' l'altro dispositivo
 * scriva, che e' il difetto che stiamo chiudendo.
 */
/* Perche' un salvataggio non ha scritto niente: la regola sta in
 * `utils/salvataggio.js`, dove si puo' provare. Qui c'e' solo la lettura.
 *
 * Costa una richiesta in piu' SOLO quando qualcosa e' andato storto, cioe'
 * quasi mai. */
async function perche(gameId, revisioneNostra) {
  try {
    const { data } = await supabase.from('games')
      .select('status, revisione, tenuto_da, tenuto_alle')
      .eq('id', gameId).maybeSingle();
    return motivoDelRifiuto(data, revisioneNostra);
  } catch (e) {
    // Se nemmeno questa lettura passa, non c'e' rete: e allora il salvataggio
    // non era un conflitto, era la palestra.
    return { motivo: 'rete' };
  }
}

export async function saveLiveGame(gameId, liveGame) {
  const mia = liveGame.revisione || 0;
  const { data, error } = await supabase.rpc('salva_tabellino', {
    p_game: gameId,
    p_revisione: mia,
    p_patch: toDbPatch(liveGame)
  });
  if (error) throw describeWriteError(error);
  if (data == null) {
    const esito = await perche(gameId, mia);
    const e = new Error(SPIEGAZIONE[esito.motivo] || SPIEGAZIONE.superata);
    /* `motivo` dice QUALE delle tre, e il chiamante si comporta di
     * conseguenza: su una partita chiusa non c'e' niente da riprovare, su un
     * sorpasso riprovare vorrebbe dire scrivere sopra al lavoro di un altro,
     * e sulla rete assente riprovare e' esattamente la cosa giusta. */
    e.motivo = esito.motivo;
    e.dettagli = esito;
    // Resta per compatibilita': tutto cio' che non e' rete si comporta come
    // un conflitto, cioe' non si riprova da solo.
    e.conflitto = !siRiprova(esito.motivo);
    throw e;
  }
  // La revisione nuova diventa quella da cui parte il prossimo salvataggio.
  liveGame.revisione = data;
}

/* PERCHE` UNA PARTITA NON SI E` ARCHIVIATA.
 *
 * Stessa forma di `perche` qui sopra, e per la stessa ragione: un update che
 * non trova la riga non e` un errore, e` un update di zero righe. La regola
 * sta in `utils/salvataggio.js`, dove si puo` provare; qui c'e` solo la
 * lettura, e costa una richiesta in piu` SOLO quando qualcosa e` andato
 * storto — cioe` quasi mai.
 */
async function percheNonArchiviata(gameId) {
  try {
    const { data } = await supabase.from('games')
      .select('id').eq('id', gameId).maybeSingle();
    return motivoArchivioMancato(data);
  } catch (e) {
    return motivoArchivioMancato(null, { rete: true });
  }
}

/* ARCHIVIARE, E ACCORGERSI DI NON AVERLO FATTO.
 *
 * `.select('id')` non e` un ornamento: e` la differenza fra «archiviata» e
 * «non ho scritto niente», che senza di lui sono indistinguibili. Quello che
 * viene dopo questa chiamata, nello scout, e` irreversibile — il risultato in
 * calendario, la copia locale cancellata, la partita via dalla memoria — e
 * si deve poter fermare. Per questo si LANCIA: la finestra di conferma mostra
 * l'errore e non si chiude, e la partita resta dov'e`.
 */
export async function endGame(gameId, liveGame) {
  const { data, error } = await supabase.from('games').update({
    ...toDbPatch(liveGame),
    status: 'finished',
    ended_at: new Date().toISOString()
  }).eq('id', gameId).select('id');
  if (error) throw describeWriteError(error);
  if (!data || data.length === 0) {
    const esito = await percheNonArchiviata(gameId);
    const e = new Error(SPIEGAZIONE_ARCHIVIO[esito.motivo] || SPIEGAZIONE_ARCHIVIO.assente);
    e.motivo = esito.motivo;
    throw e;
  }
}

export function subscribeLiveGame(sectorId, onChange) {
  const channel = supabase.channel(`games-live-${sectorId}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'games', filter: `sector_id=eq.${sectorId}` },
      payload => onChange(payload)
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

// Partite rimaste aperte in TUTTA la società, non nel solo settore attivo.
// L'app carica la partita dal vivo per settore, quindi una lasciata a metà in
// un'altra categoria resta invisibile pur bloccando le altre: va mostrata.
export async function fetchOpenGames(teamId) {
  const { data, error } = await supabase.from('games')
    .select('id, sector_id, opp_name, started_at, sectors(name)')
    .eq('team_id', teamId).eq('status', 'live').is('deleted_at', null);
  if (error) throw error;
  return data;
}

/* ELIMINARE UN TABELLINO SENZA PERDERLO (migrazione 061).
 *
 * Non si cancella piu` la riga: si scrive QUANDO e CHI. La partita esce da
 * storico, statistiche e classifica — che e` tutto quello che serviva a chi
 * elimina — e resta recuperabile.
 *
 * Il motivo sta in due partite perse: il 21 e il 26 ottobre 2026 sono
 * scomparse, e non si e` potuto sapere se qualcuno le avesse eliminate,
 * perche` una riga cancellata non lascia niente dietro di se`. La causa vera
 * era un'altra (`endGame` che non si accorgeva di non aver scritto), ma per
 * scoprirlo sono servite due ipotesi e mezza giornata.
 *
 * `.select('id')` resta, e per la ragione di prima: un update che la
 * sicurezza a livello di riga filtra via non e` un errore, e` un update di
 * zero righe. Il trigger `games_elimina_solo_admin` lo rifiuta a chi non
 * amministra, e la` l'errore arriva — ma se un domani la policy cambiasse,
 * questo controllo e` quello che impedisce un «eliminato» annunciato a vuoto.
 */
export async function eliminaTabellino(gameId, profileId) {
  const { data, error } = await supabase.from('games')
    .update({ deleted_at: new Date().toISOString(), deleted_by: profileId || null })
    .eq('id', gameId).is('deleted_at', null).select('id');
  if (error) throw descriviErroreCestino(error, 'eliminato');
  if (!data || data.length === 0) {
    throw new Error(
      'Il tabellino non è stato eliminato: il database ha rifiutato in silenzio. '
      + 'Serve la migrazione 061, oppure non hai il permesso di eliminarlo.'
    );
  }
}

/* Rimetterlo dov'era.
 *
 * Una partita ancora `live` potrebbe non poter tornare: nel frattempo quella
 * categoria puo` averne aperta un'altra, e `games_one_live_per_sector` ne
 * permette una sola. Il database lo rifiuta con una violazione di unicita`, e
 * quel messaggio da solo non direbbe niente a nessuno.
 */
export async function ripristinaTabellino(gameId) {
  const { data, error } = await supabase.from('games')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', gameId).select('id');
  if (error) throw descriviErroreCestino(error, 'ripristinato');
  if (!data || data.length === 0) {
    throw new Error('Il tabellino non è stato ripristinato: non hai il permesso.');
  }
}

function descriviErroreCestino(error, cosa) {
  const msg = (error && error.message) || '';
  if (/deleted_at|deleted_by/.test(msg) && /column/i.test(msg)) {
    return new Error('Manca la colonna deleted_at sulla tabella games: esegui la migrazione 061 su Supabase, poi riprova.');
  }
  if (/amministratore/.test(msg)) return new Error(msg);
  if (/games_one_live_per_sector|duplicate key|unique/i.test(msg)) {
    return new Error(
      'Non si può ripristinare: questa categoria ha già una partita in corso. '
      + 'Chiudi o elimina quella prima di rimettere questa.'
    );
  }
  return new Error(msg || ('Il tabellino non è stato ' + cosa + '.'));
}

/* Il cestino: le partite eliminate di questa categoria.
 *
 * Con il nome di chi le ha eliminate, che e` la meta` del punto: «eliminata»
 * senza un nome accanto e` la stessa informazione che non avevamo prima.
 */
export async function fetchDeletedGames(sectorId, seasonId) {
  let q = supabase.from('games')
    .select('*, eliminata_da:profiles!games_deleted_by_fkey(display_name)')
    .eq('sector_id', sectorId).not('deleted_at', 'is', null);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q.order('deleted_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    ...fromDbGame(r),
    eliminataAlle: r.deleted_at,
    eliminataDa: (r.eliminata_da && r.eliminata_da.display_name) || null
  }));
}

/* ============== Correggere un tabellino chiuso (migrazione 044) ==============
 *
 * Si riapre nello scout invece di aprire un secondo editor: chi corregge ha
 * gia' in mano l'interfaccia con cui ha segnato, e venti caselle numeriche su
 * un telefono sarebbero solo un posto nuovo dove sbagliare.
 *
 * Mentre e' riaperta la partita sparisce dallo storico e dalle statistiche: in
 * quel momento e' un tabellino che non e' ancora vero.
 */
export async function reopenGameForFix(gameId) {
  const { data, error } = await supabase.rpc('riapri_tabellino', { p_game: gameId });
  if (error) throw descriviErroreCorrezione(error);
  return data;
}

// La traccia: chi ha riaperto e chi ha richiuso, con il punteggio prima e dopo.
export async function fetchGameCorrections(gameId) {
  const { data, error } = await supabase.from('game_corrections')
    .select('*').eq('game_id', gameId).order('quando');
  if (error) throw error;
  return data || [];
}

function descriviErroreCorrezione(error) {
  const msg = (error && error.message) || '';
  if (/riapri_tabellino|game_corrections/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la correzione del tabellino: esegui la migrazione 044 su Supabase, poi riprova.');
  }
  return error;
}

import { supabase } from '../supabaseClient.js';
import { stagioneAttiva } from './stagione.js';

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
  if ('teamScore' in g) patch.team_score = g.teamScore;
  if ('oppScore' in g) patch.opp_score = g.oppScore;
  if ('quarterFouls' in g) patch.quarter_fouls = g.quarterFouls;
  if ('periodScores' in g) patch.period_scores = g.periodScores;
  if ('calendarMatchId' in g) patch.calendar_match_id = g.calendarMatchId;
  if ('friendly' in g) patch.friendly = !!g.friendly;
  if ('quintetti' in g) patch.quintetti = g.quintetti || {};
  if ('turno' in g) patch.turno = g.turno || null;
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
  if (/salva_tabellino|revisione|tenuto_/.test(msg)) {
    return new Error('Manca la funzione salva_tabellino: esegui la migrazione 038 su Supabase, poi riprova.');
  }
  return error;
}

export async function fetchLiveGame(sectorId) {
  const { data, error } = await supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'live').maybeSingle();
  if (error) throw error;
  return fromDbGame(data);
}

// Lo storico e' quello della stagione: senza il filtro, media punti, record e
// miglior marcatore continuerebbero a sommarsi di anno in anno.
export async function fetchHistory(sectorId, seasonId) {
  let q = supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'finished');
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
export async function saveLiveGame(gameId, liveGame) {
  const { data, error } = await supabase.rpc('salva_tabellino', {
    p_game: gameId,
    p_revisione: liveGame.revisione || 0,
    p_patch: toDbPatch(liveGame)
  });
  if (error) throw describeWriteError(error);
  if (data == null) {
    const e = new Error(
      'Questa partita e’ stata modificata da un altro dispositivo: le ultime azioni '
      + 'segnate qui non sono state salvate.'
    );
    // Il richiamante deve poterlo distinguere da «non c'e' rete»: uno si
    // riprova da solo, l'altro no — riprovare vorrebbe dire insistere a
    // sovrascrivere il lavoro di qualcun altro.
    e.conflitto = true;
    throw e;
  }
  // La revisione nuova diventa quella da cui parte il prossimo salvataggio.
  liveGame.revisione = data;
}

export async function endGame(gameId, liveGame) {
  const { error } = await supabase.from('games').update({
    ...toDbPatch(liveGame),
    status: 'finished',
    ended_at: new Date().toISOString()
  }).eq('id', gameId);
  if (error) throw describeWriteError(error);
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
    .eq('team_id', teamId).eq('status', 'live');
  if (error) throw error;
  return data;
}

/* Cancellare una partita, e ACCORGERSI se non è successo.
 *
 * Prima era una delete e basta. Con la sicurezza a livello di riga, una
 * cancellazione che il database non permette non è un errore: è una
 * cancellazione di zero righe, che torna indietro senza dire niente. L'app
 * annunciava «tabellino scartato» e il tabellino restava dov'era.
 *
 * È lo stesso modo di fallire dell'allenamento senza stagione — in silenzio,
 * sembrando riuscito — e la risposta è la stessa: farsi restituire quello che
 * si è cancellato, e non fidarsi dell'assenza di errori.
 */
export async function deleteGame(gameId) {
  const { data, error } = await supabase.from('games').delete().eq('id', gameId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) {
    throw new Error(
      'La partita non è stata cancellata: il database ha rifiutato in silenzio. '
      + 'Serve la migrazione 035 (policy games_delete), oppure non hai il permesso di cancellarla.'
    );
  }
}

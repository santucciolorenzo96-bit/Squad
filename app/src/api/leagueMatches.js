import { supabase } from '../supabaseClient.js';
import { esigiRiga } from './scrittura.js';
import { stagioneAttiva } from './stagione.js';
import { rigaNostraDiGiornata } from '../utils/campionato.js';

// Risultati del girone: tutte le partite del campionato, comprese le nostre.
// È da qui che si calcola la classifica, invece di digitarla riga per riga.

export async function fetchLeagueMatches(sectorId, seasonId) {
  let q = supabase.from('league_matches').select('*').eq('sector_id', sectorId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q
    .order('giornata', { nullsFirst: false }).order('date', { nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function saveLeagueMatch(teamId, sectorId, row, seasonId = stagioneAttiva()) {
  const patch = {
    giornata: row.giornata ?? null,
    date: row.date || null,
    phase: row.phase || 'regular',
    round_label: row.round_label || null,
    home_team: row.home_team.trim(),
    away_team: row.away_team.trim(),
    home_score: row.home_score ?? null,
    away_score: row.away_score ?? null,
    updated_at: new Date().toISOString()
  };
  if (row.id) {
    const { data, error } = await supabase.from('league_matches')
      .update(patch).eq('id', row.id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('league_matches')
    .insert({ team_id: teamId, sector_id: sectorId, season_id: seasonId || null, ...patch })
    .select().single();
  if (error) throw describeSaveError(error);
  return data;
}

/* IL GIRONE INTERO IN UN COLPO, dal calendario caricato.
 *
 * Settantadue accoppiamenti scritti a mano sono il pomeriggio che caricare un
 * calendario doveva far risparmiare. Si inseriscono SENZA punteggi: durante la
 * stagione resta da scrivere solo quelli, e la classifica si aggiorna.
 *
 * `ignoreDuplicates` non e` una comodita`, e` la cosa che rende il
 * ricaricamento sicuro: a febbraio, ricaricando il PDF perche` tre partite
 * sono state rinviate, le righe gia` presenti NON si toccano — e quindi i
 * punteggi gia` inseriti non si perdono. Il vincolo che le riconosce e`
 * `league_matches_unique`, su settore, giornata e le due squadre.
 */
export async function bulkInsertLeagueMatches(teamId, sectorId, rows, seasonId = stagioneAttiva()) {
  const righe = (rows || []).filter(r => r && r.home_team && r.away_team);
  if (righe.length === 0) return [];

  const { data, error } = await supabase.from('league_matches')
    .upsert(righe.map(r => ({
      team_id: teamId,
      sector_id: sectorId,
      season_id: seasonId || null,
      giornata: r.giornata == null ? null : r.giornata,
      date: r.date || null,
      phase: r.phase || 'regular',
      home_team: String(r.home_team).trim(),
      away_team: String(r.away_team).trim()
    })), {
      /* Le colonne devono essere ESATTAMENTE quelle dell'indice unico, e
       * dalla 063 l'indice contiene anche la stagione: senza, fra un anno la
       * prima giornata con le stesse due squadre verrebbe rifiutata come un
       * doppione. Se qui si dichiarassero quattro colonne e l'indice ne avesse
       * cinque, Postgres rifiuterebbe tutto l'inserimento — ed e` il caso che
       * `descriviErroreSaveError` spiega per nome. */
      onConflict: 'sector_id,season_id,giornata,home_team,away_team',
      ignoreDuplicates: true
    })
    .select();

  if (error) throw describeSaveError(error);
  return data || [];
}

export async function removeLeagueMatch(id) {
  const { data, error } = await supabase.from('league_matches').delete()
    .eq('id', id).select();
  if (error) throw error;
  esigiRiga(data, 'eliminare la partita di campionato');
}

/* IL NOSTRO RISULTATO IN CLASSIFICA.
 *
 * La partita segnata con lo scout non deve diventare una seconda verità: se la
 * riga di quella giornata c'è già — l'ha caricata il calendario — si scrive il
 * punteggio su quella. Così il risultato entra in classifica una volta sola, da
 * qualunque strada arrivi.
 *
 * SI RICONOSCE PER GIORNATA E NOSTRO NOME, non per la coppia dei due nomi.
 * Basta che l'avversario sia scritto in modo diverso fra calendario e girone —
 * e succede, perché caricando il calendario i nomi federali si possono
 * accorciare — e il punteggio finirebbe su una riga nuova: due righe per la
 * stessa partita, una col punteggio e una «da giocare».
 *
 * E QUANDO LA RIGA C'È, I NOMI RESTANO I SUOI. Sono quelli del documento
 * federale, cioè quelli con cui la classifica conta tutte le altre partite:
 * sovrascriverli con la nostra versione accorciata spaccherebbe la squadra in
 * due righe di classifica.
 *
 * Restituisce `null` quando non sa dove si è giocata e non c'è una riga da cui
 * dedurlo: senza quel dato una riga nuova sarebbe una supposizione, e in
 * classifica una supposizione vale come un errore.
 */
export async function upsertOurLeagueMatch(teamId, sectorId, { giornata, date, ourName, opponent, isHome, ourScore, oppScore, seasonId = stagioneAttiva(), phase, roundLabel }) {
  // Le righe di quella giornata: sono poche, e bastano per riconoscere la
  // nostra senza dipendere da come è scritto l'avversario.
  let query = supabase.from('league_matches').select('*').eq('sector_id', sectorId);
  if (seasonId) query = query.eq('season_id', seasonId);
  query = giornata == null ? query.is('giornata', null) : query.eq('giornata', giornata);
  const { data: righe, error: errLettura } = await query;
  if (errLettura) throw describeSaveError(errLettura);

  const nostra = rigaNostraDiGiornata(righe, ourName, giornata);

  if (nostra) {
    const basso = (s) => String(s || '').trim().toLowerCase();
    // L'orientamento lo dice la RIGA e non il calendario: il documento
    // federale è l'autorità su chi gioca in casa, e se in calendario quel
    // campo era rimasto «da definire» qui non serve più indovinarlo.
    const inCasa = basso(nostra.home_team) === basso(ourName);
    return saveLeagueMatch(teamId, sectorId, {
      id: nostra.id,
      giornata: nostra.giornata,
      date: nostra.date || date || null,
      phase: nostra.phase || phase || 'regular',
      round_label: nostra.round_label || roundLabel || null,
      home_team: nostra.home_team,
      away_team: nostra.away_team,
      home_score: inCasa ? ourScore : oppScore,
      away_score: inCasa ? oppScore : ourScore
    }, seasonId);
  }

  // Nessuna riga: si crea, ma solo se si sa da che parte si è giocato.
  if (isHome !== true && isHome !== false) return null;

  return saveLeagueMatch(teamId, sectorId, {
    id: null,
    giornata: giornata == null ? null : giornata,
    date: date || null,
    phase: phase || 'regular',
    round_label: roundLabel || null,
    home_team: isHome ? ourName : opponent,
    away_team: isHome ? opponent : ourName,
    home_score: isHome ? ourScore : oppScore,
    away_score: isHome ? oppScore : ourScore
  }, seasonId);
}

function describeSaveError(error) {
  const msg = (error && error.message) || '';
  if (/league_matches_unique/.test(msg)) {
    return new Error('Questo accoppiamento è già stato inserito in questa giornata: correggi quello esistente invece di aggiungerlo di nuovo.');
  }
  if (/league_matches/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la tabella league_matches: esegui la migrazione 018 su Supabase, poi riprova.');
  }
  /* L'inserimento in blocco dichiara le colonne dell'indice unico. Se l'indice
   * e` ancora quello vecchio — senza la stagione — Postgres non trova niente
   * che corrisponda e rifiuta tutto. Il suo messaggio e` corretto e non dice
   * cosa fare. */
  if (/ON CONFLICT/i.test(msg) && /unique|exclusion/i.test(msg)) {
    return new Error(
      'Il calendario del girone non si e` potuto salvare: esegui la migrazione 063 su '
      + 'Supabase, poi riprova. Serve perché l’indice che riconosce i doppioni deve '
      + 'conoscere anche la stagione: altrimenti fra un anno la prima giornata verrebbe rifiutata.'
    );
  }
  return error;
}

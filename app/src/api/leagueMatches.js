import { supabase } from '../supabaseClient.js';

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

export async function saveLeagueMatch(teamId, sectorId, row, seasonId) {
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

export async function removeLeagueMatch(id) {
  const { error } = await supabase.from('league_matches').delete().eq('id', id);
  if (error) throw error;
}

// La nostra partita seguita con lo scout non deve diventare una seconda verità:
// se in quella giornata esiste già la riga di quell'accoppiamento la si
// aggiorna, altrimenti la si crea. Così il risultato entra in classifica una
// volta sola, da qualunque strada arrivi.
export async function upsertOurLeagueMatch(teamId, sectorId, { giornata, date, ourName, opponent, isHome, ourScore, oppScore, seasonId, phase, roundLabel }) {
  const home_team = isHome ? ourName : opponent;
  const away_team = isHome ? opponent : ourName;
  const home_score = isHome ? ourScore : oppScore;
  const away_score = isHome ? oppScore : ourScore;

  let query = supabase.from('league_matches').select('id')
    .eq('sector_id', sectorId).eq('home_team', home_team).eq('away_team', away_team);
  if (seasonId) query = query.eq('season_id', seasonId);
  query = giornata == null ? query.is('giornata', null) : query.eq('giornata', giornata);
  const { data: found, error: findErr } = await query.maybeSingle();
  if (findErr) throw findErr;

  return saveLeagueMatch(teamId, sectorId, {
    id: found ? found.id : null,
    giornata: giornata ?? null, date: date || null,
    phase: phase || 'regular', round_label: roundLabel || null,
    home_team, away_team, home_score, away_score
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
  return error;
}

import { supabase } from '../supabaseClient.js';

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
  if ('players' in g) patch.players = g.players;
  return patch;
}

export async function fetchLiveGame(sectorId) {
  const { data, error } = await supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'live').maybeSingle();
  if (error) throw error;
  return fromDbGame(data);
}

export async function fetchHistory(sectorId) {
  const { data, error } = await supabase.from('games')
    .select('*').eq('sector_id', sectorId).eq('status', 'finished').order('started_at');
  if (error) throw error;
  return data.map(fromDbGame);
}

export async function startGame(teamId, sectorId, liveGame, startedByProfileId) {
  const { data, error } = await supabase.from('games').insert({
    team_id: teamId,
    sector_id: sectorId,
    status: 'live',
    ...toDbPatch(liveGame),
    started_by: startedByProfileId
  }).select().single();
  if (error) throw error;
  return fromDbGame(data);
}

export async function saveLiveGame(gameId, liveGame) {
  const { error } = await supabase.from('games').update(toDbPatch(liveGame)).eq('id', gameId);
  if (error) throw error;
}

export async function endGame(gameId, liveGame) {
  const { error } = await supabase.from('games').update({
    ...toDbPatch(liveGame),
    status: 'finished',
    ended_at: new Date().toISOString()
  }).eq('id', gameId);
  if (error) throw error;
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

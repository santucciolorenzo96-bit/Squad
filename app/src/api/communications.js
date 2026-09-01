import { supabase } from '../supabaseClient.js';

export async function fetchCommunications(sectorId) {
  const { data, error } = await supabase.from('communications')
    .select('*, communication_recipients(player_id, status, note, responded_at)')
    .eq('sector_id', sectorId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// Comunicazioni che riguardano i giocatori collegati al mio account
export async function fetchMyCommunications(playerIds) {
  if (!playerIds || playerIds.length === 0) return [];
  const { data, error } = await supabase.from('communication_recipients')
    .select('player_id, status, note, responded_at, communications(*)')
    .in('player_id', playerIds);
  if (error) throw error;
  return data
    .filter(r => r.communications)
    .sort((a, b) => (b.communications.created_at || '').localeCompare(a.communications.created_at || ''));
}

export async function createCommunication(teamId, sectorId, comm, playerIds, createdBy) {
  const { data: created, error } = await supabase.from('communications')
    .insert({ team_id: teamId, sector_id: sectorId, created_by: createdBy, ...comm })
    .select().single();
  if (error) throw error;

  if (playerIds.length > 0) {
    const { error: rErr } = await supabase.from('communication_recipients')
      .insert(playerIds.map(id => ({ communication_id: created.id, player_id: id })));
    if (rErr) {
      // senza destinatari la comunicazione non ha senso: non lasciarla a metà
      await supabase.from('communications').delete().eq('id', created.id);
      throw rErr;
    }
  }
  return created;
}

export async function closeCommunication(id) {
  const { error } = await supabase.from('communications')
    .update({ closed_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function removeCommunication(id) {
  const { error } = await supabase.from('communications').delete().eq('id', id);
  if (error) throw error;
}

// La risposta passa da una funzione: tocca i soli campi consentiti dopo aver
// verificato il collegamento con il giocatore.
export async function respondToCommunication(communicationId, playerId, status, note) {
  const { data, error } = await supabase.rpc('respond_to_communication', {
    p_communication_id: communicationId,
    p_player_id: playerId,
    p_status: status,
    p_note: note || null
  });
  if (error) throw error;
  return data;
}

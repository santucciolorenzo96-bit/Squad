import { supabase } from '../supabaseClient.js';
import { esigiRiga } from './scrittura.js';
import { stagioneAttiva } from './stagione.js';

export async function fetchStandings(sectorId, seasonId) {
  let q = supabase.from('standings').select('*').eq('sector_id', sectorId);
  if (seasonId) q = q.eq('season_id', seasonId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function upsertStanding(teamId, sectorId, row, seasonId = stagioneAttiva()) {
  if (row.is_us) {
    /* Niente `esigiRiga`: questo toglie il contrassegno «siamo noi» dalle
     * altre righe, e quasi sempre non ce l'ha nessuna. Zero righe e' il caso
     * normale, non un rifiuto. */
    await supabase.from('standings').update({ is_us: false }).eq('sector_id', sectorId).eq('is_us', true);
  }
  if (row.id) {
    const { data, error } = await supabase.from('standings')
      .update(row).eq('id', row.id).select();
    if (error) throw error;
    esigiRiga(data, 'salvare la riga di classifica');
  } else {
    const { error } = await supabase.from('standings')
      .insert({ ...row, team_id: teamId, sector_id: sectorId, season_id: seasonId || null });
    if (error) throw error;
  }
}

export async function removeStanding(id) {
  const { data, error } = await supabase.from('standings').delete().eq('id', id).select();
  if (error) throw error;
  esigiRiga(data, 'eliminare la squadra dalla classifica');
}

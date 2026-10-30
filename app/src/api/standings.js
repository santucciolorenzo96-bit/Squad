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

/* LE SQUADRE DEL GIRONE, DAL CALENDARIO CARICATO.
 *
 * Caricando il calendario si imparano i nomi di tutte le squadre: si creano le
 * righe che non ci sono, a zero. Servono a due cose, e nessuna delle due è la
 * classifica in sé — quella si calcola dai risultati.
 *
 * La prima: una squadra che non ha ancora giocato compare comunque in tabella,
 * invece di non esserci. La seconda: è la riga a cui attaccare il logo, e
 * senza una riga il logo non ha dove stare.
 *
 * Le righe esistenti NON si toccano: chi aveva già scritto la sua classifica a
 * mano non se la vede azzerare da un caricamento.
 */
export async function bulkInsertStandings(teamId, sectorId, nomi, nostroNome, seasonId = stagioneAttiva()) {
  const puliti = [...new Set((nomi || [])
    .map(n => String(n || '').trim())
    .filter(Boolean))];
  if (puliti.length === 0) return [];

  const chiave = (s) => s.trim().toLowerCase();
  const esistenti = await fetchStandings(sectorId, seasonId);
  const giaCi = new Set((esistenti || []).map(r => chiave(r.team_name)));
  const nuovi = puliti.filter(n => !giaCi.has(chiave(n)));
  if (nuovi.length === 0) return [];

  const noi = chiave(nostroNome || '');
  const { data, error } = await supabase.from('standings')
    .insert(nuovi.map(n => ({
      team_id: teamId,
      sector_id: sectorId,
      season_id: seasonId || null,
      team_name: n,
      played: 0, wins: 0, draws: 0, losses: 0, points: 0,
      is_us: noi ? chiave(n) === noi : false
    })))
    .select();
  if (error) throw error;
  return data || [];
}

/* IL LOGO DI UNA SQUADRA.
 *
 * Deposito privato e percorso nella riga, come le foto degli atleti: la
 * cartella è l'identificativo della nostra società, ed è su quella che si
 * regge il controllo degli accessi (migrazione 063).
 */
export async function uploadTeamLogo(teamId, standingId, blob, estensione = 'png') {
  const path = `${teamId}/${standingId}/logo_${Date.now()}.${estensione}`;
  const { error: upErr } = await supabase.storage.from('team-logos')
    .upload(path, blob, { contentType: blob.type || 'image/png', upsert: false });
  if (upErr) throw descriviErroreLogo(upErr);

  const { data, error } = await supabase.from('standings')
    .update({ logo_path: path }).eq('id', standingId).select();
  if (error) throw descriviErroreLogo(error);
  esigiRiga(data, 'salvare il logo della squadra');
  return data[0];
}

export async function removeTeamLogo(standingId) {
  const { data, error } = await supabase.from('standings')
    .update({ logo_path: null }).eq('id', standingId).select();
  if (error) throw error;
  esigiRiga(data, 'togliere il logo della squadra');
  return data[0];
}

/* Gli URL firmati, una richiesta per tutti.
 *
 * La mappa è per NOME e non per identificativo: chi disegna la classifica ha
 * in mano le righe calcolate dai risultati, che hanno il nome e non l'id della
 * riga di classifica.
 */
export async function fetchTeamLogoUrls(righe, secondi = 6 * 60 * 60) {
  const conLogo = (righe || []).filter(r => r && r.logo_path);
  if (conLogo.length === 0) return {};
  const { data, error } = await supabase.storage.from('team-logos')
    .createSignedUrls(conLogo.map(r => r.logo_path), secondi);
  if (error) throw error;
  const mappa = {};
  conLogo.forEach((r, i) => {
    if (data[i] && data[i].signedUrl) {
      mappa[String(r.team_name || '').trim().toLowerCase()] = data[i].signedUrl;
    }
  });
  return mappa;
}

/* «new row violates row-level security policy» è corretto e non serve a
 * niente: le due cause portano in due posti diversi — una si risolve
 * eseguendo una migrazione, l'altra chiedendo un permesso — quindi vanno
 * distinte invece di finire in un «non è stato possibile». */
function descriviErroreLogo(error) {
  const msg = (error && error.message) || '';
  if (/Bucket not found/i.test(msg)) {
    return new Error('Manca il deposito dei loghi: esegui la migrazione 063 su Supabase, poi riprova.');
  }
  if (/logo_path/.test(msg) && /column|schema cache/i.test(msg)) {
    return new Error('Manca la colonna logo_path sulla tabella standings: esegui la migrazione 063 su Supabase, poi riprova.');
  }
  if (/row-level security/i.test(msg)) {
    return new Error('Non hai il permesso di cambiare i loghi di questa categoria: serve essere amministratore, allenatore o staff del settore.');
  }
  return error;
}

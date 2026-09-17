import { supabase } from '../supabaseClient.js';

// La stagione sportiva: da luglio a giugno, playoff compresi. È il perimetro
// entro cui hanno senso statistiche, classifica, presenze e rose — senza,
// i numeri di anni diversi si sommano fra loro.

export async function fetchSeasons(teamId) {
  const { data, error } = await supabase.from('seasons')
    .select('*').eq('team_id', teamId).order('start_date', { ascending: false });
  if (error) throw describeSeasonError(error);
  return data;
}

export async function createSeason(teamId, { name, start_date, end_date }) {
  const { data, error } = await supabase.from('seasons')
    .insert({ team_id: teamId, name, start_date, end_date }).select().single();
  if (error) throw error;
  return data;
}

// Scadenze e nome si correggono anche a stagione avviata: l'iscrizione ai
// campionati e il tesseramento arrivano spesso dopo che la stagione è aperta.
export async function updateSeason(id, patch) {
  const { data, error } = await supabase.from('seasons')
    .update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// Riaprire non ha bisogno di una funzione dedicata: la policy seasons_write_admin
// permette gia' a un amministratore di aggiornare qualunque colonna. Non tocca
// la stagione nuova ne' le rose che ci sono state create: rimette solo questa
// in condizione di essere modificata.
export async function reopenSeason(id) {
  return updateSeason(id, { closed: false, closed_at: null, closed_by: null });
}

/* Cosa c'e' dentro una stagione.
 *
 * Serve prima di eliminarla, e non per cortesia: eliminare una stagione
 * CANCELLA le rose di quell'anno — player_sectors ha `on delete cascade` —
 * e lascia tutto il resto con la stagione vuota, che in quest'app vuol dire
 * invisibile per sempre, perche' ogni lettura filtra per stagione.
 *
 * Si contano le righe senza portarle indietro (`head: true`): interessa solo
 * se ce n'e' qualcuna.
 */
export async function contaDatiStagione(id) {
  const conta = async (tabella) => {
    const { count, error } = await supabase.from(tabella)
      .select('id', { count: 'exact', head: true }).eq('season_id', id);
    if (error) throw error;
    return count || 0;
  };
  // player_sectors non ha una colonna `id`: si conta su una che ha.
  const rose = async () => {
    const { count, error } = await supabase.from('player_sectors')
      .select('player_id', { count: 'exact', head: true }).eq('season_id', id);
    if (error) throw error;
    return count || 0;
  };

  const [atleti, partite, allenamenti, calendario, classifica] = await Promise.all([
    rose(), conta('games'), conta('trainings'), conta('calendar'), conta('standings')
  ]);
  return {
    atleti, partite, allenamenti, calendario, classifica,
    totale: atleti + partite + allenamenti + calendario + classifica
  };
}

/* Eliminare una stagione e' per le stagioni sbagliate: quella creata con la
 * data storta, quella doppia. Una stagione VISSUTA non si elimina, si chiude —
 * ed e' il motivo per cui qui si guarda prima cosa c'e' dentro invece di
 * fidarsi di chi preme.
 *
 * Il controllo sta nell'API e non nella finestra di conferma apposta: cosi'
 * vale anche per la vecchia interfaccia, e per qualunque schermata venga dopo.
 */
export async function removeSeason(id) {
  const dentro = await contaDatiStagione(id);
  if (dentro.totale > 0) {
    throw new Error(descriviStagionePiena(dentro));
  }
  const { error } = await supabase.from('seasons').delete().eq('id', id);
  if (error) throw error;
}

export function descriviStagionePiena(d) {
  const pezzi = [];
  if (d.atleti) pezzi.push(d.atleti + (d.atleti === 1 ? ' atleta in rosa' : ' atleti in rosa'));
  if (d.partite) pezzi.push(d.partite + (d.partite === 1 ? ' partita' : ' partite'));
  if (d.allenamenti) pezzi.push(d.allenamenti + (d.allenamenti === 1 ? ' allenamento' : ' allenamenti'));
  if (d.calendario) pezzi.push(d.calendario + (d.calendario === 1 ? ' riga di calendario' : ' righe di calendario'));
  if (d.classifica) pezzi.push(d.classifica + (d.classifica === 1 ? ' riga di classifica' : ' righe di classifica'));
  const elenco = pezzi.length > 1
    ? pezzi.slice(0, -1).join(', ') + ' e ' + pezzi[pezzi.length - 1]
    : pezzi[0];
  return 'Questa stagione contiene ' + elenco + ': non si elimina. '
    + 'Eliminarla cancellerebbe le rose e renderebbe invisibile tutto il resto. '
    + 'Per passare all’anno nuovo si usa «Chiudi la stagione», che archivia e porta avanti chi decidi tu.';
}

// Chiusura: archivia la stagione, ne apre una nuova e ci porta dentro le
// persone secondo le assegnazioni decise a mano. Chi non è nell'elenco resta
// in anagrafica e nello storico, semplicemente non nella nuova rosa.
export async function closeSeasonAndOpen(closingId, { name, start_date, end_date }, assignments) {
  const { data, error } = await supabase.rpc('close_season_and_open', {
    p_closing_season_id: closingId,
    p_new_name: name,
    p_new_start: start_date,
    p_new_end: end_date,
    p_assignments: assignments || []
  });
  if (error) throw error;
  return data;
}

function describeSeasonError(error) {
  const msg = (error && error.message) || '';
  if (/seasons/.test(msg) && /does not exist|schema cache/.test(msg)) {
    return new Error('Manca la tabella seasons: esegui la migrazione 021 su Supabase, poi riprova.');
  }
  return error;
}

// Giorni che mancano a una data, negativi se è passata.
export function daysTo(dateStr) {
  if (!dateStr) return null;
  const target = new Date(dateStr + 'T00:00:00');
  if (isNaN(target)) return null;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return Math.round((target - now) / 86400000);
}

// La stagione su cui lavorare: quella aperta più recente, altrimenti la più
// recente in assoluto — una società che ha chiuso tutto deve comunque vedere
// qualcosa invece di una schermata vuota.
export function pickActiveSeason(seasons) {
  if (!seasons || seasons.length === 0) return null;
  return seasons.find(s => !s.closed) || seasons[0];
}

// La stagione che si sta consultando puo' essere diversa da quella in corso:
// un amministratore che guarda l'anno scorso deve ritrovarla dopo un
// ricaricamento, come gia' succede per il settore.
const SEASON_KEY = 'bbapp_active_season';

export function rememberSeason(id, seasons) {
  const current = pickActiveSeason(seasons);
  // Tornare sulla stagione in corso significa smettere di consultare il
  // passato: la preferenza si cancella invece di fissarsi su quella corrente.
  if (!id || (current && id === current.id)) localStorage.removeItem(SEASON_KEY);
  else localStorage.setItem(SEASON_KEY, id);
}

export function storedSeasonId(seasons) {
  const saved = localStorage.getItem(SEASON_KEY);
  if (saved && seasons.some(s => s.id === saved)) return saved;
  const current = pickActiveSeason(seasons);
  return current ? current.id : null;
}

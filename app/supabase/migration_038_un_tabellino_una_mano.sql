-- ============================================================================
-- SQUAD — migrazione 038
-- Un tabellino, una mano sola: chi lo tiene, e a che punto è
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor di Supabase, dopo la 037.
-- È idempotente: rieseguirla non fa danni.
--
-- IL PROBLEMA
--
-- Il salvataggio del tabellino dal vivo è un UPDATE cieco dell'intera riga:
-- prende tutto quello che ha in mano il dispositivo e lo scrive sopra a quello
-- che c'è. Non c'è nessuna versione, nessuna data di modifica, nessun modo di
-- accorgersi che nel frattempo qualcun altro ha scritto.
--
-- Basta la curiosità per perdere una partita. L'allenatore tiene lo scout sul
-- tablet; il dirigente apre Scout dal telefono per guardare il punteggio. Il
-- telefono carica la partita com'è in quel momento e, al primo tocco — o
-- anche solo all'apertura, perché il registro dei quintetti si scrive da sé —
-- riscrive l'intera riga con la sua copia. Tutto quello che il tablet ha
-- segnato da quando il telefono ha caricato sparisce. Senza un errore, senza
-- un avviso, senza un modo di accorgersene se non contando i punti.
--
-- DUE COLONNE PER DUE COSE DIVERSE
--
-- `revisione` è la correttezza. Ogni salvataggio dice da quale versione parte,
-- e il database lo accetta solo se è ancora quella: se non lo è, il
-- salvataggio non avviene e l'applicazione lo sa. È il meccanismo che rende
-- IMPOSSIBILE sovrascrivere senza accorgersene — non che lo rende raro.
--
-- `tenuto_da` e `tenuto_alle` sono l'usabilità. Dicono chi ha scritto per
-- ultimo e quando, così il secondo dispositivo può accorgersi PRIMA di aver
-- toccato qualcosa che il tabellino è in mano a qualcun altro, e chiedere
-- invece di sovrascrivere.
--
-- Servono tutte e due, e non sono la stessa cosa: la prima impedisce il danno,
-- la seconda impedisce la situazione.

alter table games add column if not exists revisione int not null default 0;
alter table games add column if not exists tenuto_da uuid references profiles(id);
alter table games add column if not exists tenuto_alle timestamptz;

-- ============================================================================
-- Il salvataggio guardato
-- ============================================================================
-- Sta in una funzione e non in una update dal client per una ragione sola:
-- deve essere ATOMICO. Leggere la revisione, confrontarla e scrivere in tre
-- richieste separate lascia in mezzo lo spazio perché l'altro dispositivo
-- scriva — che è esattamente il difetto che stiamo chiudendo.
--
-- Restituisce la nuova revisione se ha scritto, e NULL se non era più la sua:
-- null non è un errore tecnico, è la risposta «un altro è arrivato prima».

create or replace function salva_tabellino(
  p_game uuid,
  p_revisione int,
  p_patch jsonb
) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_nuova int;
begin
  update games g set
    opp_name          = coalesce((p_patch->>'opp_name'), g.opp_name),
    quarter           = coalesce((p_patch->>'quarter')::int, g.quarter),
    clock             = coalesce((p_patch->>'clock')::int, g.clock),
    clock_running     = coalesce((p_patch->>'clock_running')::boolean, g.clock_running),
    team_score        = coalesce((p_patch->>'team_score')::int, g.team_score),
    opp_score         = coalesce((p_patch->>'opp_score')::int, g.opp_score),
    quarter_fouls     = coalesce(p_patch->'quarter_fouls', g.quarter_fouls),
    period_scores     = coalesce(p_patch->'period_scores', g.period_scores),
    players           = coalesce(p_patch->'players', g.players),
    quintetti         = coalesce(p_patch->'quintetti', g.quintetti),
    turno             = case when p_patch ? 'turno' then p_patch->'turno' else g.turno end,
    friendly          = coalesce((p_patch->>'friendly')::boolean, g.friendly),
    calendar_match_id = case when p_patch ? 'calendar_match_id'
                             then nullif(p_patch->>'calendar_match_id', '')::uuid
                             else g.calendar_match_id end,
    revisione         = g.revisione + 1,
    tenuto_da         = auth.uid(),
    tenuto_alle       = now()
  where g.id = p_game
    -- Il cuore di tutto. Se la revisione non è più quella da cui il
    -- dispositivo è partito, non si scrive niente: zero righe toccate.
    and g.revisione = p_revisione
    and g.status = 'live'
  returning g.revisione into v_nuova;

  return v_nuova;   -- null = un altro dispositivo è arrivato prima
end;
$$;

-- `security invoker`: la funzione scrive con i permessi di chi la chiama,
-- quindi le policy di games valgono esattamente come prima. Non è una
-- scorciatoia per scrivere dove non si potrebbe, è solo un modo di fare in un
-- colpo solo quello che il client faceva in tre.

-- ============================================================================
-- SQUAD — migrazione 057
-- Il salvataggio dal vivo non scriveva il registro né i set chiusi
-- ============================================================================
--
-- Nel referto della partita di pallavolo i primi due set erano vuoti, il terzo
-- aveva due attacchi e il quarto ne aveva trentanove — su centocinquanta
-- giocati. Il massimo vantaggio diceva +0 in una partita vinta.
--
-- Non erano tre difetti: era uno.
--
-- COSA SUCCEDEVA
--
-- Durante una partita ogni salvataggio passa da `salva_tabellino`, ed è giusto:
-- è la funzione che confronta la revisione e impedisce a due dispositivi di
-- scriversi sopra. Ma ha una LISTA FISSA di colonne, scritta quando esisteva.
-- `storia` è arrivata con la 054 e `chiusi` con la 055, e nessuna delle due è
-- mai entrata in quella lista.
--
-- Quindi il registro delle azioni cresceva in memoria e non veniva mai
-- scritto. Alla fine della partita `endGame` — che è un update normale — lo
-- salvava per intero, ma solo quello che era ancora in memoria in quel
-- momento: tutto ciò che stava prima dell'ultima ricarica della pagina era già
-- perso. Ecco perché i set più vecchi erano vuoti e l'ultimo pieno.
--
-- PERCHÉ NON SI ERA VISTO
--
-- Perché il tabellino era giusto. I numeri dei giocatori stanno in `players`,
-- che nella lista c'era: punti, attacchi, ricezioni, tutto a posto. A mancare
-- erano solo le sezioni che rileggono l'ORDINE delle cose — e quelle sono
-- nate tre giorni fa.
--
-- Una lista di colonne scritta a mano è una cosa che si dimentica di
-- aggiornare. Qui sotto non si può fare di meglio — un update dinamico su una
-- tabella con RLS aprirebbe la porta a scrivere colonne che non c'entrano —
-- ma almeno il commento lo dice a chi passerà di qui.

create or replace function salva_tabellino(
  p_game uuid,
  p_revisione int,
  p_patch jsonb
) returns int
language plpgsql security invoker set search_path = public as $$
declare
  v_nuova int;
begin
  -- ATTENZIONE: ogni colonna nuova su `games` che lo scout deve poter salvare
  -- durante la partita va aggiunta QUI. Se non la si aggiunge non si rompe
  -- niente e non lo dice nessuno: il dato resta in memoria, viene scritto solo
  -- alla fine, e sparisce alla prima ricarica della pagina.
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
    -- Il registro delle azioni (054) e i periodi chiusi (055).
    storia            = coalesce(p_patch->'storia', g.storia),
    chiusi            = coalesce((p_patch->>'chiusi')::int, g.chiusi),
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


-- ============================================================================
-- LE PARTITE GIÀ GIOCATE
-- ============================================================================
-- Non si recuperano: quelle azioni non sono mai arrivate al database, e da qui
-- non c'è niente da cui ricostruirle. Il tabellino di quelle partite resta
-- giusto — i numeri dei giocatori si sono salvati sempre — e restano vuote
-- solo le sezioni che rileggono l'ordine.
--
-- Questa dice quante azioni ha ciascuna partita archiviata: se una ne ha
-- poche rispetto ai punti segnati, è una di quelle.

select
  g.started_at::date as quando,
  g.opp_name         as avversario,
  g.team_score || '-' || g.opp_score as risultato,
  jsonb_array_length(coalesce(g.storia, '[]'::jsonb)) as azioni_nel_registro,
  g.chiusi           as periodi_chiusi
from games g
where g.status = 'finished'
order by g.started_at desc
limit 20;

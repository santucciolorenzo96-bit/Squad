-- ============================================================================
-- SQUAD — migrazione 061
-- Un tabellino eliminato si puo' rimettere
-- ============================================================================
--
-- Il 21 e il 26 ottobre 2026 due partite sono scomparse. In calendario il
-- risultato c'era, in `games` non c'era nessuna riga, sul tablet nessuna
-- copia. La causa vera era un'altra — `endGame` non si accorgeva di non aver
-- scritto niente, ed e' sistemata nel codice — ma per capirlo ci sono volute
-- due ipotesi e mezza giornata, e il motivo e' uno solo:
--
--   UNA RIGA CANCELLATA NON LASCIA NIENTE DIETRO DI SE'.
--
-- Non si sa se qualcuno l'abbia eliminata, chi, quando, ne' cosa conteneva.
-- La domanda «dov'e' finita la partita?» non aveva una risposta certa, ne'
-- allora ne' adesso: aveva due ipotesi, e la differenza fra le due cambiava
-- completamente cosa andava sistemato.
--
-- Con la 060 abbiamo ristretto CHI puo' eliminare un tabellino. Qui si cambia
-- COSA VUOL DIRE eliminarlo: non si cancella la riga, si segna il momento e
-- la persona. La partita esce da storico, statistiche e classifica — che e'
-- tutto quello che serviva — e resta recuperabile.
--
-- Il DELETE vero resta, e resta solo all'amministratore (policy `games_delete`
-- della 060): serve per togliere davvero una riga, ed e' una cosa che si fa
-- da qui, non da un pulsante a bordo campo.

-- ----------------------------------------------------------------- PASSO 1
-- Le due colonne. `deleted_by` punta a profiles: serve il nome, non l'id.

alter table games add column if not exists deleted_at timestamptz;
alter table games add column if not exists deleted_by uuid references profiles(id);


-- ----------------------------------------------------------------- PASSO 2
-- L'INDICE DELLA PARTITA APERTA, che e' la trappola di tutta la migrazione.
--
-- `games_one_live_per_sector` impedisce due partite in corso nella stessa
-- categoria. Finche' ignora `deleted_at`, un tabellino eliminato ma ancora
-- `live` continua a occupare quel posto: la categoria non potrebbe piu'
-- aprire una partita, e il messaggio parlerebbe di una partita che per
-- l'interfaccia non esiste piu'. Il modo peggiore di bloccare qualcuno.

drop index if exists games_one_live_per_sector;

create unique index if not exists games_one_live_per_sector
  on games(sector_id) where (status = 'live' and deleted_at is null);


-- ----------------------------------------------------------------- PASSO 3
-- CHI PUO' CAMBIARE LO STATO DI ELIMINATO.
--
-- `games_update` permette di scrivere su `games` a chiunque abbia accesso al
-- settore, segnapunti compresi: e' giusto, e' il tabellino. Ma da oggi fra le
-- colonne di quella tabella ce ne sono due che decidono se la partita esiste,
-- e lasciarle dentro quel permesso restituirebbe al segnapunti esattamente
-- quello che la 060 gli ha tolto — per un'altra strada, e senza che si veda.
--
-- La policy non sa distinguere una colonna dall'altra. Un trigger si': la
-- regola sta qui, vale per qualunque strada passi la scrittura — l'app, un
-- client REST, la console — e dice una cosa sola.

create or replace function games_solo_admin_elimina()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  /* Le due condizioni sono ANNIDATE e non unite da un `and`: questo trigger
     scatta a OGNI update di `games`, cioe' a ogni azione segnata durante una
     partita, e PL/pgSQL non garantisce di fermarsi a meta' di un `and`.
     Annidate, `is_admin()` — che legge il profilo — non viene chiamato quando
     lo stato di eliminato non cambia, cioe' sempre tranne due volte. */
  if new.deleted_at is distinct from old.deleted_at
     or new.deleted_by is distinct from old.deleted_by then
    if not is_admin() then
      raise exception 'Solo un amministratore puo'' eliminare o ripristinare un tabellino';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists games_elimina_solo_admin on games;

create trigger games_elimina_solo_admin
  before update on games
  for each row execute function games_solo_admin_elimina();


-- ----------------------------------------------------------------- PASSO 4
-- `salva_tabellino` con una quarta condizione.
--
-- La funzione e' quella della 057, ricopiata per intero perche' `create or
-- replace` non sa aggiungere una riga: l'unica differenza e' il
-- `deleted_at is null` nella clausola finale, segnalato dal commento.

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
    -- La quarta parte, dalla 061: su un tabellino eliminato non si scrive.
    -- Senza, un tabellino messo nel cestino mentre qualcuno lo stava segnando
    -- avrebbe continuato ad accettare azioni, restando invisibile a tutti.
    and g.deleted_at is null
  returning g.revisione into v_nuova;

  return v_nuova;   -- null = un altro dispositivo è arrivato prima
end;
$$;

-- ----------------------------------------------------------------- CONTROLLO
-- Le colonne, l'indice che ignora gli eliminati, il trigger. Tre righe a
-- `true` e la migrazione e' passata.

select
  exists (select 1 from information_schema.columns
          where table_name = 'games' and column_name = 'deleted_at')      as c_e_la_colonna,
  exists (select 1 from pg_indexes
          where indexname = 'games_one_live_per_sector'
            and indexdef like '%deleted_at IS NULL%')                     as indice_aggiornato,
  exists (select 1 from pg_trigger
          where tgname = 'games_elimina_solo_admin')                      as c_e_il_trigger;

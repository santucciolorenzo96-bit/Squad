-- ============================================================================
-- SQUAD — migrazione 062
-- Il cronometro, e i minuti giocati che ne discendono
-- ============================================================================
--
-- Il cronometro era stato tolto, e la ragione era buona: nel basket il tempo
-- si ferma di continuo, ed e' l'unica statistica che si corrompe da sola —
-- scorre anche quando nessuno la guarda. Una pausa dimenticata durante due
-- tiri liberi regala novanta secondi fantasma a cinque giocatori insieme, in
-- silenzio.
--
-- Torna perche' serve la cosa che ci sta attaccata: quanto ha giocato ognuno.
-- E torna con due accorgimenti che rendono l'errore visibile invece che
-- invisibile — il cronometro si corregge toccandolo, e i minuti si misurano
-- SUL CRONOMETRO e non sull'orologio da parete, quindi col cronometro fermo
-- non passa tempo per nessuno. Il resto sta in utils/cronometro.js.
--
-- QUI SERVE UNA COSA SOLA, e non e' il cronometro: e' l'ISTANTE DI PARTENZA.
--
-- Scrivere la riga ogni secondo e' fuori discussione: un salvataggio al
-- secondo, un conflitto di revisione ogni volta che due dispositivi guardano,
-- e la batteria del tablet. Quindi si scrivono tre cose quando CAMBIANO —
-- quanto manca, se sta andando, da quando — e «quanto manca adesso» diventa un
-- conto invece di un dato. Senza `clock_from` quel conto non si puo' fare: una
-- pagina ricaricata a metà periodo ritroverebbe il tempo di quando il
-- cronometro e' stato avviato, non quello di adesso.

-- ----------------------------------------------------------------- PASSO 1
-- L'istante da cui il cronometro sta scorrendo. NULL quando e' fermo, e quel
-- null e' un'informazione: vuol dire «il numero scritto in `clock` e' quello
-- giusto, non sottrarre niente».

alter table games add column if not exists clock_from timestamptz;


-- ----------------------------------------------------------------- PASSO 2
-- `salva_tabellino` con le colonne del cronometro.
--
-- E' la trappola che la 057 segnala a chi passa da qui: una colonna che lo
-- scout deve poter salvare DURANTE la partita e che non sta in questa
-- funzione non si rompe e non lo dice nessuno — il dato resta in memoria,
-- viene scritto solo alla fine, e sparisce alla prima ricarica della pagina.
-- Per il cronometro vorrebbe dire un tempo che torna indietro ogni volta che
-- si ricarica, e minuti giocati sbagliati per tutti.
--
-- La funzione e' quella della 061, ricopiata per intero: l'unica differenza
-- sono le tre righe segnalate dai commenti.

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
    -- Il cronometro (062). `clock_from` va con `case ... ? ...` e non con
    -- `coalesce`, perche' fermare il cronometro lo mette a NULL: con
    -- `coalesce` quel null verrebbe letto come «non toccare» e la partenza
    -- vecchia resterebbe scritta — il cronometro continuerebbe a scorrere per
    -- chiunque ricaricasse la pagina.
    clock_from        = case when p_patch ? 'clock_from'
                             then nullif(p_patch->>'clock_from', '')::timestamptz
                             else g.clock_from end,
    -- La durata del periodo si cambia in partita, quindi si salva in partita.
    quarter_length    = coalesce((p_patch->>'quarter_length')::int, g.quarter_length),
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
-- La colonna, e la funzione che la sa salvare. Due `true`.

select
  exists (select 1 from information_schema.columns
          where table_name = 'games' and column_name = 'clock_from')   as c_e_la_colonna,
  exists (select 1 from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public' and p.proname = 'salva_tabellino'
            and pg_get_functiondef(p.oid) like '%clock_from%')         as la_funzione_la_salva;

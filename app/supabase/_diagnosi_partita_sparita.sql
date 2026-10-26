-- ============================================================================
-- DOVE E' FINITA UNA PARTITA SCOUTATA
-- ============================================================================
--
-- Una partita chiusa compare nello Storico solo se tutte e tre le cose
-- combaciano con quello che il dispositivo sta guardando:
--
--   status = 'finished'   -- se e' ancora 'live' non e' nello storico: si
--                            riapre da Scout, e NON e' persa
--   sector_id             -- lo storico e' della CATEGORIA attiva
--   season_id             -- ed e' della STAGIONE attiva, che ogni
--                            dispositivo ricorda per conto suo
--                            (localStorage: bbapp_active_season)
--
-- Una partita c'e' ma non si vede quando una delle tre e' diversa. Queste
-- query non filtrano per nessuna delle tre: se la riga esiste, la trovano.

-- ------------------------------------------------------------------ PASSO 1
-- C'e' arrivata, sul server? Questa risponde SEMPRE, anche con uno zero.

select
  count(*) filter (where opp_name ilike '%basket point%')        as col_nome_basket_point,
  count(*) filter (where started_at > now() - interval '2 days') as iniziate_nelle_ultime_48h,
  count(*) filter (where status = 'live')                        as rimaste_aperte,
  count(*)                                                       as partite_in_tutto
from games;


-- ------------------------------------------------------------------ PASSO 2
-- Dove sta, e perche' non si vede.

select
  g.opp_name                                         as avversario,
  s.name                                             as categoria,
  g.status,
  g.friendly                                         as amichevole,
  st.name                                            as stagione,
  g.started_at                                       as iniziata,
  g.ended_at                                         as chiusa,
  g.team_score || ' - ' || g.opp_score               as punteggio,
  g.quarter                                          as periodo,
  jsonb_array_length(g.storia)                       as azioni_registrate,
  g.revisione,
  g.tenuto_alle                                      as ultimo_salvataggio,
  -- Il motivo piu' probabile di una partita «sparita»: sta in una stagione
  -- diversa da quella in corso, e lo storico filtra per stagione.
  (g.season_id is distinct from (
     select id from seasons
     where team_id = g.team_id and not closed
     order by start_date desc limit 1
   ))                                                as stagione_diversa_da_quella_in_corso
from games g
left join sectors s  on s.id = g.sector_id
left join seasons st on st.id = g.season_id
where g.opp_name ilike '%basket point%'
   or g.started_at > now() - interval '2 days'
order by g.started_at desc;


-- ------------------------------------------------------------------ PASSO 3
-- Qual e' «la stagione in corso»: quella aperta piu' recente. Se la partita
-- del PASSO 2 ne ha un'altra, basta cambiare stagione dal menu per vederla.

select name, start_date, end_date, closed,
       id = (select id from seasons s2 where s2.team_id = seasons.team_id
             and not s2.closed order by s2.start_date desc limit 1) as e_quella_in_corso
from seasons
order by start_date desc;

-- ============================================================================
-- SQUAD — riparazione: i giocatori rimasti fuori da ogni rosa
-- ============================================================================
--
-- La migrazione 039 ha risolto il sintomo: un giocatore senza categoria adesso
-- si lascia modificare da chi gestisce, invece di rispondere «new row violates
-- row-level security policy» a chi prova a caricargli una foto.
--
-- Ma un giocatore senza categoria non e' una condizione normale, e' un
-- giocatore PERSO: Rosa e Anagrafica leggono la rosa per categoria e stagione,
-- quindi non compare piu' da nessuna parte. Resta visibile solo nella
-- Situazione, che guarda tutta la societa'.
--
-- COME CI SONO FINITI
--
-- Eliminare una stagione cancella le rose di quell'anno: player_sectors ha
-- `on delete cascade` sulla stagione. Chi era in rosa SOLO in quella stagione
-- resta senza nessuna riga. Non e' un guasto del codice — e' esattamente
-- quello che l'eliminazione fa, ed e' scritto nell'avviso — ma il risultato e'
-- una persona che non sta piu' in nessun elenco.
--
-- Niente di distruttivo qui sotto: il PASSO A guarda, il PASSO B propone, e
-- solo il PASSO C scrive.

-- ============================================================================
-- PASSO A — CHI SONO, E DI CHI
-- ============================================================================
-- Attenzione alla colonna `societa`: dal SQL Editor non c'e' nessun filtro di
-- accesso, quindi qui dentro compaiono anche le squadre di prova e quelle
-- dimostrative. Guarda solo le righe della tua.
--
-- `ultima_partita` e' la traccia che ci dice dove giocavano: se il loro id
-- compare nel tabellino di una partita, quella partita sa a quale categoria
-- apparteneva.

select
  t.name                          as societa,
  p.number,
  p.name,
  p.created_at,
  -- l'ultima categoria in cui sono scesi in campo, se sono scesi in campo
  (select s.name from games g
     join sectors s on s.id = g.sector_id
    where g.team_id = p.team_id and g.players::text like '%' || p.id || '%'
    order by coalesce(g.ended_at, g.started_at) desc limit 1) as ultima_categoria,
  -- e se qualcuno li sta ancora guardando da un account famiglia
  (select count(*) from profile_players pp where pp.player_id = p.id) as account_collegati
from players p
join teams t on t.id = p.team_id
where not exists (select 1 from player_sectors ps where ps.player_id = p.id)
order by t.name, p.created_at desc;


-- ============================================================================
-- PASSO A2 — DOVE POTREBBERO TORNARE
-- ============================================================================
-- Le categorie e le stagioni che esistono davvero. La stagione in corso e'
-- quella non chiusa piu' recente: e' quella in cui il ripristino li rimette.

select t.name as societa, s.name as categoria, s.id as categoria_id
  from sectors s join teams t on t.id = s.team_id
 order by t.name, s.sort_order, s.name;

select t.name as societa, se.name as stagione, se.closed as chiusa,
       se.start_date, se.end_date, se.id as stagione_id
  from seasons se join teams t on t.id = se.team_id
 order by t.name, se.closed, se.start_date desc;


-- ============================================================================
-- PASSO B — LA PROPOSTA (non scrive niente)
-- ============================================================================
-- Rimette ciascuno nella categoria dell'ultima partita che ha giocato, dentro
-- la stagione in corso della sua societa'. Chi non ha mai giocato non compare
-- qui: per quelli serve una decisione, non una deduzione — vedi il PASSO D.
--
-- Leggila come si legge un preventivo: se le righe dicono quello che ti
-- aspetti, il PASSO C fa esattamente questo e nient'altro.

with orfani as (
  select p.id, p.team_id, p.number, p.name
    from players p
   where not exists (select 1 from player_sectors ps where ps.player_id = p.id)
),
stagione_corrente as (
  select distinct on (team_id) team_id, id, name
    from seasons where not closed
   order by team_id, start_date desc
),
proposta as (
  select o.id as player_id, o.number, o.name, o.team_id,
         (select g.sector_id from games g
           where g.team_id = o.team_id and g.players::text like '%' || o.id || '%'
           order by coalesce(g.ended_at, g.started_at) desc limit 1) as sector_id
    from orfani o
)
select t.name as societa, pr.number, pr.name,
       s.name as categoria, sc.name as stagione
  from proposta pr
  join teams t on t.id = pr.team_id
  join sectors s on s.id = pr.sector_id
  join stagione_corrente sc on sc.team_id = pr.team_id
 order by t.name, s.name, pr.number;


-- ============================================================================
-- PASSO C — IL RIPRISTINO
-- ============================================================================
-- Da lanciare SOLO se il PASSO B diceva quello che ti aspettavi. Scrive le
-- stesse righe che hai appena letto, una per giocatore. Se lo rilanci due
-- volte non succede niente: `on conflict do nothing`.

with orfani as (
  select p.id, p.team_id
    from players p
   where not exists (select 1 from player_sectors ps where ps.player_id = p.id)
),
stagione_corrente as (
  select distinct on (team_id) team_id, id
    from seasons where not closed
   order by team_id, start_date desc
)
insert into player_sectors (player_id, sector_id, season_id)
select o.id,
       (select g.sector_id from games g
         where g.team_id = o.team_id and g.players::text like '%' || o.id || '%'
         order by coalesce(g.ended_at, g.started_at) desc limit 1),
       sc.id
  from orfani o
  join stagione_corrente sc on sc.team_id = o.team_id
 where exists (
   select 1 from games g
    where g.team_id = o.team_id and g.sector_id is not null
      and g.players::text like '%' || o.id || '%'
 )
on conflict do nothing;


-- ============================================================================
-- PASSO D — CHI E' RIMASTO FUORI
-- ============================================================================
-- Dopo il PASSO C restano solo quelli che non hanno mai giocato una partita:
-- di loro il database non sa in che categoria stavano, e indovinare sarebbe
-- peggio che chiedere.
--
-- Per questi: prendi l'id della categoria dal PASSO A2, l'id della stagione in
-- corso, e scrivi la riga a mano. Una riga per giocatore.
--
--     insert into player_sectors (player_id, sector_id, season_id)
--     values ('<id del giocatore>', '<id della categoria>', '<id della stagione>')
--     on conflict do nothing;

select t.name as societa, p.id as player_id, p.number, p.name, p.created_at
  from players p join teams t on t.id = p.team_id
 where not exists (select 1 from player_sectors ps where ps.player_id = p.id)
 order by t.name, p.created_at desc;

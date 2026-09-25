-- ============================================================================
-- SQUAD — i sette della Cestistica Etnea: rimetterli dentro o toglierli?
-- ============================================================================
--
-- Il PASSO A ha risposto: tutti e sette della Cestistica Etnea, nessuno ha mai
-- giocato una partita, nessun account famiglia collegato. Il ripristino
-- automatico (PASSO B e C del file precedente) non ha niente su cui lavorare:
-- senza una partita, il database non sa in che categoria stessero.
--
-- MA PRIMA C'E' UNA DOMANDA CHE VIENE PRIMA DI «DOVE LI RIMETTO»
--
-- Cinque di loro sono stati creati il 23 agosto fra le 20:25 e le 20:30: e' una
-- sessione sola, qualcuno che inseriva la rosa. Nessuno di quei cinque ha mai
-- giocato. Due possibilita', e portano a due gesti opposti:
--
--   a) sono la rosa VERA, rimasta fuori — va rimessa dentro;
--   b) sono un primo inserimento ANDATO STORTO, e la rosa buona e' stata
--      rifatta dopo — allora dentro ci sono gia', e queste sette righe sono
--      doppioni da togliere.
--
-- Rimetterli dentro nel caso (b) vuol dire ritrovarsi ogni persona due volte
-- in rosa, in Anagrafica, negli elenchi presenze e nella scelta dei convocati.
-- Il PASSO E distingue i due casi prima di toccare qualcosa.

-- ============================================================================
-- PASSO E — SONO DOPPIONI?
-- ============================================================================
-- Per ognuno dei sette: esiste gia', nella Cestistica Etnea, un giocatore con
-- lo stesso nome o lo stesso numero che invece STA in una rosa?
--
-- `gemello_stesso_nome` pieno = quasi certamente un doppione: la persona e'
--   gia' dentro, questa riga e' un residuo.
-- Tutto vuoto = la persona non c'e' da nessun'altra parte: e' rimasta fuori
--   davvero, e va rimessa.

select
  orf.number,
  orf.name,
  orf.created_at,
  (select string_agg(distinct s.name, ', ')
     from players p2
     join player_sectors ps2 on ps2.player_id = p2.id
     join sectors s on s.id = ps2.sector_id
    where p2.team_id = orf.team_id and p2.id <> orf.id
      and lower(trim(p2.name)) = lower(trim(orf.name))) as gemello_stesso_nome,
  (select string_agg(distinct p3.name || ' (' || s.name || ')', ', ')
     from players p3
     join player_sectors ps3 on ps3.player_id = p3.id
     join sectors s on s.id = ps3.sector_id
    where p3.team_id = orf.team_id and p3.id <> orf.id
      and trim(p3.number) = trim(orf.number)) as chi_ha_lo_stesso_numero
from players orf
join teams t on t.id = orf.team_id
where t.name = 'Cestistica Etnea'
  and not exists (select 1 from player_sectors ps where ps.player_id = orf.id)
order by orf.created_at desc;


-- ============================================================================
-- PASSO E2 — COSA SI PORTEREBBERO DIETRO
-- ============================================================================
-- Se la risposta fosse «sono doppioni, toglili», questo dice cosa verrebbe
-- cancellato insieme a loro. Eliminare un giocatore porta via documenti,
-- presenze, scheda evolutiva e comunicazioni: non e' reversibile.
--
-- Tutti zero = sono gusci vuoti, toglierli non perde niente.
-- Un numero qualsiasi diverso da zero = fermati e dimmelo.

select
  orf.number,
  orf.name,
  (select count(*) from player_documents d where d.player_id = orf.id)        as documenti,
  (select count(*) from training_attendance a where a.player_id = orf.id)     as presenze,
  (select count(*) from player_development v where v.player_id = orf.id)      as schede_evolutive,
  (select count(*) from communication_recipients c where c.player_id = orf.id) as comunicazioni,
  (select count(*) from finance_entries f where f.player_id = orf.id)          as movimenti_economici,
  (select count(*) from profile_players pp where pp.player_id = orf.id)        as account_collegati
from players orf
join teams t on t.id = orf.team_id
where t.name = 'Cestistica Etnea'
  and not exists (select 1 from player_sectors ps where ps.player_id = orf.id)
order by orf.created_at desc;


-- ============================================================================
-- PASSO F — CASO (a): LA ROSA VERA, DA RIMETTERE DENTRO
-- ============================================================================
-- Da usare SOLO se il PASSO E ha risposto tutto vuoto.
--
-- Non servono gli id: scrivi il nome della categoria dove vanno, esattamente
-- come si legge nell'app. Li rimette tutti e sette nella stagione in corso.
--
-- Se vanno in categorie diverse, lancialo una volta per categoria aggiungendo
-- un filtro sui numeri di maglia — la riga commentata sotto.

-- insert into player_sectors (player_id, sector_id, season_id)
-- select orf.id, s.id, se.id
--   from players orf
--   join teams t on t.id = orf.team_id
--   join sectors s on s.team_id = t.id and s.name = 'DR2'          -- <<< la categoria
--   join seasons se on se.team_id = t.id and not se.closed
--  where t.name = 'Cestistica Etnea'
--    and not exists (select 1 from player_sectors ps where ps.player_id = orf.id)
--    -- and trim(orf.number) in ('16','11','39')                   -- <<< solo questi
-- on conflict do nothing;


-- ============================================================================
-- PASSO F2 — CASO (b): DOPPIONI, DA TOGLIERE
-- ============================================================================
-- Da usare SOLO se il PASSO E ha trovato i gemelli E il PASSO E2 era tutto a
-- zero. Cancella davvero, e non si torna indietro: per questo il filtro sui
-- numeri di maglia non e' commentato — vanno scritti a mano, uno per uno, cosi'
-- nessuno cancella sette persone premendo «esegui» distrattamente.

-- delete from players orf
--  using teams t
--  where t.id = orf.team_id
--    and t.name = 'Cestistica Etnea'
--    and not exists (select 1 from player_sectors ps where ps.player_id = orf.id)
--    and trim(orf.number) in ('16');                               -- <<< uno per volta

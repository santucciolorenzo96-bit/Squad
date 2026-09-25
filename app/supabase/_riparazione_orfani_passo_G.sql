-- ============================================================================
-- SQUAD — i sette orfani: Rocco esce, gli altri sei aspettano una risposta
-- ============================================================================
--
-- Il PASSO E2 ha risposto: tutti gusci vuoti tranne Rocco Giurlando, che ha
-- due presenze ad allenamento. Nessuno ha documenti, schede evolutive,
-- comunicazioni, movimenti economici o account collegati.

-- ============================================================================
-- PASSO G — VIA ROCCO GIURLANDO
-- ============================================================================
-- Non fara' parte della squadra, quindi l'anagrafica non serve piu'.
--
-- Le sue due presenze se ne vanno con lui: training_attendance cancella a
-- cascata. Vuol dire che in quei due allenamenti non risultera' piu' nessuno
-- al suo posto — non "assente", proprio nessuno, come se non fosse mai stato
-- in elenco. E' quello che vuoi, visto che in rosa non c'era comunque.
--
-- Prima si guarda chi e' (una riga, la sua), poi si cancella.

select p.id, p.number, p.name, p.created_at,
       (select count(*) from training_attendance a where a.player_id = p.id) as presenze
  from players p join teams t on t.id = p.team_id
 where t.name = 'Cestistica Etnea' and trim(p.number) = '32'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id);

-- Se sopra e' uscita UNA riga sola, ed e' Rocco Giurlando, lancia questa:

delete from players p
 using teams t
 where t.id = p.team_id
   and t.name = 'Cestistica Etnea'
   and trim(p.number) = '32'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id);


-- ============================================================================
-- PASSO H — GLI ALTRI SEI
-- ============================================================================
-- Restano Santuccio 16, More' 11, Licciardello 39, Amoroso 15, Monreale 7 e
-- Catalano 5, tutti creati il 23 agosto in cinque minuti.
--
-- Rimetterli in rosa e' una riga sola, ma prima serve sapere DOVE, e serve
-- essere sicuri che non ci siano gia' dentro sotto un'altra riga — altrimenti
-- ognuno compare due volte in rosa, in anagrafica e fra i convocati.
--
-- Questa lo dice: la rosa attuale della societa', categoria per categoria.
-- Se fra questi nomi ci sono gia' Santuccio, More', Licciardello, Amoroso,
-- Monreale o Catalano, allora i sei sono residui e vanno tolti come Rocco.
-- Se non ci sono, sono rimasti fuori davvero e vanno rimessi.

select s.name as categoria, se.name as stagione, p.number, p.name
  from players p
  join player_sectors ps on ps.player_id = p.id
  join sectors s on s.id = ps.sector_id
  join teams t on t.id = s.team_id
  left join seasons se on se.id = ps.season_id
 where t.name = 'Cestistica Etnea'
 order by s.name, se.name, p.number;


-- ============================================================================
-- PASSO H2 — RIMETTERLI DENTRO (se non sono doppioni)
-- ============================================================================
-- Scrivi il nome della categoria come si legge nell'app, niente id. Li mette
-- tutti e sei nella stagione in corso. Rilanciarlo non fa danni.

-- insert into player_sectors (player_id, sector_id, season_id)
-- select orf.id, s.id, se.id
--   from players orf
--   join teams t on t.id = orf.team_id
--   join sectors s on s.team_id = t.id and s.name = 'DR2'      -- <<< la categoria
--   join seasons se on se.team_id = t.id and not se.closed
--  where t.name = 'Cestistica Etnea'
--    and not exists (select 1 from player_sectors ps where ps.player_id = orf.id)
-- on conflict do nothing;

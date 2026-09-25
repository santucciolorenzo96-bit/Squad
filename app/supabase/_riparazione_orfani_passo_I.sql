-- ============================================================================
-- SQUAD — i sei orfani sono doppioni: via
-- ============================================================================
--
-- Il PASSO H ha sciolto il dubbio. La rosa DR2 2026/2027 contiene gia', con lo
-- stesso nome E lo stesso numero, cinque dei sei rimasti fuori:
--
--     Dario More' 11, Gabriele Amoroso 15, Lorenzo Santuccio 16,
--     Giorgio Licciardello 39, Renato Catalano 5
--
-- Quindi non erano "la rosa vera rimasta fuori": erano un primo inserimento,
-- e la rosa buona e' stata rifatta dopo. Sono righe morte — nessun documento,
-- nessuna presenza, nessun account collegato — che non compaiono da nessuna
-- parte tranne nella Situazione, dove ti fanno contare diciannove atleti
-- quando ne hai tredici.
--
-- Il sesto no: l'orfano e' «Gianni Monreale» numero 7, in rosa c'e' «Gianni
-- Morreale» numero 20. Due lettere diverse e un numero diverso. Quasi
-- certamente la stessa persona reinserita con il cognome corretto, ma
-- "quasi certamente" non basta per una cancellazione: sta in fondo, da solo.

-- ============================================================================
-- PASSO I — GUARDA PRIMA
-- ============================================================================
-- Accoppia ogni orfano al suo gemello in rosa. Devono uscire CINQUE righe.
-- Se ne escono sei o quattro, fermati.

select
  orf.number as numero_orfano,
  orf.name   as nome_orfano,
  gem.number as numero_in_rosa,
  gem.name   as nome_in_rosa,
  s.name     as categoria
from players orf
join teams t on t.id = orf.team_id
join players gem
  on gem.team_id = orf.team_id and gem.id <> orf.id
 and lower(trim(gem.name)) = lower(trim(orf.name))
 and trim(gem.number) = trim(orf.number)
join player_sectors ps on ps.player_id = gem.id
join sectors s on s.id = ps.sector_id
where t.name = 'Cestistica Etnea'
  and not exists (select 1 from player_sectors x where x.player_id = orf.id)
order by orf.name;


-- ============================================================================
-- PASSO I2 — CANCELLA I CINQUE
-- ============================================================================
-- Toglie SOLO un orfano che ha, nella stessa societa', un gemello con nome e
-- numero identici gia' in una rosa. La condizione e' la stessa della select
-- qui sopra: quello che hai letto e' quello che cancella.
--
-- Gianni Monreale non la soddisfa (cognome e numero diversi) e resta dov'e'.

delete from players orf
 using teams t
 where t.id = orf.team_id
   and t.name = 'Cestistica Etnea'
   and not exists (select 1 from player_sectors x where x.player_id = orf.id)
   and exists (
     select 1 from players gem
      join player_sectors ps on ps.player_id = gem.id
     where gem.team_id = orf.team_id and gem.id <> orf.id
       and lower(trim(gem.name)) = lower(trim(orf.name))
       and trim(gem.number) = trim(orf.number)
   );


-- ============================================================================
-- PASSO I3 — LA VERIFICA
-- ============================================================================
-- Dopo il I2 deve restare UNA riga sola: Gianni Monreale 7.

select p.number, p.name, p.created_at
  from players p join teams t on t.id = p.team_id
 where t.name = 'Cestistica Etnea'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id)
 order by p.created_at desc;


-- ============================================================================
-- PASSO I4 — GIANNI, SE CONFERMI
-- ============================================================================
-- Da scommentare solo se «Gianni Monreale» e «Gianni Morreale» sono la stessa
-- persona — cioe' se in DR2 il numero 20 e' lui. Se invece fossero due
-- ragazzi diversi, allora Monreale 7 non e' un doppione: e' un atleta rimasto
-- fuori dalla rosa, e va rimesso dentro con il PASSO I5.

-- delete from players p
--  using teams t
--  where t.id = p.team_id
--    and t.name = 'Cestistica Etnea'
--    and trim(p.number) = '7'
--    and lower(trim(p.name)) = 'gianni monreale'
--    and not exists (select 1 from player_sectors ps where ps.player_id = p.id);


-- ============================================================================
-- PASSO I5 — GIANNI, SE INVECE E' UN'ALTRA PERSONA
-- ============================================================================
-- Lo rimette in DR2 nella stagione in corso, invece di cancellarlo.

-- insert into player_sectors (player_id, sector_id, season_id)
-- select p.id, s.id, se.id
--   from players p
--   join teams t on t.id = p.team_id
--   join sectors s on s.team_id = t.id and s.name = 'DR2'
--   join seasons se on se.team_id = t.id and not se.closed
--  where t.name = 'Cestistica Etnea'
--    and trim(p.number) = '7'
--    and lower(trim(p.name)) = 'gianni monreale'
--    and not exists (select 1 from player_sectors ps where ps.player_id = p.id)
-- on conflict do nothing;

-- ============================================================================
-- LA PRIMA PARTITA (ASD BP BASKET POINT) RISULTA ANCORA AL PALACATANIA
-- ============================================================================
-- Da incollare nel SQL Editor di Supabase. Restituisce SEMPRE almeno una riga.
--
-- Mostra tutte le righe di calendario che c'entrano — qualunque categoria e
-- qualunque stagione — cosi' si vede se la partita esiste due volte, se e'
-- finita in un'altra categoria, o se la riga giusta e' stata aggiornata e a
-- essere vecchia e' la schermata.

with r as (
  select
    c.giornata,
    to_char(c.date, 'DD/MM/YYYY') as data,
    c.time as ora,
    c.opponent as avversario,
    c.location as campo,
    case c.home when true then 'casa' when false then 'trasferta' else '?' end as dove,
    s.name as categoria,
    c.season_id as stagione,
    c.played as giocata
  from calendar c
  join sectors s on s.id = c.sector_id
  where c.date = '2026-11-15'
     or c.opponent ilike '%basket point%'
)
select * from r
union all
select null, '— nessuna riga —', null, null, null, null, null, null, null
where not exists (select 1 from r)
order by data, giornata;

-- COME LEGGERLO
--
--   · campo = PALAKATANE... e ora = 20:30  -> il database e' a posto: la
--     schermata mostra dati caricati prima dell'aggiornamento. Chiudi del tutto
--     l'app (o ricarica la pagina) e riaprila.
--
--   · campo = PALACATANIA... e ora = 17:00 -> lo script _aggiorna_calendario_dr2
--     non e' stato eseguito, o si e' fermato con un errore e non ha cambiato
--     niente (e' fatto per fermarsi invece di applicare a meta').
--
--   · DUE righe per il 15/11, o una in una categoria diversa da DR2 -> il
--     calendario ha un duplicato: dimmi cosa vedi e lo sistemo.

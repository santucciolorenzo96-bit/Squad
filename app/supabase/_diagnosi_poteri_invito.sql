-- ============================================================================
-- CHI HA POTERI CHE NESSUNO GLI HA DATO
-- ============================================================================
-- Da lanciare PRIMA della migrazione 064, che quelle righe le toglie: dopo,
-- l'elenco e' vuoto e non si sa piu' chi c'era.
--
-- `profile_sectors` non dice di che categoria sei: dice quale categoria
-- GESTISCI. `has_sector_access()` non guarda il ruolo, e una riga la' vale la
-- scrittura su calendario, tabellini, classifica, allenamenti e presenze.
-- Un profilo con ruolo atleta o genitore non dovrebbe averne nessuna.
-- ============================================================================

-- 1. SEMPRE UNA RIGA: quante sono, e quante persone riguardano.
select
  count(*) as righe_sbagliate,
  count(distinct p.id) as persone,
  coalesce(string_agg(distinct p.display_name, ', '), '— nessuna —') as chi
from profile_sectors ps
join profiles p on p.id = ps.profile_id
where p.role in ('genitore', 'atleta');


-- 2. Nel dettaglio: chi, con che ruolo, su quale categoria.
--    Niente colonne della 064 qui: questa query deve girare PRIMA.
select
  p.display_name as persona,
  p.role as ruolo,
  s.name as categoria_che_potrebbe_scrivere,
  p.created_at as iscritto_il
from profile_sectors ps
join profiles p on p.id = ps.profile_id
join sectors s on s.id = ps.sector_id
where p.role in ('genitore', 'atleta')
order by p.display_name, s.name;


-- 3. Per capire quanto conta: ecco COSA basta per scrivere, con una riga sola
--    in profile_sectors e qualunque ruolo.
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and (qual like '%has_sector_access(sector_id)%' or with_check like '%has_sector_access(sector_id)%')
  and cmd <> 'SELECT'
order by tablename, policyname;


-- 4. E chi invece ce le ha per diritto: lo staff. Questa lista deve restare
--    com'e' — e' quella che fa funzionare le categorie.
select p.display_name as persona, p.role as ruolo,
       string_agg(s.name, ', ' order by s.name) as categorie_che_gestisce
from profile_sectors ps
join profiles p on p.id = ps.profile_id
join sectors s on s.id = ps.sector_id
where p.role not in ('genitore', 'atleta')
group by p.id, p.display_name, p.role
order by p.display_name;

-- ============================================================================
-- ACCOUNT «DARIO MORE»: ANTEPRIMA, SOLO LETTURA
-- ============================================================================
-- Da lanciare PRIMA della cancellazione. Risponde SEMPRE con almeno una riga.
-- Mostra chi e', dove sta e cosa succederebbe alla societa' se sparisse.
--
-- Cosa guardare:
--   · societa' e sport: deve essere quella di pallavolo. Se compare la
--     societa' di basket, FERMATI e dimmelo: sarebbe un omonimo.
--   · altri_admin_nella_societa: se e' 0, dopo la cancellazione la societa'
--     non ha piu' nessun amministratore con un profilo suo. Il tuo account
--     SuperAdmin ci entra lo stesso come amministratore, ma da li' non puoi
--     approvare gli iscritti che usano il codice (quella funzione cerca un
--     profilo admin dentro la societa').
--   · e_amministratore_di_piattaforma: deve essere false.

with r as (
  select
    p.id,
    u.email::text as email,
    p.display_name as nome,
    p.role as ruolo,
    p.active as attivo,
    t.name as societa,
    t.sport as sport,
    (select count(*) from profiles a
      where a.team_id = p.team_id and a.id <> p.id and a.active
        and a.role in ('admin', 'presidente')) as altri_admin_nella_societa,
    (select count(*) from profiles a where a.team_id = p.team_id) as persone_nella_societa,
    exists (select 1 from platform_owners o where o.user_id = p.id) as e_amministratore_di_piattaforma
  from profiles p
  join auth.users u on u.id = p.id
  left join teams t on t.id = p.team_id
  where lower(p.display_name) like 'dario mor%'
)
select * from r
union all
select null, null, '— nessun profilo con questo nome —', null, null, null, null, null, null, null
where not exists (select 1 from r);

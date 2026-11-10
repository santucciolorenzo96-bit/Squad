-- ============================================================================
-- L'ACCOUNT DI GIORGIO PUO' CREARE IL CODICE PER I SUOI ATLETI?
-- ============================================================================
-- Solo lettura. Risponde SEMPRE con almeno una riga.
--
-- Il riquadro «Codice per gli atleti» compare nella Rosa solo a chi gestisce
-- quella categoria, e la gestisce solo se due cose sono vere:
--
--   1. il ruolo e' allenatore (o admin, presidente, staff);
--   2. la categoria gli e' ASSEGNATA in Utenti, nella sua scheda.
--
-- Se l'assegnazione manca, Giorgio vede la Rosa dell'Open A ma niente riquadro,
-- e il database rifiuterebbe comunque la creazione del codice.
--
-- La scheda atleta collegata e' un'altra cosa: dice CHI e' (la sua scheda nella
-- DR2), non cosa gestisce. Non serve per creare il codice, ma deve esserci se
-- vuole vedere le sue quote e proporre la sua foto.

with r as (
  select
    p.display_name as nome,
    u.email::text as email,
    p.role as ruolo,
    p.active as attivo,
    p.approved_at is not null as approvato,
    coalesce((select string_agg(s.name, ', ' order by s.name)
              from profile_sectors ps join sectors s on s.id = ps.sector_id
              where ps.profile_id = p.id), '— nessuna —') as categorie_che_gestisce,
    coalesce((select string_agg(pl.name, ', ' order by pl.name)
              from profile_players pp join players pl on pl.id = pp.player_id
              where pp.profile_id = p.id), '— nessuna —') as schede_atleta_collegate,
    (p.role in ('admin', 'presidente', 'allenatore', 'staff')
      and p.active and p.approved_at is not null
      and (p.role in ('admin', 'presidente')
           or exists (select 1 from profile_sectors ps where ps.profile_id = p.id))) as puo_creare_il_codice
  from profiles p
  join auth.users u on u.id = p.id
  where lower(p.display_name) like '%licciardello%'
)
select * from r
union all
select '— nessun profilo con questo nome —', null, null, null, null, null, null, null
where not exists (select 1 from r);

-- COME LEGGERLO
--   · puo_creare_il_codice = true  -> e` a posto: apre la Rosa dell'Open A e
--     trova «Codice per gli atleti».
--   · false con ruolo diverso da allenatore -> da Utenti, «Modifica utente»,
--     cambia il ruolo in Allenatore.
--   · false con categorie_che_gestisce che non nomina l'Open A -> da Utenti,
--     «Modifica utente», spunta la categoria Open A.
--   · schede_atleta_collegate vuota -> e` collegato a nessuna scheda: da
--     Utenti, sezione Famiglie, collegalo alla sua scheda della DR2.

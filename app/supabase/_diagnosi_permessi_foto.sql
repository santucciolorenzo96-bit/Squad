-- ============================================================================
-- CHI PUÒ CAMBIARE LA FOTOGRAFIA DI UN ATLETA
-- ============================================================================
--
-- Segnalato: «un atleta può cambiare la foto di un altro atleta entrando nella
-- sua anagrafica». Nel codice e nelle policy quella strada non esiste — sono
-- quattro, e tutte e quattro chiedono la stessa cosa:
--
--   1. scrivere nel deposito `player-photos`  → can_manage_player(atleta)
--   2. aggiornare la riga dell'atleta          → can_manage_player(atleta)
--   3. PROPORRE una foto (deposito)            → has_family_access_to_player
--                                                 + nome file «proposta_»
--   4. propose_player_photo (la funzione)      → «questa scheda non è la tua»
--
--   can_manage_player  = is_team_manager() AND settore dell'atleta assegnato
--   is_team_manager()  = ruolo in (admin, presidente, allenatore, staff)
--   has_family_access_to_player = sei collegato a QUELL'atleta
--
-- Quindi un ruolo `atleta` o `genitore` può proporre la foto SOLO del proprio
-- atleta, e pubblicare non può in nessun caso.
--
-- Resta una spiegazione, e questa query la verifica: che quell'account non
-- abbia il ruolo che si crede. In registrazione si può scegliere da soli
-- `staff` o `segnapunti`, e se poi un amministratore gli assegna un settore,
-- quell'account gestisce la categoria — foto comprese.

-- ------------------------------------------------------------------ PASSO 1
-- Ogni utente: ruolo, atleti collegati, settori assegnati, e il verdetto.
-- Risponde sempre, anche se nessuno ha il ruolo sbagliato.

select
  p.display_name                                        as utente,
  p.role                                                as ruolo,
  p.active                                              as attivo,
  coalesce(string_agg(distinct pl.name, ', '), '—')     as atleti_collegati,
  coalesce(string_agg(distinct s.name, ', '), '—')      as settori_assegnati,
  case
    when p.role in ('admin', 'presidente')
      then 'PUÒ cambiare le foto di tutti'
    when p.role in ('allenatore', 'staff') and count(distinct s.id) > 0
      then 'PUÒ cambiare le foto degli atleti dei suoi settori'
    when p.role in ('allenatore', 'staff')
      then 'no (ha un ruolo di gestione ma nessun settore assegnato)'
    when count(distinct pl.id) > 0
      then 'può solo PROPORRE la foto dei propri atleti'
    else 'no'
  end                                                   as sulle_fotografie
from profiles p
left join profile_players pp on pp.profile_id = p.id
left join players pl         on pl.id = pp.player_id
left join profile_sectors ps on ps.profile_id = p.id
left join sectors s          on s.id = ps.sector_id
where p.team_id = (select team_id from profiles where id = p.id)
group by p.id, p.display_name, p.role, p.active
order by
  case p.role when 'admin' then 1 when 'presidente' then 2 when 'allenatore' then 3
              when 'staff' then 4 else 5 end,
  p.display_name;


-- ------------------------------------------------------------------ PASSO 2
-- Le policy che decidono davvero, come stanno adesso nel database.
-- Se una di queste non c'è, o ne compare una in più e permissiva, è lì il
-- problema: in Postgres due policy permissive si sommano, non si restringono.

select policyname, cmd, coalesce(qual, with_check) as condizione
from pg_policies
where tablename = 'objects'
  and (qual || coalesce(with_check, '')) like '%player-photos%'
order by policyname;


-- ------------------------------------------------------------------ PASSO 3
-- IL CASO CHE RESTA: UN COLLEGAMENTO SBAGLIATO.
--
-- Se quell'account risulta `atleta` senza settori, nel codice e nelle policy
-- non ha nessuna strada per CAMBIARE la foto di un altro. Una sola cosa può
-- aver prodotto quello che è stato visto: essere collegato — in
-- `profile_players` — anche all'atleta di un altro. In quel caso può mandare
-- una PROPOSTA sulla scheda di quell'atleta, e una proposta sulla scheda
-- altrui, vista da chi non sa com'è fatto il meccanismo, sembra una foto
-- cambiata.
--
-- Non lo è: la proposta non cambia niente per nessuno — in rosa, nello scout e
-- nel referto si legge `photo_path`, la pubblicata — e pubblicarla resta di
-- admin, presidente, allenatore o staff del settore.
--
-- Questa query cerca i collegamenti che non tornano.

select
  p.display_name                         as utente,
  p.role                                 as ruolo,
  count(*)                               as atleti_collegati,
  string_agg(pl.name, ', ' order by pl.name) as quali,
  case
    when p.role = 'atleta' and count(*) > 1
      then 'DA GUARDARE: un atleta collegato a più di una scheda'
    when p.role = 'atleta' and max(pl.name) is distinct from p.display_name
      then 'da guardare: nome diverso da quello della scheda collegata'
    else 'normale'
  end                                    as verdetto
from profile_players pp
join profiles p on p.id = pp.profile_id
join players pl on pl.id = pp.player_id
group by p.id, p.display_name, p.role
order by
  case when p.role = 'atleta' and count(*) > 1 then 0 else 1 end,
  p.display_name;


-- ------------------------------------------------------------------ PASSO 4
-- Le proposte di fotografia in attesa, con chi le ha mandate.
-- Una proposta arrivata da una persona che non c'entra con quell'atleta è il
-- sintomo diretto di un collegamento sbagliato.

select
  pl.name                                as atleta,
  chi.display_name                       as proposta_da,
  chi.role                               as ruolo_di_chi_propone,
  pl.photo_pending_at                    as quando,
  exists (
    select 1 from profile_players pp
     where pp.profile_id = chi.id and pp.player_id = pl.id
  )                                      as e_collegato_a_questo_atleta
from players pl
left join profiles chi on chi.id = pl.photo_pending_by
where pl.photo_pending_path is not null
order by pl.photo_pending_at desc nulls last;

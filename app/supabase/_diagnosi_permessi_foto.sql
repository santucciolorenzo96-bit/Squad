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

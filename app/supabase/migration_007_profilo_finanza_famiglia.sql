-- ============================================================================
-- Team Manager Basket — migrazione 007: telefono profilo, accesso famiglia
-- alle proprie quote in Finanza
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor del progetto Supabase, dopo le migrazioni
-- precedenti. Si applica in più sullo schema esistente.
--
-- Serve alla nuova pagina Profilo/Impostazioni: un campo telefono da
-- completare per qualunque account, e la possibilità per un account famiglia
-- di vedere (sola lettura) le entrate finanziarie del proprio figlio/a — oggi
-- bloccate del tutto, perché has_finance_access() richiede un finance_role
-- che un account famiglia non ha mai.
-- ============================================================================

alter table profiles add column phone text;

create or replace function has_family_access_to_entry(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_player_id is not null and exists (
    select 1 from profile_players pp
    where pp.profile_id = auth.uid() and pp.player_id = p_player_id
  )
$$;

drop policy if exists "finance_entries_select" on finance_entries;
create policy "finance_entries_select" on finance_entries for select
  using (
    team_id = current_team_id()
    and (
      exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager', 'viewer_team'))
      or (
        exists (select 1 from profiles where id = auth.uid() and finance_role = 'viewer_sector')
        and exists (
          select 1 from finance_entry_allocations fea
          join cost_centers cc on cc.id = fea.cost_center_id
          where fea.entry_id = finance_entries.id and cc.sector_id is not null and has_sector_access(cc.sector_id)
        )
      )
      or has_family_access_to_entry(player_id)
    )
  );

-- ============================================================================
-- Team Manager Basket — migrazione 013
-- Corregge "infinite recursion detected in policy for relation finance_entries"
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 012.
--
-- IL PROBLEMA
-- La policy di lettura di finance_entries verificava l'ambito di settore
-- interrogando finance_entry_allocations; la policy di quest'ultima verificava
-- a sua volta l'appartenenza al team interrogando finance_entries. Ogni lettura
-- innescava quindi un ciclo:
--     finance_entries -> finance_entry_allocations -> finance_entries -> ...
-- Postgres se ne accorge e interrompe con l'errore di ricorsione infinita.
-- Ne risentivano Entrate, Uscite e Scadenze, che passano tutte dalla vista
-- finance_entries_status, e più in generale ogni lettura di finance_payments,
-- la cui policy attraversa le stesse tabelle.
--
-- LA SOLUZIONE
-- I controlli che attraversano un'altra tabella passano da funzioni
-- SECURITY DEFINER: eseguite con i privilegi del proprietario, non riattivano
-- le policy delle tabelle interrogate e il ciclo si spezza. È lo stesso schema
-- già usato da has_sector_access() e dagli altri helper del progetto.
-- ============================================================================

create or replace function my_finance_role()
returns text language sql stable security definer set search_path = public as $$
  select finance_role from profiles where id = auth.uid()
$$;

-- Vede tutta la contabilità della società
create or replace function has_finance_full_access()
returns boolean language sql stable security definer set search_path = public as $$
  select my_finance_role() in ('admin', 'manager', 'viewer_team')
$$;

-- Il movimento tocca almeno un centro di costo di un settore a cui ho accesso.
-- SECURITY DEFINER: è questa la funzione che rompe il ciclo.
create or replace function entry_in_my_sectors(p_entry_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_entry_id is not null and exists (
    select 1 from finance_entry_allocations fea
    join cost_centers cc on cc.id = fea.cost_center_id
    where fea.entry_id = p_entry_id
      and cc.sector_id is not null
      and has_sector_access(cc.sector_id)
  )
$$;

-- Appartenenza del movimento alla società, senza passare dalle policy di
-- finance_entries (era l'altra metà del ciclo)
create or replace function entry_in_my_team(p_entry_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from finance_entries e
    where e.id = p_entry_id and e.team_id = current_team_id()
  )
$$;

-- Atleta intestatario del movimento: serve alle policy dei pagamenti per
-- riconoscere le quote del proprio figlio senza rientrare in finance_entries
create or replace function entry_player_id(p_entry_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select player_id from finance_entries where id = p_entry_id
$$;

-- ============================================================================
-- Policy riscritte usando gli helper
-- ============================================================================

drop policy if exists "finance_entries_select" on finance_entries;
create policy "finance_entries_select" on finance_entries for select
  using (
    team_id = current_team_id()
    and (
      has_finance_full_access()
      or (my_finance_role() = 'viewer_sector' and entry_in_my_sectors(id))
      or has_family_access_to_entry(player_id)   -- quote del proprio figlio/di sé (migrazione 007)
    )
  );

drop policy if exists "finance_entry_allocations_select" on finance_entry_allocations;
create policy "finance_entry_allocations_select" on finance_entry_allocations for select
  using (
    entry_in_my_team(entry_id)
    and (
      has_finance_full_access()
      or (
        my_finance_role() = 'viewer_sector'
        and exists (
          select 1 from cost_centers cc
          where cc.id = finance_entry_allocations.cost_center_id
            and cc.sector_id is not null and has_sector_access(cc.sector_id)
        )
      )
    )
  );

drop policy if exists "finance_entry_allocations_write" on finance_entry_allocations;
create policy "finance_entry_allocations_write" on finance_entry_allocations for all
  using (entry_in_my_team(entry_id) and has_finance_manage_access())
  with check (entry_in_my_team(entry_id) and has_finance_manage_access());

drop policy if exists "finance_payments_select" on finance_payments;
create policy "finance_payments_select" on finance_payments for select
  using (
    team_id = current_team_id()
    and (
      has_finance_full_access()
      or (my_finance_role() = 'viewer_sector' and entry_in_my_sectors(entry_id))
      -- senza questo ramo un account Genitore/Atleta non riesce a leggere lo
      -- stato delle proprie quote, che la vista finance_entries_status calcola
      -- proprio dai pagamenti
      or has_family_access_to_entry(entry_player_id(entry_id))
    )
  );

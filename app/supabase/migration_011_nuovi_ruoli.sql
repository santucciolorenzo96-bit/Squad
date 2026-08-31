-- ============================================================================
-- Team Manager Basket — migrazione 011
-- Nuovo insieme di ruoli: Admin, Presidente, Staff, Allenatore, Segnapunti,
-- Genitore, Atleta
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 010.
--
-- Cosa cambia
--   'famiglia'  -> si sdoppia in 'genitore' e 'atleta' (stessi permessi, due
--                  etichette: gli account esistenti diventano 'genitore')
--   'presidente'-> nuovo, stessi poteri dell'admin
--   'staff'     -> nuovo, dirigente: anagrafica, documenti, presenze,
--                  allenamenti e calendario dei propri settori. Niente rosa,
--                  partita o statistiche tecniche.
-- ============================================================================

-- 1. Vincolo: si allarga prima, per poter migrare le righe esistenti
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','presidente','staff','allenatore','segnapunti','famiglia','genitore','atleta'));

update profiles set role = 'genitore' where role = 'famiglia';

-- 2. Vincolo definitivo, senza il vecchio valore
alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta'));

-- ============================================================================
-- Funzioni di ruolo. Ridefinirle qui aggiorna in un colpo solo tutte le policy
-- che le usano, senza doverle riscrivere una per una.
-- ============================================================================

-- Presidente = secondo amministratore, a tutti gli effetti
create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente')
$$;

-- Chi ha responsabilità gestionali sui propri settori. Include lo staff
-- dirigenziale: gestisce anagrafica, documenti, presenze, allenamenti e
-- calendario. Il segnapunti resta fuori: il suo compito è il solo tabellino.
create or replace function is_team_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente', 'allenatore', 'staff')
$$;

-- Chi può comporre la rosa: aggiungere, spostare e togliere giocatori è una
-- scelta tecnica, quindi resta ad allenatore e amministrazione.
create or replace function is_roster_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente', 'allenatore')
$$;

-- L'accesso "a tutti i settori" segue l'amministrazione, quindi ora anche il presidente
create or replace function has_sector_access(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from profile_sectors ps
    where ps.profile_id = auth.uid() and ps.sector_id = p_sector_id
  )
$$;

create or replace function has_sector_access_to_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from player_sectors psec
    join profile_sectors ps on ps.sector_id = psec.sector_id
    where psec.player_id = p_player_id and ps.profile_id = auth.uid()
  )
$$;

-- ============================================================================
-- Policy che citavano 'admin' direttamente: ora passano da is_admin()
-- ============================================================================

drop policy if exists "teams_update_admin" on teams;
create policy "teams_update_admin" on teams for update
  using (id = current_team_id() and is_admin());

drop policy if exists "profiles_update_admin" on profiles;
create policy "profiles_update_admin" on profiles for update
  using (team_id = current_team_id() and is_admin());

drop policy if exists "sectors_write_admin" on sectors;
create policy "sectors_write_admin" on sectors for all
  using (team_id = current_team_id() and is_admin())
  with check (team_id = current_team_id() and is_admin());

drop policy if exists "profile_sectors_write_admin" on profile_sectors;
create policy "profile_sectors_write_admin" on profile_sectors for all
  using (is_admin() and exists (select 1 from sectors s where s.id = sector_id and s.team_id = current_team_id()))
  with check (is_admin() and exists (select 1 from sectors s where s.id = sector_id and s.team_id = current_team_id()));

drop policy if exists "profile_sectors_select" on profile_sectors;
create policy "profile_sectors_select" on profile_sectors for select
  using (profile_id = auth.uid() or is_admin());

drop policy if exists "players_select" on players;
create policy "players_select" on players for select
  using (
    team_id = current_team_id()
    and (
      is_admin()
      or exists (select 1 from player_sectors psec where psec.player_id = id
                 and (has_sector_access(psec.sector_id) or has_family_access(psec.sector_id)))
      or not exists (select 1 from player_sectors psec where psec.player_id = id)
    )
  );

-- Comporre la rosa: allenatore e amministrazione. Lo staff dirigenziale
-- aggiorna i dati anagrafici (players_update_staff, definita nella 010 con
-- can_manage_player) ma non aggiunge né rimuove giocatori.
drop policy if exists "players_insert_staff" on players;
create policy "players_insert_staff" on players for insert
  with check (team_id = current_team_id() and is_roster_manager());

drop policy if exists "players_delete_staff" on players;
create policy "players_delete_staff" on players for delete
  using (team_id = current_team_id() and is_roster_manager() and has_sector_access_to_player(id));

drop policy if exists "player_sectors_write_staff" on player_sectors;
create policy "player_sectors_write_staff" on player_sectors for all
  using (is_roster_manager() and has_sector_access(sector_id))
  with check (is_roster_manager() and has_sector_access(sector_id));

-- ============================================================================
-- Codice invito e loghi: azioni da amministrazione
-- ============================================================================

create or replace function regenerate_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può rigenerare il codice invito';
  end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  update teams set invite_code = v_code where id = current_team_id();
  return v_code;
end;
$$;

drop policy if exists "team_logos_admin_write" on storage.objects;
create policy "team_logos_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'team-logos' and is_admin()
    and (storage.foldername(name))[1] = current_team_id()::text
  );

drop policy if exists "team_logos_admin_update" on storage.objects;
create policy "team_logos_admin_update" on storage.objects for update
  using (
    bucket_id = 'team-logos' and is_admin()
    and (storage.foldername(name))[1] = current_team_id()::text
  );

-- ============================================================================
-- Registrazione con codice invito: i ruoli scegliibili da chi si iscrive
-- ============================================================================

create or replace function join_team(
  p_invite_code text, p_display_name text, p_role text default 'genitore'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per entrare in una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
  end if;
  -- ruoli con privilegi (admin, presidente, allenatore, staff) restano
  -- assegnabili solo da un amministratore dalla schermata Utenti
  if p_role not in ('segnapunti', 'genitore', 'atleta') then
    raise exception 'Ruolo non valido in fase di registrazione';
  end if;

  select id into v_team_id from teams where invite_code = upper(p_invite_code);
  if v_team_id is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_team_id, p_display_name, p_role);

  return v_team_id;
end;
$$;

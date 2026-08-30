-- ============================================================================
-- Team Manager Basket — migrazione 010
-- Il segnapunti può agire solo sul tabellino: allinea le policy al ruolo reale
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 009.
--
-- PROBLEMA
-- Le policy di scrittura di quasi tutte le tabelle di settore usavano
-- has_sector_access(), che verifica SOLO l'assegnazione al settore e non il
-- ruolo. Un segnapunti assegnato a un settore poteva quindi, chiamando
-- direttamente l'API, modificare o cancellare giocatori, approvare certificati
-- medici, riscrivere classifica, calendario e allenamenti — tutte cose che
-- l'interfaccia non gli offre, ma che il database non impediva.
--
-- Il segnapunti deve poter agire solo sulla partita in diretta (tabella games),
-- che resta volutamente aperta a chiunque abbia accesso al settore.
-- ============================================================================

create or replace function is_team_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'allenatore')
$$;

-- Tenere il tabellino non richiede responsabilità gestionali: è un compito che
-- a bordo campo svolge spesso un genitore. Diventa quindi un permesso per
-- singolo account, concesso dall'amministratore, come per i documenti.
alter table profiles add column can_score_matches boolean not null default false;

create or replace function family_can_score_matches()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select can_score_matches from profiles where id = auth.uid()), false)
$$;

-- Accesso al settore E ruolo che comporta responsabilità gestionali.
-- has_sector_access() è già true per gli admin su qualunque settore.
create or replace function can_manage_sector(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_team_manager() and has_sector_access(p_sector_id)
$$;

create or replace function can_manage_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_team_manager() and has_sector_access_to_player(p_player_id)
$$;

-- ============================================================================
-- Rosa e assegnazioni di settore
-- ============================================================================

drop policy if exists "player_sectors_write_staff" on player_sectors;
create policy "player_sectors_write_staff" on player_sectors for all
  using (can_manage_sector(sector_id))
  with check (can_manage_sector(sector_id));

drop policy if exists "players_update_staff" on players;
create policy "players_update_staff" on players for update
  using (team_id = current_team_id() and can_manage_player(id));

drop policy if exists "players_delete_staff" on players;
create policy "players_delete_staff" on players for delete
  using (team_id = current_team_id() and can_manage_player(id));

-- ============================================================================
-- Programmazione: prossima partita, classifica, calendario, allenamenti
-- ============================================================================

drop policy if exists "next_match_write_staff" on next_match;
create policy "next_match_write_staff" on next_match for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

drop policy if exists "standings_write_staff" on standings;
create policy "standings_write_staff" on standings for all
  using (team_id = current_team_id() and (sector_id is null or can_manage_sector(sector_id)) and is_team_manager())
  with check (team_id = current_team_id() and (sector_id is null or can_manage_sector(sector_id)) and is_team_manager());

drop policy if exists "calendar_write_staff" on calendar;
create policy "calendar_write_staff" on calendar for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

drop policy if exists "trainings_write_staff" on trainings;
create policy "trainings_write_staff" on trainings for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

drop policy if exists "training_recurrences_write_staff" on training_recurrences;
create policy "training_recurrences_write_staff" on training_recurrences for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

drop policy if exists "training_attendance_write_staff" on training_attendance;
create policy "training_attendance_write_staff" on training_attendance for all
  using (exists (
    select 1 from trainings t where t.id = training_id and can_manage_sector(t.sector_id)
  ))
  with check (exists (
    select 1 from trainings t where t.id = training_id and can_manage_sector(t.sector_id)
  ));

-- ============================================================================
-- Documenti: caricare e revisionare sono azioni di admin/allenatore
-- (la famiglia carica solo se abilitata — permesso introdotto nella 008)
-- ============================================================================

drop policy if exists "player_documents_insert" on player_documents;
create policy "player_documents_insert" on player_documents for insert
  with check (
    team_id = current_team_id()
    and (
      can_manage_player(player_id)
      or (has_family_access_to_player(player_id) and family_can_upload_documents())
    )
  );

drop policy if exists "player_documents_update_staff" on player_documents;
create policy "player_documents_update_staff" on player_documents for update
  using (team_id = current_team_id() and can_manage_player(player_id));

drop policy if exists "player_documents_storage_write" on storage.objects;
create policy "player_documents_storage_write" on storage.objects for insert
  with check (
    bucket_id = 'player-documents'
    and (
      can_manage_player(((storage.foldername(name))[2])::uuid)
      or (has_family_access_to_player(((storage.foldername(name))[2])::uuid)
          and family_can_upload_documents())
    )
  );

drop policy if exists "player_documents_storage_update" on storage.objects;
create policy "player_documents_storage_update" on storage.objects for update
  using (bucket_id = 'player-documents' and can_manage_player(((storage.foldername(name))[2])::uuid));

drop policy if exists "player_documents_storage_delete" on storage.objects;
create policy "player_documents_storage_delete" on storage.objects for delete
  using (bucket_id = 'player-documents' and can_manage_player(((storage.foldername(name))[2])::uuid));

-- ============================================================================
-- Foto giocatore: la policy unica "for all" copriva lettura e scrittura
-- insieme; si separano per lasciare la consultazione a chi già la aveva
-- ============================================================================

drop policy if exists "player_photos_storage_rw" on storage.objects;

create policy "player_photos_storage_read" on storage.objects for select
  using (
    bucket_id = 'player-photos'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "player_photos_storage_write" on storage.objects for insert
  with check (bucket_id = 'player-photos' and can_manage_player(((storage.foldername(name))[2])::uuid));

create policy "player_photos_storage_update" on storage.objects for update
  using (bucket_id = 'player-photos' and can_manage_player(((storage.foldername(name))[2])::uuid));

create policy "player_photos_storage_delete" on storage.objects for delete
  using (bucket_id = 'player-photos' and can_manage_player(((storage.foldername(name))[2])::uuid));

-- ============================================================================
-- Tabellino: staff del settore, più gli account collegati che l'admin abilita
-- ============================================================================

drop policy if exists "games_insert" on games;
create policy "games_insert" on games for insert
  with check (
    team_id = current_team_id()
    and (
      sector_id is null
      or has_sector_access(sector_id)
      or (has_family_access(sector_id) and family_can_score_matches())
    )
  );

drop policy if exists "games_update" on games;
create policy "games_update" on games for update
  using (
    team_id = current_team_id()
    and (
      sector_id is null
      or has_sector_access(sector_id)
      or (has_family_access(sector_id) and family_can_score_matches())
    )
  );

-- NOTA: le policy di SELECT restano invariate. `games` resta volutamente la
-- sola tabella scrivibile dal segnapunti: è il tabellino, il suo unico compito.

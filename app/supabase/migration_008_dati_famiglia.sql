-- ============================================================================
-- Team Manager Basket — migrazione 008
-- Gli account collegati completano i dati del proprio giocatore;
-- il caricamento documenti diventa un permesso concesso dall'admin
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 007.
-- ============================================================================

-- Permesso concesso dall'amministratore, per singolo account. Di default no:
-- il caricamento del certificato medico resta un'azione dello staff finché
-- l'admin non abilita esplicitamente la famiglia.
alter table profiles add column can_upload_documents boolean not null default false;

create or replace function family_can_upload_documents()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select can_upload_documents from profiles where id = auth.uid()), false)
$$;

-- ============================================================================
-- Dati anagrafici compilabili dalla famiglia
-- ============================================================================
-- Non si apre una policy di update su `players`: RLS lavora per riga, non per
-- colonna, quindi un update generico lascerebbe modificare anche numero di
-- maglia, nome o team_id. Si espone invece una funzione che scrive solo i
-- campi anagrafici, dopo aver verificato il collegamento profilo-giocatore.
create or replace function update_linked_player_details(
  p_player_id uuid,
  p_birth_date date,
  p_fiscal_code text,
  p_guardian_phone text,
  p_email text,
  p_height_cm int
) returns players
language plpgsql security definer set search_path = public as $$
declare
  v_row players;
begin
  if not has_family_access_to_player(p_player_id) then
    raise exception 'Non sei collegato a questo giocatore';
  end if;

  update players set
    birth_date     = p_birth_date,
    fiscal_code    = p_fiscal_code,
    guardian_phone = p_guardian_phone,
    email          = p_email,
    height_cm      = p_height_cm
  where id = p_player_id and team_id = current_team_id()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Giocatore non trovato';
  end if;
  return v_row;
end;
$$;

-- ============================================================================
-- Caricamento documenti: per la famiglia serve il permesso dell'admin
-- ============================================================================

drop policy if exists "player_documents_insert" on player_documents;
create policy "player_documents_insert" on player_documents for insert
  with check (
    team_id = current_team_id()
    and (
      has_sector_access_to_player(player_id)
      or (has_family_access_to_player(player_id) and family_can_upload_documents())
    )
  );

-- Stessa condizione sul bucket: la lettura resta libera per la famiglia (deve
-- poter rivedere i documenti del figlio), la scrittura no.
drop policy if exists "player_documents_storage_rw" on storage.objects;

create policy "player_documents_storage_read" on storage.objects for select
  using (
    bucket_id = 'player-documents'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );

create policy "player_documents_storage_write" on storage.objects for insert
  with check (
    bucket_id = 'player-documents'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or (has_family_access_to_player(((storage.foldername(name))[2])::uuid)
          and family_can_upload_documents())
    )
  );

create policy "player_documents_storage_update" on storage.objects for update
  using (
    bucket_id = 'player-documents'
    and has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
  );

create policy "player_documents_storage_delete" on storage.objects for delete
  using (
    bucket_id = 'player-documents'
    and has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
  );

-- ============================================================================
-- Team Manager Basket — migrazione 002: settori, famiglie, anagrafica, documenti
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor del progetto Supabase, dopo schema.sql.
-- Si applica in più sullo schema esistente (non lo riscrive).
-- ============================================================================

-- ============================================================================
-- TABELLE
-- ============================================================================

create table sectors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- staff <-> settori a cui è assegnato (vuoto per un admin: l'admin vede tutto implicitamente)
create table profile_sectors (
  profile_id uuid not null references profiles(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  primary key (profile_id, sector_id)
);

-- giocatore <-> settori in cui è rosterizzato (un giocatore può stare in più settori)
create table player_sectors (
  player_id uuid not null references players(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  primary key (player_id, sector_id)
);

-- account famiglia (giocatore/genitore) <-> giocatore/i a cui è collegato
create table profile_players (
  profile_id uuid not null references profiles(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  primary key (profile_id, player_id)
);

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','allenatore','segnapunti','famiglia'));

alter table players add column birth_date date;
alter table players add column fiscal_code text;
alter table players add column role_position text;
alter table players add column guardian_phone text;
alter table players add column email text;
alter table players add column joined_at date;

alter table games add column sector_id uuid references sectors(id);
alter table standings add column sector_id uuid references sectors(id);

alter table next_match drop constraint next_match_pkey;
alter table next_match add column sector_id uuid references sectors(id);
alter table next_match add primary key (sector_id);

create table trainings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  title text not null default 'Allenamento',
  date date not null,
  start_time text,
  end_time text,
  location text,
  created_at timestamptz not null default now()
);

create table player_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  doc_type text not null,
  file_path text not null,
  file_name text not null,
  status text not null default 'in_review' check (status in ('in_review','approved','rejected')),
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  review_note text,
  expires_at date
);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

create or replace function has_sector_access(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'admin' or exists (
    select 1 from profile_sectors ps
    where ps.profile_id = auth.uid() and ps.sector_id = p_sector_id
  )
$$;

create or replace function has_family_access(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_players pp
    join player_sectors psec on psec.player_id = pp.player_id
    where pp.profile_id = auth.uid() and psec.sector_id = p_sector_id
  )
$$;

create or replace function has_family_access_to_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profile_players pp
    where pp.profile_id = auth.uid() and pp.player_id = p_player_id
  )
$$;

create or replace function has_sector_access_to_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() = 'admin' or exists (
    select 1 from player_sectors psec
    join profile_sectors ps on ps.sector_id = psec.sector_id
    where psec.player_id = p_player_id and ps.profile_id = auth.uid()
  )
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table sectors enable row level security;
alter table profile_sectors enable row level security;
alter table player_sectors enable row level security;
alter table profile_players enable row level security;
alter table trainings enable row level security;
alter table player_documents enable row level security;

-- sectors: lettura per tutto il team, scrittura solo admin
create policy "sectors_select_team" on sectors for select
  using (team_id = current_team_id());
create policy "sectors_write_admin" on sectors for all
  using (team_id = current_team_id() and my_role() = 'admin')
  with check (team_id = current_team_id() and my_role() = 'admin');

-- profile_sectors: lettura per tutto il team (serve per mostrare gli assegnamenti in Utenti),
-- scrittura solo admin
create policy "profile_sectors_select_team" on profile_sectors for select
  using (exists (select 1 from sectors s where s.id = sector_id and s.team_id = current_team_id()));
create policy "profile_sectors_write_admin" on profile_sectors for all
  using (my_role() = 'admin' and exists (select 1 from sectors s where s.id = sector_id and s.team_id = current_team_id()))
  with check (my_role() = 'admin' and exists (select 1 from sectors s where s.id = sector_id and s.team_id = current_team_id()));

-- player_sectors: lettura da chi ha accesso al settore (staff o famiglia), scrittura staff con accesso al settore
create policy "player_sectors_select" on player_sectors for select
  using (has_sector_access(sector_id) or has_family_access(sector_id));
create policy "player_sectors_write_staff" on player_sectors for all
  using (has_sector_access(sector_id))
  with check (has_sector_access(sector_id));

-- profile_players: collegamento manuale, riservato ad admin; l'utente vede il proprio collegamento
create policy "profile_players_select" on profile_players for select
  using (profile_id = auth.uid() or my_role() = 'admin');
create policy "profile_players_write_admin" on profile_players for all
  using (my_role() = 'admin')
  with check (my_role() = 'admin');

-- players: sostituisce le policy della migrazione 001 con versioni sector-aware
drop policy if exists "players_select_team" on players;
drop policy if exists "players_write_staff" on players;
create policy "players_select" on players for select
  using (
    team_id = current_team_id()
    and (
      my_role() = 'admin'
      or exists (select 1 from player_sectors psec where psec.player_id = id and (has_sector_access(psec.sector_id) or has_family_access(psec.sector_id)))
      or not exists (select 1 from player_sectors psec where psec.player_id = id) -- giocatore non ancora assegnato a un settore: visibile allo staff che lo ha creato
    )
  );
-- insert: nessun player_sectors esiste ancora al momento della creazione, quindi resta
-- scoped solo al team (l'app assegna il settore subito dopo, nella stessa azione utente)
create policy "players_insert_staff" on players for insert
  with check (team_id = current_team_id() and my_role() in ('admin','allenatore'));
-- update/delete: solo admin, o allenatore con accesso ad almeno un settore del giocatore
create policy "players_update_staff" on players for update
  using (team_id = current_team_id() and (my_role() = 'admin' or has_sector_access_to_player(id)));
create policy "players_delete_staff" on players for delete
  using (team_id = current_team_id() and (my_role() = 'admin' or has_sector_access_to_player(id)));

-- games: sostituisce le policy della migrazione 001 con versioni sector-aware
drop policy if exists "games_select_team" on games;
drop policy if exists "games_insert_team" on games;
drop policy if exists "games_update_live_or_staff" on games;
create policy "games_select" on games for select
  using (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id) or has_family_access(sector_id)));
create policy "games_insert" on games for insert
  with check (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id)));
create policy "games_update" on games for update
  using (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id)));

-- next_match: sostituisce le policy della migrazione 001
drop policy if exists "next_match_select_team" on next_match;
drop policy if exists "next_match_write_staff" on next_match;
create policy "next_match_select" on next_match for select
  using (team_id = current_team_id() and (has_sector_access(sector_id) or has_family_access(sector_id)));
create policy "next_match_write_staff" on next_match for all
  using (team_id = current_team_id() and has_sector_access(sector_id))
  with check (team_id = current_team_id() and has_sector_access(sector_id));

-- standings: sostituisce le policy della migrazione 001
drop policy if exists "standings_select_team" on standings;
drop policy if exists "standings_write_staff" on standings;
create policy "standings_select" on standings for select
  using (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id) or has_family_access(sector_id)));
create policy "standings_write_staff" on standings for all
  using (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id)))
  with check (team_id = current_team_id() and (sector_id is null or has_sector_access(sector_id)));

-- trainings
create policy "trainings_select" on trainings for select
  using (team_id = current_team_id() and (has_sector_access(sector_id) or has_family_access(sector_id)));
create policy "trainings_write_staff" on trainings for all
  using (team_id = current_team_id() and has_sector_access(sector_id))
  with check (team_id = current_team_id() and has_sector_access(sector_id));

-- player_documents: famiglia può inserire/leggere i documenti del proprio giocatore;
-- staff con accesso al settore del giocatore può leggere/inserire e revisionare (update)
create policy "player_documents_select" on player_documents for select
  using (
    team_id = current_team_id()
    and (has_sector_access_to_player(player_id) or has_family_access_to_player(player_id))
  );
create policy "player_documents_insert" on player_documents for insert
  with check (
    team_id = current_team_id()
    and (has_sector_access_to_player(player_id) or has_family_access_to_player(player_id))
  );
create policy "player_documents_update_staff" on player_documents for update
  using (team_id = current_team_id() and has_sector_access_to_player(player_id));

-- ============================================================================
-- RPC: create_team ora crea anche un primo settore di default,
-- altrimenti un admin appena registrato non vedrebbe nessuna schermata popolata
-- ============================================================================

create or replace function create_team(
  p_name text, p_city text, p_category text, p_display_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per creare una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
  end if;

  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into teams (name, city, category, invite_code)
    values (p_name, p_city, p_category, v_code)
    returning id into v_team_id;

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_team_id, p_display_name, 'admin');

  insert into sectors (team_id, name, sort_order)
    values (v_team_id, 'Prima Squadra', 0);

  return v_team_id;
end;
$$;

-- ============================================================================
-- RPC: join_team con scelta di ruolo (staff o famiglia)
-- ============================================================================

create or replace function join_team(
  p_invite_code text, p_display_name text, p_role text default 'segnapunti'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  if p_role not in ('segnapunti','famiglia') then
    raise exception 'Ruolo non valido';
  end if;
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per entrare in una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
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

-- ============================================================================
-- STORAGE: bucket documenti giocatore (privato)
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('player-documents', 'player-documents', false)
  on conflict (id) do nothing;

create policy "player_documents_storage_rw" on storage.objects for all
  using (
    bucket_id = 'player-documents'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'player-documents'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );

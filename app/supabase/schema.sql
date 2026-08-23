-- ============================================================================
-- Team Manager Basket — schema Supabase
-- ============================================================================
-- Esegui questo file UNA VOLTA nel SQL Editor del tuo progetto Supabase
-- (dashboard -> SQL Editor -> New query -> incolla tutto -> Run).
--
-- Prerequisiti: nessuno, il file crea tutto da zero (tabelle, RLS, funzioni,
-- bucket per i loghi). Puoi eseguirlo più volte in sicurezza grazie agli
-- "if not exists" / "or replace" dove possibile; se rilanci dopo aver già
-- creato dati, le "create table" falliranno (atteso, sono no-op).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- TABELLE
-- ============================================================================

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text default '',
  category text default '',
  logo_url text,
  primary_color text not null default '#FF6A13',
  secondary_color text not null default '#FFC53D',
  invite_code text not null unique,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  display_name text not null,
  role text not null check (role in ('admin','allenatore','segnapunti')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  number text not null default '-',
  name text not null,
  created_at timestamptz not null default now()
);

create table games (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  status text not null check (status in ('live','finished')),
  opp_name text not null default 'Avversari',
  quarter_length int not null default 600,
  num_quarters int not null default 4,
  quarter int not null default 1,
  clock int not null default 600,
  clock_running boolean not null default false,
  team_score int not null default 0,
  opp_score int not null default 0,
  quarter_fouls jsonb not null default '{}'::jsonb,
  players jsonb not null default '[]'::jsonb,
  started_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

-- Un solo game 'live' per team alla volta
create unique index games_one_live_per_team
  on games(team_id) where (status = 'live');

create table next_match (
  team_id uuid primary key references teams(id) on delete cascade,
  opponent text not null default '',
  date text default '',
  time text default '',
  location text default '',
  home boolean not null default true
);

create table standings (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  team_name text not null,
  played int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  points int not null default 0,
  is_us boolean not null default false
);

-- ============================================================================
-- HELPER FUNCTIONS (usate dalle policy RLS)
-- ============================================================================

create or replace function current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from profiles where id = auth.uid() and active
$$;

create or replace function my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and active
$$;

-- ============================================================================
-- RLS
-- ============================================================================

alter table teams enable row level security;
alter table profiles enable row level security;
alter table players enable row level security;
alter table games enable row level security;
alter table next_match enable row level security;
alter table standings enable row level security;

-- teams: ogni membro vede solo la propria squadra; solo l'admin la modifica
create policy "teams_select_own" on teams for select
  using (id = current_team_id());
create policy "teams_update_admin" on teams for update
  using (id = current_team_id() and my_role() = 'admin');

-- profiles: membri dello stesso team si vedono tra loro;
-- ognuno modifica il proprio display_name, solo admin modifica ruolo/attivo di altri
create policy "profiles_select_team" on profiles for select
  using (team_id = current_team_id());
create policy "profiles_update_self_name" on profiles for update
  using (id = auth.uid());
create policy "profiles_update_admin" on profiles for update
  using (team_id = current_team_id() and my_role() = 'admin');

-- players (rosa): letti da tutto lo staff, scritti da admin/allenatore
create policy "players_select_team" on players for select
  using (team_id = current_team_id());
create policy "players_write_staff" on players for all
  using (team_id = current_team_id() and my_role() in ('admin','allenatore'))
  with check (team_id = current_team_id() and my_role() in ('admin','allenatore'));

-- games: letti da tutto lo staff; scritti da tutti mentre 'live', solo admin/allenatore dopo
create policy "games_select_team" on games for select
  using (team_id = current_team_id());
create policy "games_insert_team" on games for insert
  with check (team_id = current_team_id());
create policy "games_update_live_or_staff" on games for update
  using (
    team_id = current_team_id()
    and (status = 'live' or my_role() in ('admin','allenatore'))
  );

-- next_match: letto da tutti, scritto da admin/allenatore
create policy "next_match_select_team" on next_match for select
  using (team_id = current_team_id());
create policy "next_match_write_staff" on next_match for all
  using (team_id = current_team_id() and my_role() in ('admin','allenatore'))
  with check (team_id = current_team_id() and my_role() in ('admin','allenatore'));

-- standings: letta da tutti, scritta da admin/allenatore
create policy "standings_select_team" on standings for select
  using (team_id = current_team_id());
create policy "standings_write_staff" on standings for all
  using (team_id = current_team_id() and my_role() in ('admin','allenatore'))
  with check (team_id = current_team_id() and my_role() in ('admin','allenatore'));

-- ============================================================================
-- RPC: creazione squadra (primo admin) e ingresso in squadra esistente
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

  return v_team_id;
end;
$$;

create or replace function join_team(
  p_invite_code text, p_display_name text
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

  select id into v_team_id from teams where invite_code = upper(p_invite_code);
  if v_team_id is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_team_id, p_display_name, 'segnapunti');

  return v_team_id;
end;
$$;

create or replace function regenerate_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  if my_role() <> 'admin' then
    raise exception 'Solo un amministratore può rigenerare il codice invito';
  end if;
  v_code := upper(substr(md5(random()::text), 1, 6));
  update teams set invite_code = v_code where id = current_team_id();
  return v_code;
end;
$$;

-- ============================================================================
-- STORAGE: bucket loghi squadra
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('team-logos', 'team-logos', true)
  on conflict (id) do nothing;

create policy "team_logos_public_read" on storage.objects for select
  using (bucket_id = 'team-logos');

create policy "team_logos_admin_write" on storage.objects for insert
  with check (
    bucket_id = 'team-logos'
    and my_role() = 'admin'
    and (storage.foldername(name))[1] = current_team_id()::text
  );

create policy "team_logos_admin_update" on storage.objects for update
  using (
    bucket_id = 'team-logos'
    and my_role() = 'admin'
    and (storage.foldername(name))[1] = current_team_id()::text
  );

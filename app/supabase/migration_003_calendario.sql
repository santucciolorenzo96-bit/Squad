-- Fase 3: calendario campionato (upload PDF + revisione manuale prima del salvataggio)

create table calendar (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  giornata int,
  opponent text not null,
  date date,
  time text,
  location text,
  home boolean,
  played boolean not null default false,
  team_score int,
  opp_score int,
  created_at timestamptz not null default now()
);

alter table calendar enable row level security;

create policy "calendar_select" on calendar for select
  using (team_id = current_team_id() and (has_sector_access(sector_id) or has_family_access(sector_id)));

create policy "calendar_write_staff" on calendar for all
  using (team_id = current_team_id() and has_sector_access(sector_id))
  with check (team_id = current_team_id() and has_sector_access(sector_id));

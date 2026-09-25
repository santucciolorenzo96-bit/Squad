-- ============================================================================
-- SQUAD — migrazione 043
-- Gli obiettivi: uno alla volta, spuntati quando sono raggiunti
-- ============================================================================
--
-- L'obiettivo resta dell'allenatore: lo scrive lui, il ragazzo lo legge e ci
-- lavora. Quello che mancava e' la fine della frase — quando l'obiettivo e'
-- raggiunto, l'allenatore lo spunta e ne scrive un altro.
--
-- Finora l'obiettivo era UN CAMPO: scriverne uno nuovo cancellava il
-- precedente, e di quello che un ragazzo aveva migliorato in due anni non
-- restava niente. Un obiettivo raggiunto e cancellato e' un lavoro fatto e
-- dimenticato — ed e' proprio la cosa che a un quindicenne serve vedere.
--
-- Da qui in poi gli obiettivi sono righe, non un campo: quello in corso e'
-- l'ultimo senza data di raggiungimento, gli altri sono la sua storia.

create table if not exists player_objectives (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  testo text not null,
  set_at date not null default current_date,
  set_by uuid references profiles(id),
  achieved_at date,
  achieved_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists player_objectives_player_idx on player_objectives(player_id);

alter table player_objectives enable row level security;

-- Stessa visibilita' della scheda evolutiva: lo staff del settore e la
-- famiglia collegata. Un obiettivo scritto e non letto dall'atleta non e' un
-- obiettivo, e' un appunto.
drop policy if exists "player_objectives_select" on player_objectives;
create policy "player_objectives_select" on player_objectives for select
  using (
    team_id = current_team_id()
    and (has_sector_access_to_player(player_id) or has_family_access_to_player(player_id))
  );

-- Scrittura solo di chi gestisce quel giocatore: la decisione tecnica e'
-- dell'allenatore, e resta sua anche la spunta.
drop policy if exists "player_objectives_write_staff" on player_objectives;
create policy "player_objectives_write_staff" on player_objectives for all
  using (team_id = current_team_id() and can_manage_player(player_id))
  with check (team_id = current_team_id() and can_manage_player(player_id));


-- ============================================================================
-- GLI OBIETTIVI CHE ESISTONO GIA'
-- ============================================================================
-- Diventano la prima riga della loro storia, con la data che avevano. Nessuno
-- e' raggiunto: lo dira' l'allenatore.

insert into player_objectives (team_id, player_id, testo, set_at, set_by)
select d.team_id, d.player_id, d.objective,
       coalesce(d.objective_set_at, d.updated_at::date), d.updated_by
  from player_development d
 where coalesce(trim(d.objective), '') <> ''
   and not exists (select 1 from player_objectives o where o.player_id = d.player_id);

-- `player_development.objective` non si usa piu': resta solo la nota privata
-- dell'allenatore. La colonna non si cancella — un dato che ha gia' viaggiato
-- non si butta con un alter table — ma da adesso non la scrive piu' nessuno.
comment on column player_development.objective is
  'Superata dalla migrazione 043: gli obiettivi stanno in player_objectives.';

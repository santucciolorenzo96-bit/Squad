-- ============================================================================
-- Team Manager Basket — migrazione 018
-- Risultati di giornata: la classifica smette di essere digitata a mano
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 017.
--
-- Fino a oggi la classifica si compilava riga per riga: giocate, vinte, perse
-- e punti di ogni squadra, aggiornati a mano dopo ogni turno. Con dieci
-- squadre e ventisei giornate è un lavoro che nessun dirigente porta a
-- termine, e infatti la classifica resta ferma alla terza settimana.
--
-- Qui si inseriscono i RISULTATI, che sono il dato che si legge sul giornale
-- o sul sito della federazione, e la classifica si calcola da sola con le
-- regole dello sport (2 punti a vittoria nel basket, 3-1-0 nel calcio,
-- 3/2/1/0 nella pallavolo, che dipende da come è finita al quinto set).
--
-- La tabella contiene TUTTE le partite del girone, compresa la nostra: senza
-- la nostra la classifica non tornerebbe. La tabella `calendar` resta quello
-- che è sempre stata — il nostro calendario — e le due si tengono allineate.
-- ============================================================================

create table league_matches (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  giornata int,
  date date,
  home_team text not null,
  away_team text not null,
  home_score int,
  away_score int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index league_matches_sector_idx on league_matches(sector_id, giornata);

-- Lo stesso accoppiamento nella stessa giornata non può comparire due volte:
-- è il modo in cui un doppio inserimento gonfierebbe la classifica in
-- silenzio. Con giornata nulla il vincolo non scatta (Postgres considera i
-- NULL distinti fra loro), ed è corretto: sono amichevoli o recuperi.
create unique index league_matches_unique
  on league_matches(sector_id, giornata, home_team, away_team);

alter table league_matches enable row level security;

create policy "league_matches_select" on league_matches for select
  using (
    team_id = current_team_id()
    and (has_sector_access(sector_id) or has_family_access(sector_id))
  );

create policy "league_matches_write_staff" on league_matches for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

-- ============================================================================
-- Il legame fra la partita giocata con lo scout e la sua riga di calendario
-- ============================================================================
-- Senza questo, una partita seguita con lo scout restava "da giocare" nel
-- calendario e il suo risultato andava riscritto a mano altrove: due verità
-- sullo stesso evento. Con il collegamento, chiudere la partita aggiorna il
-- calendario e la classifica insieme.

alter table games add column calendar_match_id uuid references calendar(id) on delete set null;
create index games_calendar_match_idx on games(calendar_match_id);

-- ============================================================================
-- Team Manager Basket — migrazione 015
-- Scheda evolutiva dell'atleta: obiettivo e nota dell'allenatore
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 014.
--
-- Presenze, valutazione media e medie statistiche si ricavano già dai dati
-- esistenti (training_attendance + games.players): non serve salvarli.
-- Quello che NON esiste da nessuna parte è la parte scritta dall'allenatore —
-- l'obiettivo su cui il ragazzo sta lavorando e la nota di accompagnamento.
-- È una riga per giocatore, sovrascritta a ogni aggiornamento: la scheda è
-- una fotografia del presente, non un diario clinico.
--
-- ATTENZIONE (scelta deliberata): questa tabella è uno strumento TECNICO
-- SPORTIVO. Non deve ospitare informazioni sanitarie, diagnosi, infortuni o
-- valutazioni mediche — quelle sono dati particolari ex art. 9 GDPR e
-- richiedono basi giuridiche e trattamenti che questa app non implementa.
-- ============================================================================

create table player_development (
  player_id uuid primary key references players(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  objective text,
  objective_set_at date,
  coach_note text,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

create index player_development_team_idx on player_development(team_id);

alter table player_development enable row level security;

-- Lettura: lo staff con accesso al settore del giocatore e le famiglie
-- collegate a quel giocatore. La scheda è pensata per essere condivisa con
-- l'atleta e chi lo segue: è il senso stesso di avere un obiettivo scritto.
create policy "player_development_select" on player_development for select
  using (
    team_id = current_team_id()
    and (has_sector_access_to_player(player_id) or has_family_access_to_player(player_id))
  );

-- Scrittura: solo chi può gestire quel giocatore (amministrazione, presidente,
-- allenatore e staff del settore). Le famiglie leggono, non scrivono.
create policy "player_development_write_staff" on player_development for all
  using (team_id = current_team_id() and can_manage_player(player_id))
  with check (team_id = current_team_id() and can_manage_player(player_id));

-- ============================================================================
-- Presenze visibili alla famiglia — SOLO del proprio giocatore
-- ============================================================================
-- La scheda evolutiva mostra la costanza agli allenamenti anche all'atleta e a
-- chi lo segue: è metà del senso della scheda. Finora training_attendance era
-- leggibile solo dallo staff, quindi la percentuale sarebbe risultata vuota.
--
-- Le policy sono in OR: questa aggiunge la lettura delle sole righe del
-- giocatore collegato al proprio account. Le presenze degli altri ragazzi
-- restano invisibili — l'assenza di un compagno non riguarda nessun'altra
-- famiglia. La scrittura resta esclusivamente dello staff.

create policy "training_attendance_select_family" on training_attendance for select
  using (has_family_access_to_player(player_id));

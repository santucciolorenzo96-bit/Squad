-- ============================================================================
-- Team Manager Basket — migrazione 021
-- Stagioni sportive: i dati smettono di sommarsi anno dopo anno
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la 020.
--
-- IL PROBLEMA
--
-- Niente veniva mai cancellato, ma niente veniva nemmeno diviso. L'unica parte
-- dell'app che sapeva cosa fosse una stagione era la finanza, con fiscal_years.
-- Ovunque altro:
--
--   - fetchHistory restituiva TUTTE le partite concluse di un settore, per
--     sempre: media punti, record, miglior marcatore continuavano a sommarsi;
--   - il filtro "Stagione" delle presenze significava "tutto lo storico";
--   - la classifica accumulava i risultati di campionati diversi;
--   - la rosa di un settore era una sola, quindi l'Under 15 che a settembre
--     diventa Under 17 non aveva modo di esistere due volte.
--
-- Falliva in silenzio: nessun errore, solo numeri che smettevano di voler dire
-- qualcosa. Questa migrazione introduce la stagione come le fiscal_years, che
-- in questo progetto hanno già dimostrato di funzionare.
--
-- LA ROSA È PER STAGIONE
--
-- player_sectors guadagna season_id: la stessa persona può stare nell'Under 15
-- quest'anno e nell'Under 17 il prossimo, e le due rose restano distinte. È
-- quello che rende possibile la chiusura di stagione con promozioni, uscite e
-- nuovi arrivi, senza riscrivere la storia di chi c'era prima.
--
-- I PLAYOFF NON SONO CAMPIONATO
--
-- Le partite guadagnano una `phase`: 'regular' o 'playoff'. La classifica si
-- calcola sulla sola stagione regolare — una serie di playoff non assegna punti
-- di classifica — mentre il tabellone dei playoff resta consultabile a parte.
-- `round_label` tiene il nome del turno: "Quarti", "Semifinale", "Finale".
-- ============================================================================

create table seasons (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,                     -- "2025/2026"
  start_date date not null,
  end_date date not null,                 -- di norma fine giugno: i playoff
                                          -- si giocano fra maggio e giugno
  closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references profiles(id),

  -- Le due scadenze che a settembre decidono se una società esiste o no.
  -- Restano nulle finché qualcuno non le imposta: il conto alla rovescia in
  -- Home compare solo da quel momento.
  enrollment_deadline date,               -- iscrizione ai campionati
  registration_deadline date,             -- tesseramento giocatori

  created_at timestamptz not null default now(),
  constraint seasons_dates check (end_date > start_date)
);

create index seasons_team_idx on seasons(team_id, start_date desc);

alter table seasons enable row level security;

create policy "seasons_select" on seasons for select
  using (team_id = current_team_id());

create policy "seasons_write_admin" on seasons for all
  using (team_id = current_team_id() and is_admin())
  with check (team_id = current_team_id() and is_admin());

-- ============================================================================
-- La stagione in corso su tutto ciò che è datato
-- ============================================================================

alter table games          add column season_id uuid references seasons(id) on delete set null;
alter table trainings      add column season_id uuid references seasons(id) on delete set null;
alter table calendar       add column season_id uuid references seasons(id) on delete set null;
alter table standings      add column season_id uuid references seasons(id) on delete set null;
alter table league_matches add column season_id uuid references seasons(id) on delete set null;
alter table player_sectors add column season_id uuid references seasons(id) on delete cascade;

create index games_season_idx          on games(season_id);
create index trainings_season_idx      on trainings(season_id);
create index calendar_season_idx       on calendar(season_id);
create index standings_season_idx      on standings(season_id);
create index league_matches_season_idx on league_matches(season_id);
create index player_sectors_season_idx on player_sectors(season_id);

-- Playoff: fase e nome del turno.
alter table calendar       add column phase text not null default 'regular'
  check (phase in ('regular', 'playoff'));
alter table calendar       add column round_label text;
alter table league_matches add column phase text not null default 'regular'
  check (phase in ('regular', 'playoff'));
alter table league_matches add column round_label text;

-- ============================================================================
-- Tutto quello che esiste oggi diventa la prima stagione
-- ============================================================================
-- Senza questo, all'apertura dell'app i dati esistenti sparirebbero dalla
-- vista: sono tutti senza stagione, e le query filtrano per stagione. La
-- stagione sportiva italiana va da luglio a giugno, quindi si ricava da oggi.

do $$
declare
  t record;
  v_season_id uuid;
  v_start date;
  v_end date;
  v_name text;
begin
  if extract(month from current_date) >= 7 then
    v_start := make_date(extract(year from current_date)::int, 7, 1);
    v_end   := make_date(extract(year from current_date)::int + 1, 6, 30);
  else
    v_start := make_date(extract(year from current_date)::int - 1, 7, 1);
    v_end   := make_date(extract(year from current_date)::int, 6, 30);
  end if;
  v_name := extract(year from v_start)::text || '/' || extract(year from v_end)::text;

  for t in select id from teams loop
    insert into seasons (team_id, name, start_date, end_date)
      values (t.id, v_name, v_start, v_end)
      returning id into v_season_id;

    update games          set season_id = v_season_id where team_id = t.id and season_id is null;
    update trainings      set season_id = v_season_id where team_id = t.id and season_id is null;
    update calendar       set season_id = v_season_id where team_id = t.id and season_id is null;
    update standings      set season_id = v_season_id where team_id = t.id and season_id is null;
    update league_matches set season_id = v_season_id where team_id = t.id and season_id is null;

    -- player_sectors non ha team_id: si passa dal settore.
    update player_sectors ps set season_id = v_season_id
      from sectors s
      where s.id = ps.sector_id and s.team_id = t.id and ps.season_id is null;
  end loop;
end $$;

-- ============================================================================
-- Chiusura di stagione
-- ============================================================================
-- Non è un semplice flag: chiudere una stagione significa deciderne un'altra e
-- portarci dentro le persone. Quante passino dall'Under 15 all'Under 17 non lo
-- sa nessuno in anticipo, quindi la funzione riceve l'elenco esplicito delle
-- assegnazioni — chi va dove — invece di dedurlo da una regola.
--
-- Le assegnazioni arrivano come array JSON: [{"player_id": "...", "sector_id": "..."}].
-- Chi non compare nell'elenco semplicemente non fa parte della nuova stagione:
-- resta in anagrafica e nello storico, non nella rosa. Nessuno viene cancellato.

create or replace function close_season_and_open(
  p_closing_season_id uuid,
  p_new_name text,
  p_new_start date,
  p_new_end date,
  p_assignments jsonb default '[]'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_new_id uuid;
  v_row jsonb;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può chiudere la stagione';
  end if;

  select team_id into v_team_id from seasons where id = p_closing_season_id;
  if v_team_id is null or v_team_id <> current_team_id() then
    raise exception 'Stagione non trovata';
  end if;
  if p_new_end <= p_new_start then
    raise exception 'La data di fine deve venire dopo quella di inizio';
  end if;

  update seasons
     set closed = true, closed_at = now(), closed_by = auth.uid()
   where id = p_closing_season_id;

  insert into seasons (team_id, name, start_date, end_date)
    values (v_team_id, p_new_name, p_new_start, p_new_end)
    returning id into v_new_id;

  -- Le rose della nuova stagione, una riga per assegnazione.
  for v_row in select * from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    insert into player_sectors (player_id, sector_id, season_id)
    select (v_row->>'player_id')::uuid, (v_row->>'sector_id')::uuid, v_new_id
    where exists (
      select 1 from sectors s
      where s.id = (v_row->>'sector_id')::uuid and s.team_id = v_team_id
    )
    on conflict do nothing;
  end loop;

  return v_new_id;
end;
$$;

-- player_sectors aveva una chiave primaria su (player_id, sector_id): con le
-- stagioni la stessa coppia si ripete legittimamente ogni anno. Diventa un
-- indice unico e non una chiave primaria, perché una chiave primaria imporrebbe
-- season_id NOT NULL e basterebbe una riga orfana — un settore rimasto senza
-- squadra — a far fallire tutta la migrazione.
alter table player_sectors drop constraint if exists player_sectors_pkey;
create unique index if not exists player_sectors_unique
  on player_sectors(player_id, sector_id, season_id);

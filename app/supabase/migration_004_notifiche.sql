-- ============================================================================
-- Team Manager Basket — migrazione 004: notifiche, allenamenti ricorrenti,
-- presenze allenamento, foto/altezza giocatore
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor del progetto Supabase, dopo le migrazioni
-- precedenti. Si applica in più sullo schema esistente.
-- ============================================================================

-- ============================================================================
-- NOTIFICHE
-- ============================================================================

create table notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  actor_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

alter table notifications enable row level security;

-- solo lettura via client: le righe vengono scritte esclusivamente dai trigger
-- (funzioni security definer), mai da un insert diretto del client.
create policy "notifications_select" on notifications for select
  using (team_id = current_team_id() and (has_sector_access(sector_id) or has_family_access(sector_id)));

alter table profiles add column notifications_seen_at timestamptz;

-- ============================================================================
-- ALLENAMENTI RICORRENTI
-- ============================================================================

create table training_recurrences (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=domenica .. 6=sabato (come JS Date.getDay())
  start_time text,
  end_time text,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table training_recurrences enable row level security;

create policy "training_recurrences_select" on training_recurrences for select
  using (team_id = current_team_id() and (has_sector_access(sector_id) or has_family_access(sector_id)));
create policy "training_recurrences_write_staff" on training_recurrences for all
  using (team_id = current_team_id() and has_sector_access(sector_id))
  with check (team_id = current_team_id() and has_sector_access(sector_id));

alter table trainings add column recurrence_id uuid references training_recurrences(id) on delete set null;

-- ============================================================================
-- PRESENZE ALLENAMENTO (solo staff: strumento interno dell'allenatore)
-- ============================================================================

create table training_attendance (
  training_id uuid not null references trainings(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null default 'present' check (status in ('present','absent','excused')),
  updated_at timestamptz not null default now(),
  primary key (training_id, player_id)
);

alter table training_attendance enable row level security;

create policy "training_attendance_select_staff" on training_attendance for select
  using (exists (
    select 1 from trainings t where t.id = training_id and has_sector_access(t.sector_id)
  ));
create policy "training_attendance_write_staff" on training_attendance for all
  using (exists (
    select 1 from trainings t where t.id = training_id and has_sector_access(t.sector_id)
  ))
  with check (exists (
    select 1 from trainings t where t.id = training_id and has_sector_access(t.sector_id)
  ));

-- ============================================================================
-- FOTO E ALTEZZA GIOCATORE
-- ============================================================================

alter table players add column height_cm int;
alter table players add column photo_path text;

insert into storage.buckets (id, name, public)
  values ('player-photos', 'player-photos', false)
  on conflict (id) do nothing;

create policy "player_photos_storage_rw" on storage.objects for all
  using (
    bucket_id = 'player-photos'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  )
  with check (
    bucket_id = 'player-photos'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );

-- ============================================================================
-- TRIGGER: notifiche allenamenti
-- (creato/annullato sempre; orario/luogo cambiato solo se davvero cambiati;
--  gli allenamenti generati automaticamente da un programma ricorrente non
--  generano "nuovo allenamento" ad ogni estensione della finestra futura)
-- ============================================================================

create or replace function notify_training_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_title text;
  v_body text;
  v_type text;
  v_day text;
begin
  if tg_op = 'INSERT' then
    if new.recurrence_id is not null then
      return new;
    end if;
    v_type := 'training_created';
    v_title := 'Nuovo allenamento';
    v_day := to_char(new.date, 'DD/MM');
    v_body := coalesce(new.title, 'Allenamento') || ' · ' || v_day
      || case when new.start_time is not null then ' ore ' || new.start_time else '' end
      || case when new.location is not null then ' · ' || new.location else '' end;
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (new.team_id, new.sector_id, v_type, v_title, v_body, auth.uid());
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_type := 'training_cancelled';
    v_title := 'Allenamento annullato';
    v_body := coalesce(old.title, 'Allenamento') || ' · ' || to_char(old.date, 'DD/MM')
      || case when old.start_time is not null then ' ore ' || old.start_time else '' end
      || case when old.location is not null then ' · ' || old.location else '' end;
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (old.team_id, old.sector_id, v_type, v_title, v_body, auth.uid());
    return old;
  end if;

  -- UPDATE: notifica solo se data, orario o luogo sono davvero cambiati
  if new.date is distinct from old.date
     or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time
     or new.location is distinct from old.location then
    v_type := 'training_changed';
    v_title := 'Allenamento aggiornato';
    v_body := coalesce(new.title, 'Allenamento') || ' · nuovo orario/luogo: ' || to_char(new.date, 'DD/MM')
      || case when new.start_time is not null then ' ore ' || new.start_time else '' end
      || case when new.location is not null then ' · ' || new.location else '' end;
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (new.team_id, new.sector_id, v_type, v_title, v_body, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_notify_training
after insert or update or delete on trainings
for each row execute function notify_training_change();

-- ============================================================================
-- TRIGGER: notifiche prossima partita (next_match)
-- ============================================================================

create or replace function notify_next_match_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_body text;
begin
  if tg_op = 'DELETE' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (old.team_id, old.sector_id, 'next_match_changed', 'Prossima partita aggiornata', 'La prossima partita è stata rimossa', auth.uid());
    return old;
  end if;

  v_body := 'vs ' || new.opponent
    || case when new.date is not null and new.date <> '' then ' · ' || new.date else '' end
    || case when new.time is not null and new.time <> '' then ' ore ' || new.time else '' end
    || case when new.location is not null and new.location <> '' then ' · ' || new.location else '' end;
  insert into notifications (team_id, sector_id, type, title, body, actor_id)
    values (new.team_id, new.sector_id, 'next_match_changed', 'Prossima partita aggiornata', v_body, auth.uid());
  return new;
end;
$$;

create trigger trg_notify_next_match
after insert or update or delete on next_match
for each row execute function notify_next_match_change();

-- ============================================================================
-- TRIGGER: notifiche programma allenamenti ricorrente (una sola notifica per
-- modifica alla regola, non una per ogni occorrenza generata)
-- ============================================================================

create or replace function notify_training_recurrence_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_days text[] := array['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
  v_body text;
begin
  if tg_op = 'DELETE' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (old.team_id, old.sector_id, 'training_recurrence_changed', 'Programma allenamenti aggiornato',
        'Rimosso: ' || v_days[old.weekday + 1] || coalesce(' ore ' || old.start_time, ''), auth.uid());
    return old;
  end if;

  v_body := initcap(v_days[new.weekday + 1])
    || case when new.start_time is not null then ' ore ' || new.start_time else '' end
    || case when new.end_time is not null then '-' || new.end_time else '' end
    || case when new.location is not null then ' · ' || new.location else '' end;

  if tg_op = 'INSERT' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (new.team_id, new.sector_id, 'training_recurrence_changed', 'Nuovo programma allenamenti', v_body, auth.uid());
  elsif new.weekday is distinct from old.weekday or new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time or new.location is distinct from old.location
     or new.active is distinct from old.active then
    insert into notifications (team_id, sector_id, type, title, body, actor_id)
      values (new.team_id, new.sector_id, 'training_recurrence_changed', 'Programma allenamenti aggiornato', v_body, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_notify_training_recurrence
after insert or update or delete on training_recurrences
for each row execute function notify_training_recurrence_change();

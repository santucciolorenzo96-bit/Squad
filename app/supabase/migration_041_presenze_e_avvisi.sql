-- ============================================================================
-- SQUAD — migrazione 041
-- Presente o assente, e chi avvisa prima
-- ============================================================================
--
-- DUE STATI, NON TRE
--
-- «Giustificato» sembrava un'informazione e invece era una discussione: chi
-- decide se un'assenza e' giustificata? Il certificato? La parola del
-- genitore? Il fatto che abbia avvisato? Tre allenatori davano tre risposte
-- diverse, e la percentuale di presenza non voleva piu' dire niente.
--
-- Il foglio presenze risponde a una domanda sola: c'era o non c'era. Se era
-- giustificato lo sa l'allenatore, che era li' e conosce la situazione — e non
-- e' un dato da mettere in colonna.
--
-- I giustificati che esistono gia' diventano assenti: e' quello che erano.
--
-- CHI AVVISA PRIMA
--
-- La presenza la constata chi sta in palestra, sempre. Ma il genitore che alle
-- sette di mattina sa che il figlio ha la febbre oggi non ha nessun posto dove
-- dirlo: lo scrive su WhatsApp, e l'allenatore lo ricopia la sera.
--
-- L'avviso e' una cosa diversa dalla presenza, quindi sta in una tabella sua.
-- Non segna niente sul foglio: dice all'allenatore, PRIMA, che stasera sono in
-- nove — che e' l'informazione con cui decide cosa far fare. Poi il foglio lo
-- compila lui come sempre, e se il ragazzo si presenta lo stesso, e' presente.

-- ============================================================================
-- 1. PRESENTE O ASSENTE
-- ============================================================================

alter table training_attendance drop constraint if exists training_attendance_status_check;

update training_attendance set status = 'absent' where status = 'excused';

alter table training_attendance
  add constraint training_attendance_status_check check (status in ('present', 'absent'));


-- ============================================================================
-- 2. L'AVVISO DI ASSENZA
-- ============================================================================

create table if not exists training_absence_notices (
  training_id uuid not null references trainings(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  note text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  primary key (training_id, player_id)
);

create index if not exists training_absence_notices_training_idx
  on training_absence_notices(training_id);

alter table training_absence_notices enable row level security;

-- Lo staff della categoria lo legge: e' per lui che esiste.
drop policy if exists "absence_notices_select_staff" on training_absence_notices;
create policy "absence_notices_select_staff" on training_absence_notices for select
  using (exists (
    select 1 from trainings t where t.id = training_id and has_sector_access(t.sector_id)
  ));

-- La famiglia legge i propri: deve poter vedere di aver avvisato, altrimenti
-- avvisa due volte.
drop policy if exists "absence_notices_select_family" on training_absence_notices;
create policy "absence_notices_select_family" on training_absence_notices for select
  using (has_family_access_to_player(player_id));

-- E li scrive, ma solo per il proprio atleta e solo in avanti: un avviso su un
-- allenamento gia' passato non serve a nessuno e riscriverebbe la storia.
--
-- «current_date - 1» e non «current_date»: la data del server e' in UTC, e per
-- qualche ora dopo la mezzanotte italiana un allenamento di oggi risulterebbe
-- gia' di ieri. Un giorno di margine costa niente e non fa perdere la sera.
drop policy if exists "absence_notices_write_family" on training_absence_notices;
create policy "absence_notices_write_family" on training_absence_notices for all
  using (
    has_family_access_to_player(player_id)
    and created_by = auth.uid()
    and exists (select 1 from trainings t where t.id = training_id and t.date >= current_date - 1)
  )
  with check (
    has_family_access_to_player(player_id)
    and created_by = auth.uid()
    and exists (select 1 from trainings t where t.id = training_id and t.date >= current_date - 1)
  );


-- ============================================================================
-- 3. L'ALLENATORE LO DEVE SAPERE ADESSO
-- ============================================================================
-- Un avviso che arriva e resta in una tabella non ha avvisato nessuno.

create or replace function notify_absence_announced() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
  v_sector uuid;
  v_date date;
  v_titolo text;
  v_player text;
begin
  select t.team_id, t.sector_id, t.date, t.title
    into v_team, v_sector, v_date, v_titolo
    from trainings t where t.id = new.training_id;
  if v_sector is null then return new; end if;

  select name into v_player from players where id = new.player_id;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (
      v_team, v_sector, 'absence_announced',
      coalesce(v_player, 'Un atleta') || ' non viene',
      coalesce(v_titolo, 'Allenamento') || ' di ' || squad_giorno_it(v_date)
        || case when coalesce(trim(new.note), '') <> '' then ' — ' || trim(new.note) else '' end,
      auth.uid(), 'allenamenti'
    );
  return new;
end;
$$;

drop trigger if exists trg_absence_announced on training_absence_notices;
create trigger trg_absence_announced
  after insert on training_absence_notices
  for each row execute function notify_absence_announced();

-- ============================================================================
-- SQUAD — migrazione 050
-- La scheda di allenamento: la carica il tecnico, la porta in palestra l'atleta
-- ============================================================================
--
-- Chi fa anche sala pesi ha un programma scritto, e oggi quel foglio viaggia
-- su WhatsApp: si perde nella chat, lo si cerca a metà serie, e a dicembre
-- nessuno sa più quale fosse quello buono. Sta nella scheda evolutiva, accanto
-- all'obiettivo, perché è la stessa cosa detta in modo operativo: l'obiettivo
-- dice dove si va, la scheda dice come.
--
-- PERCHÉ NON È UN DOCUMENTO
--
-- I documenti (player_documents) hanno uno stato, una scadenza e
-- un'approvazione: esistono per rispondere a «questo ragazzo può giocare?».
-- Una scheda di allenamento non si approva e non scade — si sostituisce. Se
-- entrasse lì dentro comparirebbe in Anagrafica come una colonna da tenere in
-- regola, e in Situazione fra le cose che mancano. Non è quello.
--
-- CHI FA COSA
--
-- La carica chi gestisce quel giocatore: allenatore, staff, amministrazione,
-- con accesso alla sua categoria — cioè can_manage_player(), la stessa
-- condizione della sua anagrafica. La legge e la scarica anche la famiglia:
-- è scritta PER l'atleta, e una scheda che l'atleta non può aprire non serve.

create table if not exists player_training_plans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  titolo text not null,
  nota text,
  file_path text not null,
  file_name text not null,
  mime text,
  bytes bigint,
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists player_training_plans_player_idx
  on player_training_plans(player_id, uploaded_at desc);

alter table player_training_plans enable row level security;

-- Stessa visibilità della scheda evolutiva: lo staff del settore e la famiglia
-- collegata.
drop policy if exists "training_plans_select" on player_training_plans;
create policy "training_plans_select" on player_training_plans for select
  using (
    team_id = current_team_id()
    and (has_sector_access_to_player(player_id) or has_family_access_to_player(player_id))
  );

drop policy if exists "training_plans_write_staff" on player_training_plans;
create policy "training_plans_write_staff" on player_training_plans for all
  using (team_id = current_team_id() and can_manage_player(player_id))
  with check (team_id = current_team_id() and can_manage_player(player_id));


-- ============================================================================
-- IL DEPOSITO
-- ============================================================================
-- Privato, come tutti gli altri: i file si aprono con un indirizzo firmato a
-- scadenza, non con un link che gira. Il percorso è «societa/atleta/file», ed
-- è su quello che si regge il controllo degli accessi — la seconda cartella è
-- l'atleta, e da lì le regole sanno di chi è la scheda.

insert into storage.buckets (id, name, public)
  values ('training-plans', 'training-plans', false)
  on conflict (id) do nothing;

drop policy if exists "training_plans_storage_read" on storage.objects;
create policy "training_plans_storage_read" on storage.objects for select
  using (
    bucket_id = 'training-plans'
    and (
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );

drop policy if exists "training_plans_storage_write" on storage.objects;
create policy "training_plans_storage_write" on storage.objects for insert
  with check (
    bucket_id = 'training-plans'
    and can_manage_player(((storage.foldername(name))[2])::uuid)
  );

drop policy if exists "training_plans_storage_delete" on storage.objects;
create policy "training_plans_storage_delete" on storage.objects for delete
  using (
    bucket_id = 'training-plans'
    and can_manage_player(((storage.foldername(name))[2])::uuid)
  );


-- ============================================================================
-- L'ATLETA LO DEVE SAPERE
-- ============================================================================
-- Una scheda caricata e non annunciata resta un file in un'app: quello che
-- conta è che il ragazzo sappia che c'è una scheda nuova, e che sia quella
-- nuova a valere.

create or replace function notify_scheda_allenamento() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
  v_nome text;
begin
  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.player_id limit 1;
  if v_sector is null then return new; end if;

  select name into v_nome from players where id = new.player_id;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, v_sector, 'scheda_allenamento',
            'Scheda di allenamento per ' || coalesce(v_nome, 'un atleta'),
            new.titolo, auth.uid(), 'anagrafica');
  return new;
end;
$$;

drop trigger if exists trg_scheda_allenamento on player_training_plans;
create trigger trg_scheda_allenamento
  after insert on player_training_plans
  for each row execute function notify_scheda_allenamento();

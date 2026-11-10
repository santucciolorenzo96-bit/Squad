-- ============================================================================
-- 065 · SCHEMI DI GIOCO
-- ============================================================================
--
-- Una sezione dove l'allenatore disegna gli schemi — posizioni 1-5, movimenti,
-- tempi, varianti — e gli atleti li rivedono come animazione.
--
-- LO SCHEMA E' UN DOCUMENTO. Posizioni, passi e varianti stanno in `data`, un
-- jsonb che l'app valida a ogni lettura (utils/schemi.js, `normalizzaSchema`):
-- non ha senso spezzarlo in tabelle, perche' non si interroga mai per pezzi e si
-- legge e scrive sempre intero. Etichette e titolo, che servono per filtrare e
-- per elencare, sono colonne vere.
--
-- BOZZA E PUBBLICATO. Una bozza la vede solo chi la puo' modificare: l'allenatore
-- lavora senza che gli atleti vedano uno schema a meta'. Pubblicato, lo vede chi
-- appartiene alla categoria — staff, e atleti e genitori collegati a una scheda
-- di quella categoria.
--
-- CHI MODIFICA: admin, presidente e allenatore della categoria. Come la Rosa:
-- comporre il gioco e' una scelta tecnica, e lo staff non la tocca.
--
-- LA NOTIFICA e' esplicita. Un trigger che avvisasse a ogni salvataggio manderebbe
-- cinque avvisi per uno schema ritoccato cinque volte. Chi salva decide se
-- avvisare: scrive `notify_at`, e il trigger notifica solo quando quel valore
-- cambia su uno schema pubblicato.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. La tabella
-- ----------------------------------------------------------------------------
create table if not exists plays (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 80),
  labels text[] not null default '{}',
  note text check (note is null or char_length(note) <= 600),
  -- Un tetto alla dimensione: uno schema di trenta passi con otto varianti sta
  -- in una ventina di KB, e oltre i duecento qualcuno sta scrivendo altro.
  data jsonb not null check (octet_length(data::text) <= 200000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  published_at timestamptz,
  notify_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  updated_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plays_sector_idx on plays (sector_id, status, updated_at desc);


-- ----------------------------------------------------------------------------
-- 2. Chi puo' modificare
-- ----------------------------------------------------------------------------
-- Una funzione e non una condizione ripetuta in quattro policy: la regola e'
-- una, e se cambia deve cambiare in un posto. SECURITY DEFINER perche' legge
-- profili e categorie, e una policy che leggesse tabelle con le proprie policy
-- rischierebbe la ricorsione.
create or replace function can_edit_plays(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente', 'allenatore') and has_sector_access(p_sector_id)
$$;

grant execute on function can_edit_plays(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 3. Permessi
-- ----------------------------------------------------------------------------
alter table plays enable row level security;

-- Si legge: tutto quello che si puo' modificare (bozze comprese), e lo
-- pubblicato della propria categoria. Chi scrive e' sempre fra chi legge:
-- aggiungere `.select()` a una scrittura richiede di poter leggere la riga.
drop policy if exists "plays_select" on plays;
create policy "plays_select" on plays for select
  using (
    team_id = current_team_id()
    and (
      can_edit_plays(sector_id)
      or (status = 'published' and (has_sector_access(sector_id) or has_family_access(sector_id)))
    )
  );

drop policy if exists "plays_insert" on plays;
create policy "plays_insert" on plays for insert
  with check (team_id = current_team_id() and can_edit_plays(sector_id));

drop policy if exists "plays_update" on plays;
create policy "plays_update" on plays for update
  using (team_id = current_team_id() and can_edit_plays(sector_id))
  with check (team_id = current_team_id() and can_edit_plays(sector_id));

drop policy if exists "plays_delete" on plays;
create policy "plays_delete" on plays for delete
  using (team_id = current_team_id() and can_edit_plays(sector_id));


-- ----------------------------------------------------------------------------
-- 4. Chi ha scritto, e quando
-- ----------------------------------------------------------------------------
-- Si scrive dal server e non dal client: un client puo' dire qualunque cosa.
create or replace function plays_stamp() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
    new.created_at := now();
  else
    -- Sul serio immutabili: categoria e societa' non si spostano con un update.
    new.team_id := old.team_id;
    new.sector_id := old.sector_id;
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  -- La data di pubblicazione e' la prima, e si azzera se lo schema torna in bozza.
  if new.status = 'published' then
    new.published_at := coalesce(case when tg_op = 'UPDATE' then old.published_at end, now());
  else
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_plays_stamp on plays;
create trigger trg_plays_stamp before insert or update on plays
  for each row execute function plays_stamp();


-- ----------------------------------------------------------------------------
-- 5. La notifica
-- ----------------------------------------------------------------------------
-- Una riga di avviso per la categoria, come per gli allenamenti e le
-- comunicazioni: la campanella la porta a chi ha accesso alla categoria e un
-- tocco apre la sezione Schemi.
--
-- «Nuovo schema» se prima non era pubblicato, «Schema aggiornato» altrimenti.
create or replace function notify_play_published() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_nuovo boolean;
begin
  if new.status <> 'published' or new.notify_at is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_nuovo := true;
  else
    -- Notifica solo se chi ha salvato l'ha chiesto: `notify_at` e' cambiato.
    if new.notify_at is not distinct from old.notify_at then
      return new;
    end if;
    v_nuovo := old.status <> 'published';
  end if;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
  values (
    new.team_id, new.sector_id,
    case when v_nuovo then 'play_published' else 'play_updated' end,
    new.title,
    case when v_nuovo then 'Nuovo schema da rivedere' else 'Lo schema è stato aggiornato' end,
    auth.uid(), 'schemi'
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_play_published on plays;
create trigger trg_notify_play_published after insert or update on plays
  for each row execute function notify_play_published();


-- ============================================================================
-- CONTROLLO
-- ============================================================================
-- Una riga sola, sempre.
select
  (select count(*) from information_schema.tables where table_name = 'plays') = 1 as tabella,
  (select count(*) from pg_policies where tablename = 'plays') = 4 as quattro_policy,
  (select count(*) from pg_proc where proname = 'can_edit_plays') = 1 as funzione_permesso,
  (select count(*) from pg_trigger where tgname in ('trg_plays_stamp', 'trg_notify_play_published')) = 2 as due_trigger;

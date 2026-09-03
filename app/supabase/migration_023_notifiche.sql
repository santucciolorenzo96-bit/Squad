-- ============================================================================
-- Team Manager Basket — migrazione 023
-- Notifiche: destinatario, stato di lettura, ciclo dei documenti
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la 022.
--
-- COSA NON ANDAVA
--
-- 1. Coperture. Si notificavano quattro eventi — allenamenti, prossima
--    partita, ricorrenze, comunicazioni — e restava fuori proprio il ciclo che
--    alle famiglie interessa di più: un genitore carica il certificato medico
--    e non scopre mai se è stato approvato o respinto. Lo staff, dal canto
--    suo, non sa che ne è arrivato uno da verificare.
--
-- 2. Nessun destinatario. Ogni notifica andava all'intero settore. "Il
--    certificato di tuo figlio è stato approvato" non è un avviso di settore:
--    è per una persona sola, e mandarlo a tutti è insieme rumore e una
--    piccola fuga di informazioni.
--
-- 3. Stato di lettura unico. `notifications_seen_at` è un solo istante: aperta
--    la campanella, tutto risultava letto. Nessun modo di lasciarne una da
--    parte e ritrovarla.
--
-- 4. Non si poteva andare da nessuna parte. Nessun collegamento alla cosa di
--    cui parlavano.
--
-- 5. Crescita senza fine. Nessuno le cancellava.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Destinatario e destinazione
-- ----------------------------------------------------------------------------
-- profile_id nullo = avviso di settore, come prima. Valorizzato = riguarda
-- una persona sola e nessun altro deve vederlo.
alter table notifications add column profile_id uuid references profiles(id) on delete cascade;

-- La scheda dell'app da aprire toccando la notifica.
alter table notifications add column link_tab text;

create index notifications_profile_idx on notifications(profile_id, created_at desc);
create index notifications_team_created_idx on notifications(team_id, created_at desc);

-- Una notifica personale la vede solo il suo destinatario.
drop policy if exists "notifications_select" on notifications;
create policy "notifications_select" on notifications for select
  using (
    team_id = current_team_id()
    and (
      profile_id = auth.uid()
      or (profile_id is null and (has_sector_access(sector_id) or has_family_access(sector_id)))
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Stato di lettura per persona
-- ----------------------------------------------------------------------------
-- Una riga per (notifica, persona): è l'unico modo perché "non letta" voglia
-- dire qualcosa quando la stessa notifica di settore arriva a dieci persone.
create table notification_reads (
  notification_id uuid not null references notifications(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, profile_id)
);

alter table notification_reads enable row level security;

create policy "notification_reads_own" on notification_reads for all
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- Segna come lette: una, alcune, o tutte quelle che l'utente può vedere.
create or replace function mark_notifications_read(p_ids uuid[] default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  insert into notification_reads (notification_id, profile_id)
  select n.id, auth.uid()
    from notifications n
   where n.team_id = current_team_id()
     and (p_ids is null or n.id = any(p_ids))
     and (n.profile_id = auth.uid()
          or (n.profile_id is null and (has_sector_access(n.sector_id) or has_family_access(n.sector_id))))
  on conflict do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Il ciclo dei documenti
-- ----------------------------------------------------------------------------

-- Caricato: lo staff del settore deve sapere che c'è da verificare.
create or replace function notify_document_uploaded() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
  v_player text;
  v_what text;
begin
  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.player_id limit 1;
  if v_sector is null then return new; end if;

  select name into v_player from players where id = new.player_id;
  v_what := case new.doc_type
    when 'certificato_medico' then 'Certificato medico'
    when 'tesseramento_fip' then 'Tesseramento'
    else 'Documento' end;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, v_sector, 'document_uploaded', 'Documento da verificare',
            v_what || ' di ' || coalesce(v_player, 'un atleta'), auth.uid(), 'anagrafica');
  return new;
end;
$$;

create trigger trg_notify_document_uploaded
after insert on player_documents
for each row execute function notify_document_uploaded();

-- Verificato: è la notifica che mancava. Va a chi segue quel giocatore, uno
-- per uno, e a nessun altro — l'esito di un documento sanitario non è un
-- avviso di settore.
create or replace function notify_document_reviewed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
  v_player text;
  v_what text;
  v_title text;
  v_body text;
  r record;
begin
  if new.status = old.status then return new; end if;
  if new.status not in ('approved', 'rejected') then return new; end if;

  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.player_id limit 1;
  select name into v_player from players where id = new.player_id;

  v_what := case new.doc_type
    when 'certificato_medico' then 'Il certificato medico'
    when 'tesseramento_fip' then 'Il tesseramento'
    else 'Il documento' end;

  if new.status = 'approved' then
    v_title := 'Documento approvato';
    v_body := v_what || ' di ' || coalesce(v_player, 'tuo figlio') || ' è stato approvato'
      || coalesce(' · valido fino al ' || to_char(new.expires_at, 'DD/MM/YYYY'), '') || '.';
  else
    v_title := 'Documento da rifare';
    v_body := v_what || ' di ' || coalesce(v_player, 'tuo figlio') || ' non è stato accettato'
      || coalesce(': ' || new.review_note, '') || '. Va caricato di nuovo.';
  end if;

  for r in select profile_id from profile_players where player_id = new.player_id loop
    insert into notifications (team_id, sector_id, type, title, body, actor_id, profile_id, link_tab)
      values (new.team_id, v_sector, 'document_reviewed', v_title, v_body, auth.uid(), r.profile_id, 'anagrafica');
  end loop;
  return new;
end;
$$;

create trigger trg_notify_document_reviewed
after update on player_documents
for each row execute function notify_document_reviewed();

-- ----------------------------------------------------------------------------
-- 4. Meno rumore sulla prossima partita
-- ----------------------------------------------------------------------------
-- Notificava a ogni salvataggio, anche quando non era cambiato niente: aprire
-- e richiudere la modale produceva un avviso a tutto il settore. Ora si
-- comporta come il trigger degli allenamenti, che questo controllo lo faceva
-- già.
create or replace function notify_next_match_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_body text;
begin
  if tg_op = 'DELETE' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (old.team_id, old.sector_id, 'next_match_changed', 'Prossima partita aggiornata',
              'La prossima partita è stata rimossa', auth.uid(), 'home');
    return old;
  end if;

  if tg_op = 'UPDATE'
     and new.opponent is not distinct from old.opponent
     and new.date is not distinct from old.date
     and new.time is not distinct from old.time
     and new.location is not distinct from old.location
     and new.home is not distinct from old.home then
    return new;
  end if;

  v_body := 'vs ' || new.opponent
    || case when new.date is not null and new.date <> '' then ' · ' || new.date else '' end
    || case when new.time is not null and new.time <> '' then ' ore ' || new.time else '' end
    || case when new.location is not null and new.location <> '' then ' · ' || new.location else '' end;
  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, new.sector_id, 'next_match_changed', 'Prossima partita aggiornata', v_body, auth.uid(), 'home');
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Destinazione per le notifiche già esistenti
-- ----------------------------------------------------------------------------
update notifications set link_tab = case
  when type like 'training%' then 'allenamenti'
  when type = 'next_match_changed' then 'home'
  when type = 'comunicazione' then 'comunicazioni'
  else null end
where link_tab is null;

-- E per quelle che verranno: si aggiunge la destinazione anche ai trigger
-- degli allenamenti e delle comunicazioni, senza riscriverli per intero.
create or replace function notify_new_communication() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
  values (
    new.team_id, new.sector_id, 'comunicazione',
    new.title,
    case when new.requires_response
         then 'Richiede conferma' || coalesce(' entro il ' || to_char(new.respond_by, 'DD/MM/YYYY'), '')
         else coalesce(new.body, '') end,
    new.created_by, 'comunicazioni'
  );
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Potatura
-- ----------------------------------------------------------------------------
-- Nessuno le cancellava mai. Novanta giorni è oltre qualunque utilità: una
-- notifica di un allenamento di tre mesi fa non serve a nessuno, e le
-- righe di lettura spariscono per cascata.
create or replace function prune_notifications(p_days int default 90)
returns int language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può ripulire le notifiche';
  end if;
  delete from notifications
   where team_id = current_team_id()
     and created_at < now() - make_interval(days => greatest(p_days, 7));
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

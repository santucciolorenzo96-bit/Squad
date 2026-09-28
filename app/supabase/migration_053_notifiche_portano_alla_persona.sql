-- ============================================================================
-- SQUAD — migrazione 053
-- Una notifica che parla di una persona deve portare a quella persona
-- ============================================================================
--
-- «Mario ha inserito la data di nascita» — si tocca, e non succede niente.
--
-- Qualcosa succedeva: il tocco portava in Anagrafica. Ma in Anagrafica della
-- CATEGORIA APERTA IN QUEL MOMENTO, e con l'elenco di tutti. Se Mario è in
-- un'altra categoria si arriva dove lui non c'è; se è in questa, si arriva a
-- un elenco di tredici nomi e bisogna cercarlo. In tutti e due i casi, da
-- fuori, sembra che il tocco non abbia fatto niente.
--
-- Mancava il pezzo che conta: la notifica sa di CHI parla, ma non lo diceva a
-- nessuno. Il titolo lo scrive — «Certificato medico di Mario Rossi» — e poi
-- quel nome resta una stringa, non un collegamento.
--
-- Da qui in poi le notifiche che riguardano un atleta si portano dietro il suo
-- id, e toccarle apre la sua scheda. La categoria la cambia l'app da sola,
-- perché la notifica porta già anche quella.
--
-- Le notifiche vecchie non hanno il collegamento e continuano a comportarsi
-- come prima: portano alla sezione. Riempirle a posteriori vorrebbe dire
-- indovinare la persona dal titolo, ed è proprio il genere di deduzione che
-- sbaglia sui nomi uguali.

alter table notifications
  add column if not exists link_player_id uuid references players(id) on delete set null;


-- ============================================================================
-- I SEI TRIGGER CHE PARLANO DI UNA PERSONA
-- ============================================================================
-- Gli altri — allenamenti, prossima partita, comunicazioni — non riguardano un
-- atleta solo, e restano com'erano.

-- ---------------------------------------------------------------- documenti
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

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab, link_player_id)
    values (new.team_id, v_sector, 'document_uploaded',
            v_what || ' di ' || coalesce(v_player, 'un atleta'),
            'Caricato, in attesa di verifica', auth.uid(), 'anagrafica', new.player_id);
  return new;
end;
$$;

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
    when 'certificato_medico' then 'Certificato medico'
    when 'tesseramento_fip' then 'Tesseramento'
    else 'Documento' end;

  v_title := v_what || ' di ' || coalesce(v_player, 'tuo figlio');

  if new.status = 'approved' then
    v_body := 'Approvato'
      || coalesce(' · valido fino al ' || to_char(new.expires_at, 'DD/MM/YYYY'), '');
  else
    v_body := 'Non accettato' || coalesce(': ' || new.review_note, '') || '. Va caricato di nuovo.';
  end if;

  for r in select profile_id from profile_players where player_id = new.player_id loop
    insert into notifications (team_id, sector_id, type, title, body, actor_id, profile_id, link_tab, link_player_id)
      values (new.team_id, v_sector, 'document_reviewed', v_title, v_body,
              auth.uid(), r.profile_id, 'anagrafica', new.player_id);
  end loop;
  return new;
end;
$$;

-- ----------------------------------------------------------------- la foto
create or replace function notify_photo_proposed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
begin
  if new.photo_pending_path is null
     or new.photo_pending_path is not distinct from old.photo_pending_path then
    return new;
  end if;

  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.id limit 1;
  if v_sector is null then return new; end if;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab, link_player_id)
    values (new.team_id, v_sector, 'photo_proposed',
            'Fotografia di ' || coalesce(new.name, 'un atleta'),
            'Proposta dalla famiglia, in attesa di pubblicazione', auth.uid(), 'anagrafica', new.id);
  return new;
end;
$$;

-- --------------------------------------------------- i dati del tesseramento
create or replace function notify_dati_sensibili() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
  v_cosa text;
  v_da text;
  v_a text;
begin
  if new.birth_date is distinct from old.birth_date then
    v_cosa := 'Data di nascita';
    v_da := coalesce(to_char(old.birth_date, 'DD/MM/YYYY'), 'vuota');
    v_a := coalesce(to_char(new.birth_date, 'DD/MM/YYYY'), 'vuota');
  elsif coalesce(nullif(trim(new.fiscal_code), ''), '')
        is distinct from coalesce(nullif(trim(old.fiscal_code), ''), '') then
    v_cosa := 'Codice fiscale';
    v_da := coalesce(nullif(trim(old.fiscal_code), ''), 'vuoto');
    v_a := coalesce(nullif(trim(new.fiscal_code), ''), 'vuoto');
  else
    return new;
  end if;

  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.id limit 1;
  if v_sector is null then return new; end if;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab, link_player_id)
    values (new.team_id, v_sector, 'dato_sensibile',
            v_cosa || ' di ' || coalesce(new.name, 'un atleta'),
            'Da ' || v_da || ' a ' || v_a
              || case when is_team_manager() then '' else ', modificata dalla famiglia' end,
            auth.uid(), 'anagrafica', new.id);
  return new;
end;
$$;

-- ------------------------------------------------- la scheda di allenamento
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

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab, link_player_id)
    values (new.team_id, v_sector, 'scheda_allenamento',
            'Scheda di allenamento per ' || coalesce(v_nome, 'un atleta'),
            new.titolo, auth.uid(), 'anagrafica', new.player_id);
  return new;
end;
$$;

-- ------------------------------------------------------ l'assenza annunciata
-- Questa porta agli allenamenti e non all'anagrafica — la domanda è «chi non
-- viene stasera», non «com'è messo Mario» — ma il collegamento alla persona
-- serve lo stesso: da lì si arriva alla sua scheda quando si vuole capire se
-- è la terza volta in un mese.
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

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab, link_player_id)
    values (
      v_team, v_sector, 'absence_announced',
      coalesce(v_player, 'Un atleta') || ' non viene',
      coalesce(v_titolo, 'Allenamento') || ' di ' || squad_giorno_it(v_date)
        || case when coalesce(trim(new.note), '') <> '' then ' — ' || trim(new.note) else '' end,
      auth.uid(), 'allenamenti', new.player_id
    );
  return new;
end;
$$;

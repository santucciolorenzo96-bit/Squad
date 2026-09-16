-- ============================================================================
-- SQUAD — migrazione 034
-- 1) Recupera le righe rimaste senza stagione (gli allenamenti «mai salvati»)
-- 2) Rende le notifiche specifiche: cosa è cambiato, non «qualcosa è cambiato»
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor di Supabase, dopo la 033.
-- È idempotente: rieseguirla non fa danni.
--
-- ============================================================================
-- PARTE 1 — LE RIGHE SENZA STAGIONE
-- ============================================================================
--
-- IL GUASTO
--
-- Dalla migrazione 021 ogni cosa datata appartiene a una stagione, e ogni
-- lettura filtra per stagione. Giusto: senza, i numeri di anni diversi si
-- sommerebbero. Ma la stagione la doveva ricordare ogni singolo punto in cui
-- l'applicazione scrive, passandola come ultimo argomento — e alcuni si sono
-- dimenticati di farlo.
--
-- Dimenticarla non dava nessun errore. La riga si salvava con season_id vuoto
-- e da quel momento non la trovava più nessuna lettura, perché tutte chiedono
-- una stagione e quella riga non ne ha nessuna.
--
-- Dal di fuori: un allenamento inserito, un messaggio di conferma, e niente
-- nell'elenco. Inserito di nuovo, stessa cosa. Sembrava un problema di
-- salvataggio, ed era un problema di lettura.
--
-- Il lato applicativo è già stato chiuso (src/api/stagione.js: la stagione ha
-- un valore predefinito, e una scrittura non può più dimenticarla). Qui si
-- recuperano le righe che nel frattempo sono rimaste orfane — perché ci sono,
-- sono valide, e l'unica cosa che manca loro è l'etichetta dell'anno.
--
-- COME SI SCEGLIE LA STAGIONE
--
-- Per prima cosa la stagione che CONTIENE la data della riga: è la risposta
-- giusta, non un'approssimazione. Solo se nessuna la contiene — una riga
-- datata fuori da ogni stagione dichiarata, o senza data — si ripiega sulla
-- stagione in corso, che è la stessa scelta che fa l'applicazione.

create or replace function _squad_034_stagione_per(p_team uuid, p_data date)
returns uuid language sql stable as $$
  select coalesce(
    (select s.id from seasons s
      where s.team_id = p_team and p_data is not null
        and p_data between s.start_date and s.end_date
      order by s.start_date desc limit 1),
    (select s.id from seasons s
      where s.team_id = p_team
      order by s.closed asc, s.start_date desc limit 1)
  );
$$;

update trainings t
   set season_id = _squad_034_stagione_per(t.team_id, t.date)
 where t.season_id is null;

update games g
   set season_id = _squad_034_stagione_per(g.team_id, coalesce(g.ended_at, g.started_at)::date)
 where g.season_id is null;

-- Una partita di calendario senza data esiste (l'avversario si sa prima del
-- calendario ufficiale): la funzione ci ripiega da sola sulla stagione in corso.
update calendar c
   set season_id = _squad_034_stagione_per(c.team_id, c.date)
 where c.season_id is null;

update standings st
   set season_id = _squad_034_stagione_per(st.team_id, null)
 where st.season_id is null;

update league_matches lm
   set season_id = _squad_034_stagione_per(lm.team_id, lm.date)
 where lm.season_id is null;

update player_sectors ps
   set season_id = _squad_034_stagione_per(s.team_id, null)
  from sectors s
 where s.id = ps.sector_id and ps.season_id is null;

drop function _squad_034_stagione_per(uuid, date);

-- ============================================================================
-- PARTE 2 — NOTIFICHE CHE DICONO QUALCOSA
-- ============================================================================
--
-- I titoli erano categorie, non notizie: «Allenamento aggiornato» vale per
-- qualunque modifica di qualunque allenamento, e per sapere quale bisognava
-- aprire e leggere il testo sotto. Con dieci righe così l'elenco si legge
-- tutto o non si legge affatto.
--
-- Adesso il titolo è LA COSA di cui si parla — il nome dell'allenamento,
-- l'avversario, l'atleta — e il corpo dice ESATTAMENTE cosa è cambiato, con
-- il valore di prima e quello di adesso. Il tipo della notifica basta
-- all'applicazione per scrivere sopra «Allenamento spostato» e per metterci
-- accanto l'icona della sezione da cui viene.

-- I giorni in italiano: to_char li darebbe in inglese, perché dipende dalla
-- lingua del server e quella non si tocca per una notifica.
create or replace function squad_giorno_it(d date)
returns text language sql immutable as $$
  select case extract(dow from d)::int
    when 0 then 'dom' when 1 then 'lun' when 2 then 'mar' when 3 then 'mer'
    when 4 then 'gio' when 5 then 'ven' else 'sab' end
    || ' ' || to_char(d, 'DD/MM');
$$;

-- Un orario leggibile: «19:00–20:30», o solo l'inizio, o niente.
create or replace function squad_orario_it(a text, b text)
returns text language sql immutable as $$
  select case
    when a is null or a = '' then null
    when b is null or b = '' then a
    else a || '–' || b end;
$$;

create or replace function notify_training_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_body text;
  v_cambi text[] := '{}';
begin
  if tg_op = 'INSERT' then
    -- Le occorrenze generate da un programma fisso non si annunciano una per
    -- una: sarebbero otto notifiche identiche ogni volta che la finestra si
    -- allunga.
    if new.recurrence_id is not null then
      return new;
    end if;
    v_body := squad_giorno_it(new.date)
      || coalesce(' · ore ' || squad_orario_it(new.start_time, new.end_time), '')
      || coalesce(' · ' || new.location, '');
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (new.team_id, new.sector_id, 'training_created',
              coalesce(nullif(new.title, ''), 'Allenamento'), v_body, auth.uid(), 'allenamenti');
    return new;
  end if;

  if tg_op = 'DELETE' then
    v_body := squad_giorno_it(old.date)
      || coalesce(' · ore ' || squad_orario_it(old.start_time, old.end_time), '')
      || coalesce(' · ' || old.location, '');
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (old.team_id, old.sector_id, 'training_cancelled',
              coalesce(nullif(old.title, ''), 'Allenamento'), v_body, auth.uid(), 'allenamenti');
    return old;
  end if;

  -- UPDATE. Si elenca soltanto quello che è cambiato davvero, con il prima e
  -- il dopo: è l'unica forma in cui la notifica risparmia di andare a
  -- guardare. «Giorno: gio 18/09 → sab 20/09» si legge una volta e basta.
  if new.date is distinct from old.date then
    v_cambi := v_cambi || ('Giorno: ' || squad_giorno_it(old.date) || ' → ' || squad_giorno_it(new.date));
  end if;
  if new.start_time is distinct from old.start_time or new.end_time is distinct from old.end_time then
    v_cambi := v_cambi || ('Orario: ' || coalesce(squad_orario_it(old.start_time, old.end_time), 'non indicato')
                           || ' → ' || coalesce(squad_orario_it(new.start_time, new.end_time), 'non indicato'));
  end if;
  if new.location is distinct from old.location then
    v_cambi := v_cambi || ('Luogo: ' || coalesce(nullif(old.location, ''), 'non indicato')
                           || ' → ' || coalesce(nullif(new.location, ''), 'non indicato'));
  end if;

  -- Rinominare un allenamento non è una notizia da mandare a tutti: non
  -- cambia dove bisogna essere, né quando.
  if array_length(v_cambi, 1) is null then
    return new;
  end if;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, new.sector_id, 'training_changed',
            coalesce(nullif(new.title, ''), 'Allenamento'),
            array_to_string(v_cambi, ' · '), auth.uid(), 'allenamenti');
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- La prossima partita: il titolo è l'avversario
-- ----------------------------------------------------------------------------
create or replace function notify_next_match_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_body text;
begin
  if tg_op = 'DELETE' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (old.team_id, old.sector_id, 'next_match_changed',
              'Prossima partita rimossa',
              coalesce(nullif(old.opponent, ''), 'L''avversario') || ' non è più in programma',
              auth.uid(), 'home');
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

  v_body := case when new.home then 'In casa' else 'In trasferta' end
    || case when new.date is not null and new.date <> '' then ' · ' || new.date else '' end
    || case when new.time is not null and new.time <> '' then ' ore ' || new.time else '' end
    || case when new.location is not null and new.location <> '' then ' · ' || new.location else '' end;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, new.sector_id, 'next_match_changed',
            'vs ' || coalesce(nullif(new.opponent, ''), 'da definire'),
            v_body, auth.uid(), 'home');
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Documenti: il titolo è di chi è il documento
-- ----------------------------------------------------------------------------
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
    values (new.team_id, v_sector, 'document_uploaded',
            v_what || ' di ' || coalesce(v_player, 'un atleta'),
            'Caricato, in attesa di verifica', auth.uid(), 'anagrafica');
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
    insert into notifications (team_id, sector_id, type, title, body, actor_id, profile_id, link_tab)
      values (new.team_id, v_sector, 'document_reviewed', v_title, v_body, auth.uid(), r.profile_id, 'anagrafica');
  end loop;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- I programmi fissi: il titolo dice quale giorno della settimana
-- ----------------------------------------------------------------------------
-- Stessa funzione della 004, riscritta: il trigger che la chiama
-- (trg_notify_training_recurrence) resta quello, quindi non si duplica niente.
-- Il giorno della settimana per esteso, in italiano.
create or replace function squad_giorno_settimana_it(w int)
returns text language sql immutable as $$
  select case w
    when 0 then 'Domenica' when 1 then 'Lunedì' when 2 then 'Martedì'
    when 3 then 'Mercoledì' when 4 then 'Giovedì' when 5 then 'Venerdì'
    else 'Sabato' end;
$$;

create or replace function notify_training_recurrence_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_giorno text;
  v_quando text;
begin
  -- In un trigger DELETE `new` non esiste affatto: leggerlo solleva un errore,
  -- non restituisce null. Quindi il ramo della cancellazione si serve solo di
  -- `old` ed esce prima di toccare qualunque altra cosa.
  if tg_op = 'DELETE' then
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (old.team_id, old.sector_id, 'training_recurrence_changed',
              squad_giorno_settimana_it(old.weekday) || ': allenamento fisso tolto',
              'Le occorrenze future non vengono più create', auth.uid(), 'allenamenti');
    return old;
  end if;

  -- Un programma spento equivale a toglierlo: da domani in palestra non ci va
  -- più nessuno, ed è quello che le persone hanno bisogno di sapere.
  if tg_op = 'UPDATE' and old.active and not new.active then
    insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
      values (new.team_id, new.sector_id, 'training_recurrence_changed',
              squad_giorno_settimana_it(new.weekday) || ': allenamento fisso tolto',
              'Le occorrenze future non vengono più create', auth.uid(), 'allenamenti');
    return new;
  end if;

  -- Un salvataggio che non cambia niente non è una notizia.
  if tg_op = 'UPDATE'
     and new.weekday is not distinct from old.weekday
     and new.start_time is not distinct from old.start_time
     and new.end_time is not distinct from old.end_time
     and new.location is not distinct from old.location
     and new.active is not distinct from old.active then
    return new;
  end if;

  v_giorno := squad_giorno_settimana_it(new.weekday);
  v_quando := coalesce('ore ' || squad_orario_it(new.start_time, new.end_time), 'orario da definire')
    || coalesce(' · ' || nullif(new.location, ''), '');

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, new.sector_id, 'training_recurrence_changed',
            v_giorno || ': allenamento fisso', v_quando, auth.uid(), 'allenamenti');
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Le vecchie notifiche senza destinazione
-- ----------------------------------------------------------------------------
-- Toccarle deve portare da qualche parte, anche quelle scritte prima che la
-- destinazione esistesse.
update notifications set link_tab = case
  when type like 'training%' then 'allenamenti'
  when type = 'next_match_changed' then 'home'
  when type like 'document%' then 'anagrafica'
  when type = 'comunicazione' then 'comunicazioni'
  else 'home' end
where link_tab is null;

-- ============================================================================
-- Team Manager Basket — migrazione 022
-- Misure tecniche per il trattamento dei dati personali
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la 021.
--
-- ATTENZIONE, VA DETTO CHIARAMENTE: questa migrazione implementa le MISURE
-- TECNICHE. Non rende la società conforme al GDPR da sola. Restano da fare,
-- e sono adempimenti giuridici e organizzativi, non righe di codice:
--
--   - l'informativa privacy, redatta e pubblicata dalla società;
--   - la raccolta del consenso dell'esercente la responsabilità genitoriale
--     per i minori, con le finalità elencate una per una;
--   - la nomina di Supabase come responsabile del trattamento (il DPA si
--     firma dal loro pannello) e la verifica della regione dei dati;
--   - il registro dei trattamenti, tenuto dalla società;
--   - la politica di conservazione: per quanti anni si tengono i dati di un
--     atleta che ha smesso.
--
-- Vedi app/supabase/PRIVACY.md per la mappa dei dati da cui partire.
--
-- COSA CONSERVA L'APP, OGGI
--
--   players    nome, data di nascita, codice fiscale, email, telefono del
--              tutore, altezza, fotografia — riferibili a MINORI
--   player_documents  certificato medico agonistico con data di scadenza:
--              è un dato relativo alla salute, art. 9 GDPR
--   profiles   nome, telefono
--   finance_entries  quote dovute e versate, collegate al singolo atleta
--
-- Sono le due righe in maiuscolo a determinare il livello di attenzione: dati
-- di minori e un dato sanitario. Non è un gestionale qualsiasi.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Consenso registrato, non presunto
-- ----------------------------------------------------------------------------
-- Il consenso va dimostrato: serve sapere CHI ha accettato, QUANDO e QUALE
-- versione dell'informativa. Senza la versione, aggiornare l'informativa
-- renderebbe indimostrabile ogni consenso già raccolto.

alter table profiles add column privacy_accepted_at timestamptz;
alter table profiles add column privacy_version text;

-- L'utente registra il proprio consenso: nessun altro può farlo per lui, ed è
-- l'unico campo che può scrivere da sé. Passa da una funzione perche' le RLS
-- filtrano per riga e non per colonna — senza, si aprirebbe di nuovo la strada
-- all'auto-assegnazione del ruolo chiusa dalla migrazione 009.
create or replace function accept_privacy(p_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  update profiles
     set privacy_accepted_at = now(), privacy_version = p_version
   where id = auth.uid();
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Cancellazione di un atleta (art. 17, diritto alla cancellazione)
-- ----------------------------------------------------------------------------
-- `delete from players` cancella per cascata rose, documenti, presenze e
-- destinatari delle comunicazioni. NON cancella due cose, ed è deliberato:
--
--   - i tabellini delle partite, dove il giocatore è dentro una colonna jsonb
--     insieme agli altri: sono la cronaca di un evento sportivo, non una
--     scheda anagrafica;
--   - i movimenti contabili collegati, che una società ha l'obbligo di
--     conservare per dieci anni ai fini fiscali.
--
-- Per questo la funzione ANONIMIZZA invece di cancellare tutto: toglie i dati
-- identificativi ovunque siano, e lascia in piedi ciò che la legge impone di
-- tenere. È la risposta corretta a "cancellate i dati di mio figlio", non un
-- compromesso.

create or replace function erase_player(p_player_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_label text;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può cancellare i dati di un atleta';
  end if;

  select team_id into v_team_id from players where id = p_player_id;
  if v_team_id is null or v_team_id <> current_team_id() then
    raise exception 'Atleta non trovato';
  end if;

  v_label := 'Atleta rimosso ' || to_char(now(), 'YYYY-MM-DD');

  -- La fotografia va tolta dallo storage a parte: qui si perde il riferimento.
  update players
     set name = v_label,
         birth_date = null, fiscal_code = null, email = null,
         guardian_phone = null, height_cm = null, photo_path = null,
         role_position = null, number = '-'
   where id = p_player_id;

  -- I documenti caricati spariscono: il certificato medico è un dato sanitario
  -- e non c'è nessun obbligo che ne imponga la conservazione qui.
  delete from player_documents where player_id = p_player_id;

  -- Fuori da tutte le rose, presenti e passate.
  delete from player_sectors where player_id = p_player_id;

  -- Scollegato dagli account famiglia.
  delete from profile_players where player_id = p_player_id;

  -- I movimenti contabili restano per obbligo fiscale, ma perdono il nome:
  -- l'importo e la data servono al bilancio, l'identità no.
  update finance_entries
     set player_id = null,
         party_name = v_label,
         notes = coalesce(notes, '') ||
           case when p_reason is null then '' else ' [cancellazione: ' || p_reason || ']' end
   where player_id = p_player_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Cosa conserviamo di una persona (art. 15, diritto di accesso)
-- ----------------------------------------------------------------------------
-- Restituisce in un colpo solo tutto ciò che l'app tiene su un atleta. Serve
-- a rispondere a una richiesta di accesso senza andare a cercare tabella per
-- tabella, che è il modo in cui si dimentica qualcosa.

create or replace function player_personal_data(p_player_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_out jsonb;
begin
  if not (is_admin() or has_family_access_to_player(p_player_id)) then
    raise exception 'Non autorizzato';
  end if;

  select jsonb_build_object(
    'anagrafica', to_jsonb(p) - 'team_id' - 'photo_focal_x' - 'photo_focal_y',
    'categorie', (
      select coalesce(jsonb_agg(jsonb_build_object('settore', s.name, 'stagione', se.name)), '[]'::jsonb)
      from player_sectors ps
      join sectors s on s.id = ps.sector_id
      left join seasons se on se.id = ps.season_id
      where ps.player_id = p.id),
    'documenti', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'tipo', d.doc_type, 'stato', d.status,
        'caricato_il', d.uploaded_at, 'scade_il', d.expires_at)), '[]'::jsonb)
      from player_documents d where d.player_id = p.id),
    'presenze', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'data', t.date, 'attivita', t.title, 'stato', a.status)), '[]'::jsonb)
      from training_attendance a
      join trainings t on t.id = a.training_id
      where a.player_id = p.id),
    'convocazioni', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'titolo', c.title, 'data', c.event_date, 'risposta', cr.status)), '[]'::jsonb)
      from communication_recipients cr
      join communications c on c.id = cr.communication_id
      where cr.player_id = p.id),
    'quote', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'descrizione', e.description, 'importo', e.planned_amount,
        'scadenza', e.due_date)), '[]'::jsonb)
      from finance_entries e where e.player_id = p.id),
    'scheda_tecnica', (
      select to_jsonb(pd) - 'team_id' - 'player_id'
      from player_development pd where pd.player_id = p.id)
  ) into v_out
  from players p where p.id = p_player_id;

  return v_out;
end;
$$;

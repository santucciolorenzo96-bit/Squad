-- ============================================================================
-- SQUAD — migrazione 047
-- Data di nascita e codice fiscale: liberi finché servono, poi fermi
-- ============================================================================
--
-- IL GRADIENTE ERA ROVESCIATO
--
-- Fino a ieri una famiglia poteva riscriversi il CODICE FISCALE quando voleva,
-- senza che nessuno se ne accorgesse — ed è il dato che va sul tesseramento
-- federale: sbagliato, il ragazzo non è tesserato e non può giocare. Il numero
-- di maglia, che si rimette a posto in tre secondi, era invece blindato.
--
-- Non si chiude la porta: la famiglia È la fonte giusta per quei dati, e
-- toglierle la penna vuol dire tornare ai messaggi in chat. Si fanno due cose
-- che prima non c'erano.
--
-- 1. OGNI MODIFICA LASCIA UNA NOTIFICA. Non un registro che nessuno apre: la
--    stessa campanella di tutto il resto, con scritto cosa è cambiato e da
--    cosa a cosa. Se un codice fiscale cambia il giorno prima della consegna
--    dei tesseramenti, in società lo devono vedere.
--
-- 2. DOPO IL TESSERAMENTO SI FERMANO. Quando esiste un tesseramento APPROVATO
--    e non scaduto, quei due dati sono già stati mandati alla federazione: da
--    lì in poi cambiarli nell'app non li cambia là, e crea solo una
--    discordanza silenziosa fra quello che sa SQUAD e quello che sa la FIP.
--    La società può ancora farlo — è lei che parla con la federazione.
--
-- Telefono, email e altezza restano liberi sempre: non vanno su nessun modulo.

-- ============================================================================
-- 1. IL TESSERAMENTO C'È?
-- ============================================================================
-- «Approvato e non scaduto». Un tesseramento respinto o scaduto non blocca
-- niente: è esattamente la situazione in cui quei dati vanno corretti.

create or replace function tesserato(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from player_documents d
     where d.player_id = p_player_id
       and d.doc_type = 'tesseramento_fip'
       and d.status = 'approved'
       and (d.expires_at is null or d.expires_at >= current_date)
  )
$$;

grant execute on function tesserato(uuid) to authenticated;


-- ============================================================================
-- 2. LA FAMIGLIA SCRIVE, MA NON DOPO IL TESSERAMENTO
-- ============================================================================

create or replace function update_linked_player_details(
  p_player_id uuid,
  p_birth_date date,
  p_fiscal_code text,
  p_guardian_phone text,
  p_email text,
  p_height_cm int
) returns players
language plpgsql security definer set search_path = public as $$
declare
  v_row players;
  v_prima players;
begin
  if not has_family_access_to_player(p_player_id) then
    raise exception 'Non sei collegato a questo giocatore';
  end if;

  select * into v_prima from players where id = p_player_id and team_id = current_team_id();
  if v_prima.id is null then
    raise exception 'Giocatore non trovato';
  end if;

  -- I due dati che vanno sul tesseramento si fermano quando il tesseramento
  -- c'è. Il messaggio dice cosa fare, perché «non puoi» senza un seguito è
  -- solo un muro: la società può ancora correggerli, ed è lei che poi parla
  -- con la federazione.
  if tesserato(p_player_id) and (
       p_birth_date is distinct from v_prima.birth_date
       or coalesce(nullif(trim(p_fiscal_code), ''), '')
          is distinct from coalesce(nullif(trim(v_prima.fiscal_code), ''), '')
     ) then
    raise exception 'Data di nascita e codice fiscale sono già andati sul tesseramento: per correggerli chiedi alla società.';
  end if;

  update players set
    birth_date     = p_birth_date,
    fiscal_code    = p_fiscal_code,
    guardian_phone = p_guardian_phone,
    email          = p_email,
    height_cm      = p_height_cm
  where id = p_player_id and team_id = current_team_id()
  returning * into v_row;

  return v_row;
end;
$$;


-- ============================================================================
-- 3. E LA SOCIETÀ SE NE ACCORGE
-- ============================================================================
-- Un trigger e non una riga nell'applicazione: la modifica può arrivare da
-- tre strade diverse (la famiglia, la scheda, un domani un'importazione) e la
-- notifica non deve dipendere da quale.
--
-- Solo i due dati che contano. Il telefono cambia quando si cambia gestore, e
-- una campanella per ogni numero nuovo è una campanella che si smette di
-- guardare.

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

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, v_sector, 'dato_sensibile',
            v_cosa || ' di ' || coalesce(new.name, 'un atleta'),
            'Da ' || v_da || ' a ' || v_a
              || case when is_team_manager() then '' else ', modificata dalla famiglia' end,
            auth.uid(), 'anagrafica');
  return new;
end;
$$;

drop trigger if exists trg_dati_sensibili on players;
create trigger trg_dati_sensibili
  after update of birth_date, fiscal_code on players
  for each row execute function notify_dati_sensibili();

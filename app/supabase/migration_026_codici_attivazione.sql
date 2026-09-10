-- ============================================================================
-- SQUAD — migrazione 026
-- Codici di attivazione: una società nuova nasce solo con uno di questi
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase.
--
-- Fino a ieri chiunque potesse aprire la pagina d'accesso poteva creare una
-- società: bastava compilare un modulo. Togliere il pulsante dall'interfaccia
-- non basta — `create_team` è una funzione esposta da PostgREST, e chi sa
-- leggere il bundle sa chiamarla. Il controllo va messo dove sta il dato.
--
-- Da qui in avanti: chi vuole aprire una società riceve un codice
-- dall'amministratore della piattaforma, e senza quel codice la creazione
-- viene rifiutata dal database, non dall'interfaccia.
-- ============================================================================


-- ============================================================================
-- 1. LA TABELLA
-- ============================================================================
-- Un codice vale UNA società: si consuma. Non è un interruttore permanente da
-- girare una volta e dimenticare, perché un codice che vale per sempre, prima
-- o poi, gira su WhatsApp.

create table if not exists platform_codes (
  code text primary key,
  label text,                                    -- a chi è stato dato, in chiaro
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table platform_codes enable row level security;

-- Nessuna policy, di proposito: dal client questa tabella non si legge e non
-- si scrive MAI. Le sole strade sono le due funzioni qui sotto, che girano
-- come proprietario e decidono loro cosa rispondere. Una policy di lettura,
-- anche solo per gli admin, renderebbe i codici non usati leggibili da chi ha
-- una sessione: sono credenziali, e le credenziali non si mostrano.


-- ============================================================================
-- 2. LA VERIFICA, PRIMA DEL MODULO
-- ============================================================================
-- Serve a dire subito «questo codice non va bene» invece di farlo scoprire
-- dopo aver compilato dieci campi. Risponde solo sì o no: non dice a chi è
-- stato dato il codice, né quando scade.
--
-- È un oracolo, e di questo bisogna essere consapevoli: chi prova codici a
-- caso sa se ha indovinato. Regge perché i codici hanno la stessa forma degli
-- inviti — dodici caratteri su un alfabeto di trentuno, circa 10^18
-- combinazioni — e perché si consumano.

create or replace function activation_code_ok(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from platform_codes
    where code = upper(trim(coalesce(p_code, '')))
      and used_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

grant execute on function activation_code_ok(text) to anon, authenticated;


-- ============================================================================
-- 3. LA CREAZIONE
-- ============================================================================
-- `for update` blocca la riga del codice fino alla fine della transazione: due
-- persone che spendono lo stesso codice nello stesso istante non aprono due
-- società. È la stessa ragione per cui un biglietto si strappa all'ingresso e
-- non all'uscita.

create or replace function create_team_with_code(
  p_code text,
  p_name text,
  p_city text,
  p_category text,
  p_display_name text,
  p_sport text default 'basket'
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_team uuid;
begin
  v_code := upper(trim(coalesce(p_code, '')));

  perform 1 from platform_codes
    where code = v_code
      and used_at is null
      and (expires_at is null or expires_at > now())
    for update;

  if not found then
    raise exception 'Codice di attivazione non valido, scaduto o già usato.';
  end if;

  -- La creazione vera resta una sola, in un posto solo: qui si aggiunge il
  -- permesso, non una seconda versione della stessa logica che un domani
  -- divergerebbe da quella buona.
  v_team := create_team(p_name, p_city, p_category, p_display_name, p_sport);

  update platform_codes
    set used_at = now(), used_by = auth.uid()
    where code = v_code;

  return v_team;
end;
$$;

grant execute on function create_team_with_code(text, text, text, text, text, text) to authenticated;


-- ============================================================================
-- 4. LA VECCHIA PORTA SI CHIUDE
-- ============================================================================
-- `create_team` continua a esistere e a fare il suo lavoro, ma smette di
-- essere chiamabile da fuori: resta raggiungibile solo da
-- create_team_with_code, che gira come proprietario e non passa da questi
-- permessi. Senza questa riga tutto il resto della migrazione sarebbe
-- decorazione.

revoke execute on function create_team(text, text, text, text, text) from anon, authenticated, public;


-- ============================================================================
-- 5. GENERARE UN CODICE
-- ============================================================================
-- Non è concessa a nessun ruolo: si esegue dall'editor SQL, cioè da chi ha le
-- chiavi del progetto. È esattamente il confine giusto — l'amministratore
-- della piattaforma è chi ha accesso al database, non un ruolo dentro l'app.
--
-- Riusa generate_invite_token della 025: stesso alfabeto senza 0/O e 1/I/L,
-- stessa casualità da gen_random_bytes. Un codice di attivazione vale più di
-- un invito, non meno.

create or replace function new_activation_code(p_label text default null, p_days int default 30)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
begin
  v_code := generate_invite_token();
  insert into platform_codes (code, label, expires_at)
    values (v_code, p_label, case when p_days is null then null else now() + (p_days || ' days')::interval end);
  return v_code;
end;
$$;

revoke execute on function new_activation_code(text, int) from anon, authenticated, public;


-- ============================================================================
-- COME SI USA
-- ============================================================================
-- Per dare a qualcuno la possibilità di aprire una società, dall'editor SQL:
--
--   select new_activation_code('ASD Esempio — Mario Rossi', 30);
--
-- Restituisce il codice da consegnare: vale 30 giorni e una società sola.
-- Per vedere quali codici sono in giro e chi li ha spesi:
--
--   select code, label, expires_at, used_at, used_by from platform_codes
--   order by created_at desc;
--
-- Per ritirarne uno non ancora speso:
--
--   delete from platform_codes where code = 'XXXXXXXXXXXX' and used_at is null;
-- ============================================================================

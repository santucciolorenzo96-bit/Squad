-- ============================================================================
-- SQUAD — migrazione 032
-- Il SuperAdmin vede e rimuove gli account
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase. Va dopo la 030.
--
-- Serve a due cose che finora si facevano solo dal pannello di Supabase, cioè
-- fuori da SQUAD: guardare l'elenco di chi ha un accesso, e cancellare quelli
-- nati per sbaglio — prove, iscrizioni doppie, indirizzi scritti male.
--
-- CANCELLARE UN ACCOUNT NON È DISATTIVARLO. Disattivare è quello che fa un
-- amministratore di società dalla sua schermata Utenti: la persona non entra
-- più, ma resta scritta accanto a quello che ha fatto. Qui invece la riga
-- sparisce da auth.users, e con lei il profilo, i collegamenti agli atleti e
-- l'indirizzo email — che torna libero, e questo è di solito il motivo per cui
-- lo si vuole fare.
--
-- Quello che NON sparisce sono i dati della società: allenamenti, documenti,
-- movimenti di cassa e tabellini restano dove sono. Perde solo il nome di chi
-- li ha inseriti, che diventa vuoto. È la scelta giusta e va detta: un
-- certificato approvato non deve sparire perché chi l'ha approvato ha
-- cambiato squadra.
-- ============================================================================


-- ============================================================================
-- 1. PRIMA, TOGLIERE I BLOCCHI
-- ============================================================================
-- Mezza dozzina di tabelle porta un «chi l'ha fatto» che punta a profiles
-- senza dire cosa succede se quel profilo sparisce. Il valore predefinito di
-- Postgres è: non sparisce, la cancellazione fallisce. Risultato, un account
-- che ha approvato un documento nel 2024 sarebbe incancellabile per sempre.
--
-- Si cercano da sole invece di elencarle a mano: fra tre migrazioni ce ne
-- sarebbe una nuova e questo file non lo saprebbe. Le colonne che NON ammettono
-- null si lasciano stare — lì «autore sconosciuto» non è rappresentabile, e
-- forzarlo romperebbe qualcosa di più importante.

do $$
declare
  r record;
  n int := 0;
begin
  for r in (
    select con.conname   as vincolo,
           cl.relname    as tabella,
           att.attname   as colonna,
           att.attnotnull as obbligatoria
    from pg_constraint con
    join pg_class cl      on cl.oid = con.conrelid
    join pg_namespace ns  on ns.oid = cl.relnamespace
    join pg_attribute att on att.attrelid = con.conrelid and att.attnum = con.conkey[1]
    where con.contype = 'f'
      and ns.nspname = 'public'
      and con.confrelid = 'public.profiles'::regclass
      and con.confdeltype = 'a'              -- NO ACTION: è quello che blocca
      and array_length(con.conkey, 1) = 1
  ) loop
    if r.obbligatoria then
      raise notice 'lasciata com''è: %.% non ammette valori vuoti', r.tabella, r.colonna;
    else
      execute format('alter table public.%I drop constraint %I', r.tabella, r.vincolo);
      execute format(
        'alter table public.%I add constraint %I foreign key (%I) references public.profiles(id) on delete set null',
        r.tabella, r.vincolo, r.colonna);
      n := n + 1;
      raise notice 'ora si svuota invece di bloccare: %.%', r.tabella, r.colonna;
    end if;
  end loop;
  raise notice 'vincoli convertiti: %', n;
end
$$;


-- ============================================================================
-- 2. L'ELENCO
-- ============================================================================
-- Tutti gli account della piattaforma, con dove stanno e da quando. Legge
-- auth.users, che dal client non è raggiungibile in nessun altro modo: per
-- questo la funzione è SECURITY DEFINER e la prima riga controlla chi chiama.

create or replace function list_accounts()
returns table (
  user_id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  confirmed boolean,
  display_name text,
  role text,
  active boolean,
  team_name text,
  is_owner boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not am_i_platform_owner() then
    raise exception 'Non autorizzato.';
  end if;

  return query
    select u.id,
           u.email::text,
           u.created_at,
           u.last_sign_in_at,
           u.email_confirmed_at is not null,
           p.display_name,
           p.role,
           p.active,
           t.name,
           exists (select 1 from platform_owners o where o.user_id = u.id)
    from auth.users u
    left join profiles p on p.id = u.id
    left join teams t    on t.id = p.team_id
    order by u.created_at desc;
end;
$$;

grant execute on function list_accounts() to authenticated;


-- ============================================================================
-- 3. LA CANCELLAZIONE
-- ============================================================================
-- Due sole protezioni, ed entrambe servono a proteggere da sé stessi:
--
--   * non si cancella il proprio account. Sarebbe l'unico errore davvero
--     irreversibile di questa schermata: si resterebbe fuori dalla piattaforma
--     senza più il modo di rientrare a sistemare;
--   * un altro amministratore di piattaforma si cancella solo confermandolo a
--     parte. Non è un ripensamento, è che due tasti vicini non devono poter
--     fare due cose di peso così diverso.

create or replace function delete_account(p_user_id uuid, p_anche_owner boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_owner boolean;
begin
  if not am_i_platform_owner() then
    raise exception 'Non autorizzato.';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'Non puoi cancellare il tuo account da qui.';
  end if;

  select email::text into v_email from auth.users where id = p_user_id;
  if v_email is null then
    raise exception 'Account inesistente.';
  end if;

  select exists (select 1 from platform_owners o where o.user_id = p_user_id) into v_owner;
  if v_owner and not p_anche_owner then
    raise exception 'Questo è un amministratore di piattaforma: conferma a parte per cancellarlo.';
  end if;

  -- auth.users porta con sé, in cascata, il profilo e tutto quello che al
  -- profilo è legato in cascata: collegamenti agli atleti, categorie assegnate,
  -- ruolo di piattaforma, presenza di piattaforma. Il resto — quello che la
  -- persona ha inserito nella società — resta, e perde solo il nome dell'autore.
  delete from auth.users where id = p_user_id;

  return jsonb_build_object('email', v_email, 'era_owner', v_owner);
end;
$$;

grant execute on function delete_account(uuid, boolean) to authenticated;

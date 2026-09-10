-- ============================================================================
-- SQUAD — migrazione 027
-- Amministratori della piattaforma: i codici di attivazione dall'app
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, DOPO la 026.
--
-- La 026 ha messo i codici di attivazione nel database, ma per generarne uno
-- bisognava aprire l'editor SQL. Funziona, ed è anche il confine più stretto
-- possibile — però chiede di uscire dall'app per fare una cosa che appartiene
-- all'app.
--
-- Il problema da risolvere prima di aggiungere il pulsante è: CHI può premerlo.
-- Non «un admin», perché admin è il ruolo di chi amministra UNA società: se
-- bastasse quello, ogni club potrebbe fabbricare società a piacere e il
-- controllo della 026 varrebbe zero. Serve un secondo livello, sopra le
-- società, e questa migrazione lo introduce nel modo più piccolo possibile:
-- un elenco di profili.
-- ============================================================================


-- ============================================================================
-- 1. CHI COMANDA SULLA PIATTAFORMA
-- ============================================================================
-- Una tabella e basta. Non una colonna su `profiles`: un profilo appartiene a
-- una società, questo ruolo sta al di sopra delle società, e tenerlo separato
-- rende impossibile assegnarlo per sbaglio insieme agli altri campi del
-- profilo — che si aggiornano con una update qualunque.

create table if not exists platform_owners (
  profile_id uuid primary key references profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);

alter table platform_owners enable row level security;

-- Nessuna policy: nemmeno chi è nell'elenco lo legge dal client. Sapere chi
-- altro comanda non serve a generare un codice, e un elenco leggibile è un
-- elenco di bersagli.


-- ============================================================================
-- 2. SONO IO?
-- ============================================================================
-- L'app la chiama per decidere se mostrare il pannello. Risponde solo di sé:
-- non esiste un modo, da qui, per chiedere di qualcun altro.

create or replace function am_i_platform_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from platform_owners where profile_id = auth.uid());
$$;

grant execute on function am_i_platform_owner() to authenticated;


-- ============================================================================
-- 3. GENERARE UN CODICE
-- ============================================================================
-- Il controllo sta qui dentro, non nell'interfaccia: nascondere il pulsante
-- non impedisce di chiamare la funzione, e una funzione che si fida di chi la
-- chiama è una porta aperta con un cartello «vietato entrare».

create or replace function create_activation_code(p_label text default null, p_days int default 30)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_giorni int;
begin
  if not exists (select 1 from platform_owners where profile_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può generare un codice di attivazione.';
  end if;

  -- Fra un giorno e un anno. Un codice «per sempre» generato con un clic è
  -- esattamente la cosa che la 026 voleva evitare.
  v_giorni := least(greatest(coalesce(p_days, 30), 1), 365);

  v_code := generate_invite_token();
  insert into platform_codes (code, label, expires_at)
    values (v_code, nullif(trim(coalesce(p_label, '')), ''), now() + (v_giorni || ' days')::interval);

  return v_code;
end;
$$;

grant execute on function create_activation_code(text, int) to authenticated;


-- ============================================================================
-- 4. VEDERE E RITIRARE
-- ============================================================================
-- Un codice generato e poi dimenticato è un codice che gira. L'elenco serve a
-- sapere cosa c'è in giro, e a ritirare quello che non serve più.
--
-- I codici sono in chiaro: chi li vede è chi li ha emessi, ed è la stessa
-- ragione per cui un amministratore vede i propri inviti.

create or replace function list_activation_codes()
returns table (
  code text,
  label text,
  expires_at timestamptz,
  used_at timestamptz,
  used_by_name text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from platform_owners where profile_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può vedere i codici di attivazione.';
  end if;

  return query
    select c.code, c.label, c.expires_at, c.used_at, p.display_name, c.created_at
    from platform_codes c
    left join profiles p on p.id = c.used_by
    order by c.created_at desc
    limit 100;
end;
$$;

grant execute on function list_activation_codes() to authenticated;


create or replace function revoke_activation_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from platform_owners where profile_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può ritirare un codice di attivazione.';
  end if;

  -- Solo quelli non ancora spesi: cancellare un codice già usato vorrebbe dire
  -- cancellare la traccia di come è nata una società.
  delete from platform_codes where code = upper(trim(p_code)) and used_at is null;
end;
$$;

grant execute on function revoke_activation_code(text) to authenticated;


-- ============================================================================
-- 5. IL PRIMO AMMINISTRATORE
-- ============================================================================
-- Il primo non può nominarsi da solo dall'app — non c'è nessuno che possa
-- autorizzarlo — quindi si nomina da qui, che è l'unico posto dove serve avere
-- le chiavi del progetto. Cerca per email fra gli account registrati.

create or replace function make_platform_owner(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
  v_nome text;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nessun account registrato con questa email: %', p_email;
  end if;

  select display_name into v_nome from profiles where id = v_id;
  if v_nome is null then
    raise exception 'Questo account non ha ancora un profilo in nessuna società.';
  end if;

  insert into platform_owners (profile_id) values (v_id) on conflict do nothing;
  return v_nome;
end;
$$;

revoke execute on function make_platform_owner(text) from anon, authenticated, public;


-- ============================================================================
-- COME SI USA
-- ============================================================================
-- Una volta sola, da qui, mettendo la TUA email:
--
--   select make_platform_owner('tua@email.it');
--
-- Da quel momento il pannello «Nuove società» compare in Squadra, e i codici
-- si generano da lì. Per toglierlo a qualcuno:
--
--   delete from platform_owners where profile_id =
--     (select id from auth.users where lower(email) = lower('tua@email.it'));
-- ============================================================================

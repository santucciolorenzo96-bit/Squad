-- ============================================================================
-- SQUAD — migrazione 028
-- SuperAdmin puro: il ruolo di piattaforma si slega dalle società
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase. Sostituisce la 027: se la 027 non
-- l'hai ancora eseguita puoi saltarla e lanciare direttamente questa, che fa
-- tutto quello che faceva lei.
--
-- Nella 027 un amministratore di piattaforma era un `profiles.id`, cioè il
-- profilo di qualcuno DENTRO una società. Funziona finché quella società
-- esiste: il giorno in cui il profilo viene cancellato — un ricambio in
-- dirigenza, una società chiusa, una cancellazione GDPR — il ruolo di
-- piattaforma sparisce con lui, per via del cascade. E chi amministra la
-- piattaforma non deve essere obbligato a stare dentro un club.
--
-- Qui il riferimento passa all'ACCOUNT (auth.users). Un SuperAdmin può quindi
-- non avere nessun profilo, nessuna società e nessuna rosa: esiste come
-- account e basta.
-- ============================================================================


-- ============================================================================
-- 1. LA TABELLA GUARDA L'ACCOUNT, NON IL PROFILO
-- ============================================================================

create table if not exists platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz not null default now()
);

-- Se la 027 è già passata la tabella esiste con la vecchia forma: si converte
-- invece di ricrearla, così chi è già dentro ci resta.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'platform_owners' and column_name = 'profile_id'
  ) then
    alter table platform_owners drop constraint if exists platform_owners_profile_id_fkey;
    alter table platform_owners rename column profile_id to user_id;
    alter table platform_owners
      add constraint platform_owners_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

alter table platform_owners enable row level security;
-- Nessuna policy, come prima: l'elenco non si legge dal client.


-- ============================================================================
-- 2. LE FUNZIONI, RISCRITTE SULL'ACCOUNT
-- ============================================================================
-- Cambia solo la colonna su cui guardano. Il principio resta: il controllo sta
-- dentro la funzione, non nell'interfaccia che la chiama.

create or replace function am_i_platform_owner()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (select 1 from platform_owners where user_id = auth.uid());
$$;

grant execute on function am_i_platform_owner() to authenticated;


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
  if not exists (select 1 from platform_owners where user_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può generare un codice di attivazione.';
  end if;

  v_giorni := least(greatest(coalesce(p_days, 30), 1), 365);
  v_code := generate_invite_token();

  insert into platform_codes (code, label, expires_at)
    values (v_code, nullif(trim(coalesce(p_label, '')), ''), now() + (v_giorni || ' days')::interval);

  return v_code;
end;
$$;

grant execute on function create_activation_code(text, int) to authenticated;


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
  if not exists (select 1 from platform_owners where user_id = auth.uid()) then
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
  if not exists (select 1 from platform_owners where user_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può ritirare un codice di attivazione.';
  end if;

  delete from platform_codes where code = upper(trim(p_code)) and used_at is null;
end;
$$;

grant execute on function revoke_activation_code(text) to authenticated;


-- ============================================================================
-- 3. NOMINARE UN SUPERADMIN
-- ============================================================================
-- Non chiede più che l'account abbia un profilo: è esattamente il punto di
-- questa migrazione. Basta un account registrato.

create or replace function make_platform_owner(p_email text)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_id uuid;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_id is null then
    raise exception 'Nessun account registrato con questa email: %. Registralo prima dall''app.', p_email;
  end if;

  insert into platform_owners (user_id) values (v_id) on conflict do nothing;
  return v_id::text;
end;
$$;

revoke execute on function make_platform_owner(text) from anon, authenticated, public;


-- ============================================================================
-- COME SI USA
-- ============================================================================
--   select make_platform_owner('santuccio.lorenzo96@gmail.com');
--
-- L'account diventa SuperAdmin. Se ha anche un profilo in una società continua
-- a fare l'amministratore di quella società come prima: sono due ruoli
-- indipendenti, non due gradini della stessa scala. Se non ha nessun profilo,
-- entrando nell'app trova la console della piattaforma e nient'altro.
--
-- Per togliere il ruolo:
--   delete from platform_owners where user_id =
--     (select id from auth.users where lower(email) = lower('tua@email.it'));
--
-- Per vedere chi ce l'ha:
--   select u.email, o.added_at from platform_owners o
--   join auth.users u on u.id = o.user_id order by o.added_at;
-- ============================================================================

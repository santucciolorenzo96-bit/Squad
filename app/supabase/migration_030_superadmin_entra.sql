-- ============================================================================
-- SQUAD — migrazione 030
-- Il SuperAdmin entra in una società con un tocco
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase.
--
-- Fino a qui il SuperAdmin vedeva l'ANAGRAFE delle società — nome, sport,
-- città, quante persone — e nient'altro: rose, documenti e conti restavano di
-- chi ne faceva parte. Per assistere davvero una società quella distanza non
-- basta: se un dirigente chiama perché «i certificati non si vedono», serve
-- guardare la sua schermata, non la sua riga in elenco.
--
-- COME FUNZIONA, E PERCHÉ COSÌ.
--
-- Non si copiano permessi né si aggiungono policy: si cambia la RISPOSTA a due
-- domande che tutte le policy già fanno.
--
--   current_team_id()  «di quale società fa parte chi sta chiedendo?»
--   my_role()          «e con che ruolo?»
--
-- Quando un amministratore di piattaforma è ENTRATO in una società, la prima
-- risponde con quella società e la seconda con 'admin'. Tutto il resto del
-- database — le decine di policy scritte in tre anni — continua a funzionare
-- senza sapere che esiste un SuperAdmin. È la differenza fra aggiungere una
-- porta di servizio a ogni stanza e cambiare quello che dice il badge.
--
-- COSA COMPORTA, detto chiaramente: dentro una società un SuperAdmin può
-- leggere e modificare tutto quello che può un suo amministratore, dati
-- personali degli atleti compresi. È il potere che serve per assistere, ed è
-- lo stesso che serve per sbagliare. Per questo ogni ingresso lascia una riga
-- in `platform_visits`, e chi è entrato lo vede scritto in cima a ogni
-- schermata finché non esce.
-- ============================================================================


-- ============================================================================
-- 1. DOVE SI TROVA ADESSO
-- ============================================================================
-- Una riga per amministratore di piattaforma, e solo mentre è dentro: uscire
-- cancella la riga invece di metterla a null, così «non c'è riga» e «non sono
-- dentro» sono la stessa cosa e non si può sbagliare a leggerla.

create table if not exists platform_presence (
  user_id uuid primary key references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  entered_at timestamptz not null default now()
);

alter table platform_presence enable row level security;
-- Nessuna policy: non si legge né si scrive dal client. Solo le funzioni qui
-- sotto la toccano, e ognuna controlla prima chi sta chiamando.


-- ============================================================================
-- 2. IL REGISTRO DEGLI INGRESSI
-- ============================================================================
-- Non è burocrazia: è l'unica cosa che, fra sei mesi, permette di rispondere
-- alla domanda «chi ha guardato i miei dati, e quando».

create table if not exists platform_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  at timestamptz not null default now()
);

alter table platform_visits enable row level security;

create index if not exists platform_visits_team_idx on platform_visits(team_id, at desc);


-- ============================================================================
-- 3. LE DUE DOMANDE, CON LA RISPOSTA NUOVA
-- ============================================================================

-- Di quale società fa parte chi sta chiedendo.
--
-- Prima la presenza di piattaforma, poi il profilo. L'ordine conta: un
-- SuperAdmin che ha anche un profilo suo — capita, se amministra la
-- piattaforma e una società — mentre è dentro un'altra società deve vedere
-- QUELLA, altrimenti entrare non farebbe niente.
create or replace function current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select pp.team_id from platform_presence pp where pp.user_id = auth.uid()),
    (select p.team_id from profiles p where p.id = auth.uid() and p.active)
  )
$$;

-- E con che ruolo.
--
-- Dentro una società un amministratore di piattaforma vale un amministratore:
-- non perché sia comodo, ma perché è il solo ruolo che gli permette di vedere
-- il problema che gli stanno segnalando. is_admin(), is_team_manager() e
-- has_sector_access() sono già scritte in termini di questa funzione, quindi
-- si allineano da sole.
create or replace function my_role()
returns text language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from platform_presence pp where pp.user_id = auth.uid()) then 'admin'
    else (select p.role from profiles p where p.id = auth.uid() and p.active)
  end
$$;


-- ============================================================================
-- 4. ENTRA, ESCI, DOVE SONO
-- ============================================================================

create or replace function enter_society(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
begin
  if not am_i_platform_owner() then
    raise exception 'Solo un amministratore di piattaforma può entrare in una società.';
  end if;

  select name into v_nome from teams where id = p_team_id;
  if v_nome is null then
    raise exception 'Società inesistente.';
  end if;

  insert into platform_presence (user_id, team_id, entered_at)
  values (auth.uid(), p_team_id, now())
  on conflict (user_id) do update set team_id = excluded.team_id, entered_at = now();

  insert into platform_visits (user_id, team_id) values (auth.uid(), p_team_id);

  return jsonb_build_object('team_id', p_team_id, 'name', v_nome);
end;
$$;

create or replace function leave_society()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nessun controllo sul ruolo: uscire deve riuscire sempre. Se il ruolo di
  -- piattaforma viene revocato mentre si è dentro, restare bloccati lì dentro
  -- sarebbe il peggiore dei due mondi.
  delete from platform_presence where user_id = auth.uid();
end;
$$;

-- Dove sono adesso, e di chi è quella società. Restituisce null quando non si
-- è dentro da nessuna parte: è la domanda che l'app fa a ogni avvio.
create or replace function current_society()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'team_id', t.id,
           'name', t.name,
           'city', t.city,
           'entered_at', pp.entered_at
         )
  from platform_presence pp
  join teams t on t.id = pp.team_id
  where pp.user_id = auth.uid()
$$;

grant execute on function enter_society(uuid) to authenticated;
grant execute on function leave_society() to authenticated;
grant execute on function current_society() to authenticated;


-- ============================================================================
-- 5. CHI È ENTRATO QUI, E QUANDO
-- ============================================================================
-- Visibile a chi amministra la piattaforma e agli amministratori della società
-- visitata: il registro serve a poco se lo può leggere solo chi ci è entrato.

create or replace function society_visits(p_team_id uuid)
returns table (email text, at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not am_i_platform_owner()
     and not (is_admin() and p_team_id = current_team_id()) then
    raise exception 'Non autorizzato.';
  end if;

  return query
    select u.email::text, v.at
    from platform_visits v
    join auth.users u on u.id = v.user_id
    where v.team_id = p_team_id
    order by v.at desc
    limit 100;
end;
$$;

grant execute on function society_visits(uuid) to authenticated;

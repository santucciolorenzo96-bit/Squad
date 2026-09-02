-- ============================================================================
-- Team Manager Basket — migrazione 016
-- Lo sport della società: fondamenta per calcio e pallavolo
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 015.
--
-- Tutto quello che esiste oggi è pallacanestro, quindi il default è 'basket':
-- le società già registrate non cambiano di una virgola.
--
-- Lo sport NON è modificabile dall'interfaccia dopo la creazione: cambiarlo con
-- partite già in archivio lascerebbe tabellini di uno sport dentro una società
-- di un altro. Si corregge solo da qui, consapevolmente.
-- ============================================================================

alter table teams add column sport text not null default 'basket'
  check (sport in ('basket', 'calcio', 'pallavolo'));

-- La classifica cambia forma con lo sport: il calcio ha il pareggio, la
-- pallavolo il rapporto set. `draws` è una colonna vera perché entra
-- nell'ordinamento; il resto sta in jsonb perché varia da sport a sport.
alter table standings add column draws int not null default 0;
alter table standings add column stats jsonb not null default '{}'::jsonb;

-- ============================================================================
-- create_team accetta lo sport
-- ============================================================================
-- `create or replace` con un numero diverso di parametri creerebbe una seconda
-- funzione invece di sostituire la prima, quindi la vecchia va rimossa. Il
-- default su p_sport tiene comunque valide le chiamate a quattro argomenti.

drop function if exists create_team(text, text, text, text);

create or replace function create_team(
  p_name text, p_city text, p_category text, p_display_name text,
  p_sport text default 'basket'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_code text;
  v_sport text;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per creare una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
  end if;

  v_sport := coalesce(nullif(trim(p_sport), ''), 'basket');
  if v_sport not in ('basket', 'calcio', 'pallavolo') then
    raise exception 'Sport non riconosciuto: %', v_sport;
  end if;

  v_code := upper(substr(md5(random()::text), 1, 6));
  insert into teams (name, city, category, sport, invite_code)
    values (p_name, p_city, p_category, v_sport, v_code)
    returning id into v_team_id;

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_team_id, p_display_name, 'admin');

  insert into sectors (team_id, name, sort_order)
    values (v_team_id, 'Prima Squadra', 0);

  return v_team_id;
end;
$$;

-- ============================================================================
-- Anteprima della società dal codice invito
-- ============================================================================
-- Serve a chi si sta registrando con un codice: prima di chiedergli email e
-- password gli si mostra in che società sta entrando. Un genitore che sbaglia
-- una lettera del codice se ne accorge subito, invece che dopo la conferma
-- email. È SECURITY DEFINER perché chi la chiama non è ancora autenticato.
--
-- Non espone nulla di più di quanto sappia già chi possiede il codice: nome,
-- città e sport della società. Nessun dato di persone.

create or replace function team_by_invite_code(p_invite_code text)
returns table (name text, city text, sport text)
language sql stable security definer set search_path = public as $$
  select t.name, t.city, t.sport
  from teams t
  where upper(t.invite_code) = upper(trim(p_invite_code))
  limit 1
$$;

grant execute on function team_by_invite_code(text) to anon, authenticated;

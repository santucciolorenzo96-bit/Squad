-- ============================================================================
-- SQUAD — migrazione 046
-- Chi entra in società: nessuno si dà poteri da solo, e nessuno entra di nascosto
-- ============================================================================
--
-- DUE COSE CHE NON ANDAVANO
--
-- 1. Il codice della società accettava anche il ruolo «staff». E `staff` non è
--    un'etichetta: rientra in is_team_manager(), cioè gestisce anagrafica,
--    documenti, presenze, allenamenti e calendario. Quel codice gira nelle
--    chat dei genitori, e chiunque ce l'avesse poteva dichiararsi dirigente.
--    Era l'unico punto in cui il codice consegnava POTERE invece che accesso.
--
-- 2. Chi si registrava entrava e basta: nessuno confermava che fosse davvero
--    chi diceva. Un codice che gira in una chat non è una prova di identità.
--
-- E UNA CHE MANCAVA
--
-- Chi si registra sa perfettamente di chi è il genitore, ma non aveva modo di
-- dirlo: il collegamento all'atleta lo faceva l'amministratore a mano, uno per
-- uno, indovinando dai nomi. È così che tre atleti sono finiti registrati come
-- genitori. Adesso chi entra SCRIVE il nome del proprio atleta, e
-- l'amministratore conferma invece di indovinare.
--
-- PERCHÉ SI SCRIVE E NON SI SCEGLIE DA UN ELENCO
--
-- Un elenco da cui scegliere vorrebbe dire mostrare i nomi di tutti i
-- ragazzi della società a chiunque abbia il codice, prima ancora di sapere chi
-- è. Il nome scritto a mano non svela niente, e all'amministratore basta lo
-- stesso: l'applicazione gli propone l'atleta che somiglia di più, e lui
-- conferma con un tocco.

-- ============================================================================
-- 1. LE COLONNE
-- ============================================================================

alter table profiles add column if not exists approved_at timestamptz;
alter table profiles add column if not exists approved_by uuid references profiles(id);
-- Il nome dell'atleta come l'ha scritto chi si è registrato. Resta anche dopo
-- l'approvazione: se il collegamento risultasse sbagliato, è l'unica cosa che
-- dice cosa aveva dichiarato quella persona.
alter table profiles add column if not exists claim_note text;

-- Chi c'è già è approvato: è entrato quando la porta non c'era, e chiudergliela
-- addosso adesso vorrebbe dire buttare fuori la società intera.
update profiles set approved_at = coalesce(approved_at, created_at) where approved_at is null;


-- ============================================================================
-- 2. FINCHÉ NON SEI APPROVATO, NON SEI DENTRO
-- ============================================================================
-- current_team_id() è la porta da cui passano tutte le regole di questo
-- database: se torna null, non si legge e non si scrive niente. È il modo più
-- semplice e il più difficile da aggirare — non c'è una tabella da ricordarsi
-- di proteggere, perché sono già tutte protette da questa.

create or replace function current_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select coalesce(
    (select pp.team_id from platform_presence pp where pp.user_id = auth.uid()),
    (select p.team_id from profiles p
      where p.id = auth.uid() and p.active and p.approved_at is not null)
  )
$$;

-- Ma la propria riga bisogna poterla leggere lo stesso, altrimenti chi aspetta
-- non vede nemmeno di stare aspettando: l'applicazione crederebbe che non
-- esista nessun profilo e lo rimanderebbe alla registrazione, all'infinito.
drop policy if exists "profiles_select_self" on profiles;
create policy "profiles_select_self" on profiles for select
  using (id = auth.uid());

-- E gli amministratori devono vedere chi sta aspettando: la loro riga ha
-- team_id ma non passa da current_team_id(), quindi profiles_select_team non
-- la trova.
drop policy if exists "profiles_select_pending_admin" on profiles;
create policy "profiles_select_pending_admin" on profiles for select
  using (
    approved_at is null
    and exists (
      select 1 from profiles me
       where me.id = auth.uid() and me.active and me.approved_at is not null
         and me.team_id = profiles.team_id
         and me.role in ('admin', 'presidente')
    )
  );


-- ============================================================================
-- 3. IL CODICE DELLA SOCIETÀ DÀ SOLO ACCESSO, MAI POTERE
-- ============================================================================

create or replace function join_team(
  p_invite_code text, p_display_name text, p_role text default 'genitore',
  p_claim text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per entrare in una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
  end if;

  -- Solo famiglia. Staff e segnapunti hanno responsabilità, e chi ha
  -- responsabilità lo decide la società: si entra con un invito personale,
  -- creato da un amministratore, che è già di per sé l'approvazione.
  if p_role not in ('genitore', 'atleta') then
    raise exception 'Con il codice della società si entra come atleta o come genitore. Per entrare nello staff serve un invito personale.';
  end if;

  select id into v_team_id from teams where invite_code = upper(trim(p_invite_code));
  if v_team_id is null then
    raise exception 'Codice invito non valido';
  end if;

  -- approved_at resta null: la società deve confermare.
  insert into profiles (id, team_id, display_name, role, claim_note)
    values (auth.uid(), v_team_id, p_display_name, p_role, nullif(trim(p_claim), ''));

  return v_team_id;
end;
$$;

-- L'invito personale invece è già l'approvazione: l'ha creato un
-- amministratore, che sapeva chi stava invitando e a cosa.
create or replace function join_team_with_invite(
  p_code text, p_display_name text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites;
  v_sector uuid;
begin
  if auth.uid() is null then
    raise exception 'Devi essere autenticato per entrare in una squadra';
  end if;
  if exists (select 1 from profiles where id = auth.uid()) then
    raise exception 'Questo account ha già una squadra associata';
  end if;

  select * into v_invite from invites
    where upper(code) = upper(trim(p_code))
    for update;

  if v_invite.id is null then
    raise exception 'Codice invito non valido';
  end if;
  if v_invite.revoked_at is not null then
    raise exception 'Questo invito è stato revocato';
  end if;
  if v_invite.used_at is not null then
    raise exception 'Questo invito è già stato usato';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Questo invito è scaduto';
  end if;

  insert into profiles (id, team_id, display_name, role, approved_at, approved_by)
    values (auth.uid(), v_invite.team_id, p_display_name, v_invite.role,
            now(), v_invite.created_by);

  foreach v_sector in array v_invite.sector_ids loop
    insert into profile_sectors (profile_id, sector_id)
      values (auth.uid(), v_sector)
      on conflict do nothing;
  end loop;

  if v_invite.player_id is not null then
    insert into profile_players (profile_id, player_id)
      values (auth.uid(), v_invite.player_id)
      on conflict do nothing;
  end if;

  update invites set used_at = now(), used_by = auth.uid() where id = v_invite.id;

  return v_invite.team_id;
end;
$$;


-- ============================================================================
-- 4. CHI STA ASPETTANDO
-- ============================================================================
-- Una funzione e non una query: chi aspetta non passa da current_team_id(),
-- quindi una select normale dovrebbe appoggiarsi alla policy qui sopra, e
-- restituire comunque qualcosa di comodo da leggere costerebbe una join che è
-- meglio scrivere una volta sola.

create or replace function chi_aspetta()
returns table (
  id uuid,
  display_name text,
  role text,
  claim_note text,
  created_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.role, p.claim_note, p.created_at
    from profiles p
   where p.approved_at is null
     and p.team_id = (select me.team_id from profiles me
                       where me.id = auth.uid() and me.active
                         and me.approved_at is not null)
     and exists (select 1 from profiles me
                  where me.id = auth.uid() and me.role in ('admin', 'presidente'))
   order by p.created_at;
$$;

grant execute on function chi_aspetta() to authenticated;


-- ============================================================================
-- 5. APPROVARE
-- ============================================================================
-- Approvare e collegare l'atleta sono lo stesso gesto: l'amministratore sta
-- rispondendo a «sono il genitore di Luca», e rispondere di sì senza fare il
-- collegamento vorrebbe dire lasciare a metà proprio la cosa che era stata
-- chiesta. Due scritture, una transazione.

create or replace function approva_iscritto(
  p_profile uuid, p_player uuid default null, p_role text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  select team_id into v_team from profiles
   where id = auth.uid() and active and approved_at is not null
     and role in ('admin', 'presidente');
  if v_team is null then
    raise exception 'Solo un amministratore può approvare chi si iscrive.';
  end if;

  if not exists (select 1 from profiles where id = p_profile and team_id = v_team) then
    raise exception 'Iscritto non trovato.';
  end if;

  -- Il ruolo si può correggere qui: è il momento in cui si guarda la persona,
  -- ed è più facile che accorgersene adesso che fra tre mesi. Restano fuori i
  -- ruoli che si assegnano dalla schermata Utenti.
  if p_role is not null and p_role not in ('genitore', 'atleta') then
    raise exception 'Da qui si conferma come atleta o come genitore.';
  end if;

  update profiles
     set approved_at = now(),
         approved_by = auth.uid(),
         role = coalesce(p_role, role)
   where id = p_profile;

  if p_player is not null then
    if not exists (select 1 from players where id = p_player and team_id = v_team) then
      raise exception 'Atleta non trovato.';
    end if;
    insert into profile_players (profile_id, player_id)
      values (p_profile, p_player)
      on conflict do nothing;
  end if;
end;
$$;

grant execute on function approva_iscritto(uuid, uuid, text) to authenticated;


-- Rifiutare: la riga sparisce e l'account resta senza società, libero di
-- riprovare con il codice giusto. Non si disattiva — un profilo disattivato di
-- qualcuno che non è mai entrato è solo una riga che nessuno sa cosa sia.
create or replace function rifiuta_iscritto(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  select team_id into v_team from profiles
   where id = auth.uid() and active and approved_at is not null
     and role in ('admin', 'presidente');
  if v_team is null then
    raise exception 'Solo un amministratore può rifiutare un''iscrizione.';
  end if;

  delete from profiles
   where id = p_profile and team_id = v_team and approved_at is null;
end;
$$;

grant execute on function rifiuta_iscritto(uuid) to authenticated;

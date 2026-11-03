-- ============================================================================
-- 064 · UN CODICE PER GLI ATLETI DI UNA CATEGORIA
-- ============================================================================
--
-- Un allenatore deve poter mandare un codice agli atleti della sua categoria,
-- e chi lo usa entra come atleta di quella categoria. Oggi non puo': creare un
-- inviti e' cosa da amministratore, e un invito vale una volta sola.
--
-- Ma prima di aprire quella porta c'e' da chiudere un buco, perche' e' proprio
-- questo il meccanismo che la userebbe.
--
--
-- IL BUCO: profile_sectors NON E' «LA CATEGORIA DI UNO», E' UNA DELEGA
--
-- `join_team_with_invite` scrive le categorie dell'invito in `profile_sectors`.
-- Sembra innocuo — «questo atleta e' dell'Open A» — ma `profile_sectors` non
-- dice di che categoria sei: dice quale categoria GESTISCI. E
-- `has_sector_access()` non guarda il ruolo:
--
--     select is_admin() or exists (
--       select 1 from profile_sectors ps
--       where ps.profile_id = auth.uid() and ps.sector_id = p_sector_id)
--
-- Una riga la', e cinquantaquattro clausole di policy dicono si'. Queste sono
-- le scritture che si accontentano di quella riga sola, qualunque sia il ruolo:
--
--     calendar · games · next_match · player_sectors · standings
--     trainings · training_recurrences · training_attendance
--
-- Cioe': un atleta entrato con un invito che portava la sua categoria puo'
-- scrivere il calendario, aprire e modificare i tabellini, cambiare la
-- classifica, spostare gli allenamenti e segnare le presenze. Nessuno gliel'ha
-- dato: e' arrivato con l'invito.
--
-- Oggi ci si arriva per una strada stretta — la schermata nasconde le
-- categorie quando il ruolo e' atleta o genitore, ma le caselle gia' spuntate
-- restano spuntate se si cambia ruolo dopo averle spuntate — e sarebbe
-- diventata la strada principale: un codice di categoria per gli atleti ha la
-- categoria dentro per definizione.
--
-- La categoria di un atleta si sa dalla sua SCHEDA: `profile_players` dice di
-- chi e' la scheda, `player_sectors` dice in che categoria gioca. E' da la'
-- che `sectorIdsFor` ricava le categorie di una famiglia. `profile_sectors`
-- per un atleta non serve a niente — serve solo a dargli poteri.
--
--
-- COME FUNZIONA IL CODICE CONDIVISO
--
-- Un invito nominativo e' gia' l'approvazione: l'ha creato un amministratore
-- sapendo chi stava invitando. Un codice mandato in un gruppo no — si gira.
-- Quindi chi entra con un codice condiviso finisce in SALA D'ATTESA, come con
-- il codice societa', e chi ha creato il codice lo vede e lo conferma. Ma con
-- tre cose che il codice societa' non ha: il ruolo e' deciso prima e non si
-- dichiara, la categoria e' scritta sul codice, e il codice scade.
--
-- Chi conferma puo' essere l'allenatore, non solo l'amministratore — ma solo
-- per chi e' arrivato col SUO codice. Nessuno vede la sala d'attesa di un
-- altro.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Le colonne nuove
-- ----------------------------------------------------------------------------
-- `max_uses` null vale 1: gli inviti che esistono gia' sono nominativi e
-- restano a uso singolo senza toccarli. `uses` conta; `used_at` continua a
-- voler dire «finito», e si riempie quando il conto arriva al massimo — cosi'
-- tutti i controlli scritti su `used_at` restano giusti.
alter table invites add column if not exists max_uses int;
alter table invites add column if not exists uses int not null default 0;

-- Con che codice e' entrato: e' quello che permette a chi l'ha creato di
-- vedere chi sta aspettando senza vedere gli altri.
alter table profiles add column if not exists invite_id uuid
  references invites(id) on delete set null;

create index if not exists profiles_invite_idx on profiles(invite_id)
  where invite_id is not null;


-- ----------------------------------------------------------------------------
-- 2. Chiudere il buco su chi c'e' gia'
-- ----------------------------------------------------------------------------
-- Una riga in profile_sectors su un profilo atleta o genitore non e' una
-- categoria: e' un potere che nessuno ha voluto dare. Si toglie. Chi aiuta
-- davvero in una categoria ha un ruolo che lo dice — allenatore, staff — e
-- quel ruolo e' la leva giusta, non questa tabella.
--
-- La query di controllo in fondo dice quante erano e di chi.
delete from profile_sectors ps
 using profiles p
 where p.id = ps.profile_id
   and p.role in ('genitore', 'atleta');


-- ----------------------------------------------------------------------------
-- 3. Creare un invito: anche un allenatore, per le sue categorie
-- ----------------------------------------------------------------------------
-- Un amministratore puo' tutto, come prima. Chi gestisce una categoria puo'
-- invitare SOLO atleti e genitori, SOLO nelle categorie che gestisce, e solo
-- collegandoli a schede di quelle categorie. Non puo' creare staff: chi ha
-- responsabilita' lo decide la societa'.
--
-- La vecchia firma a sei parametri va eliminata, non sostituita: lasciandola
-- in piedi, una chiamata a sei argomenti corrisponderebbe a tutte e due le
-- funzioni e Postgres rifiuterebbe la chiamata come ambigua.
drop function if exists create_invite(text, uuid, uuid[], text, text, int);

create or replace function create_invite(
  p_role text,
  p_player_id uuid default null,
  p_sector_ids uuid[] default '{}',
  p_label text default null,
  p_note text default null,
  p_days_valid int default 14,
  p_max_uses int default 1
) returns invites
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_invite invites;
  v_sector uuid;
  v_max int;
begin
  v_team_id := current_team_id();
  if v_team_id is null then
    raise exception 'Nessuna società associata a questo account';
  end if;

  if p_role not in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta') then
    raise exception 'Ruolo non valido';
  end if;

  v_max := coalesce(p_max_uses, 1);
  if v_max < 1 then
    raise exception 'Un invito vale almeno una volta';
  end if;
  -- Un codice senza limite e' il codice società da capo: uno che gira per
  -- sempre e fa entrare chiunque lo trovi.
  if v_max > 200 then
    raise exception 'Un codice vale al massimo per 200 persone';
  end if;

  if not is_admin() then
    if not is_team_manager() then
      raise exception 'Solo chi gestisce una categoria può creare inviti';
    end if;
    if p_role not in ('genitore','atleta') then
      raise exception 'Puoi invitare atleti e genitori. Per lo staff serve un amministratore.';
    end if;
    if coalesce(array_length(p_sector_ids, 1), 0) = 0 then
      raise exception 'Scegli la categoria: un invito senza categoria lo crea un amministratore';
    end if;
    foreach v_sector in array p_sector_ids loop
      if not can_manage_sector(v_sector) then
        raise exception 'Puoi invitare solo nelle categorie che gestisci';
      end if;
    end loop;
    if p_player_id is not null and not can_manage_player(p_player_id) then
      raise exception 'Questo atleta non è in una categoria che gestisci';
    end if;
  end if;

  if p_player_id is not null then
    if not exists (select 1 from players where id = p_player_id and team_id = v_team_id) then
      raise exception 'Il giocatore indicato non appartiene a questa società';
    end if;
    if p_role not in ('genitore','atleta') then
      raise exception 'Solo un genitore o un atleta si collegano a una scheda giocatore';
    end if;
    -- Un codice per piu' persone non puo' portare UNA scheda: la seconda
    -- persona si ritroverebbe collegata alla scheda della prima.
    if v_max > 1 then
      raise exception 'Un codice per più persone non può essere collegato a una scheda';
    end if;
  end if;

  foreach v_sector in array coalesce(p_sector_ids, '{}') loop
    if not exists (select 1 from sectors where id = v_sector and team_id = v_team_id) then
      raise exception 'Una delle categorie indicate non appartiene a questa società';
    end if;
  end loop;

  insert into invites (team_id, code, role, player_id, sector_ids, label, note,
                       expires_at, created_by, max_uses)
  values (
    v_team_id,
    generate_invite_token(),
    p_role,
    p_player_id,
    coalesce(p_sector_ids, '{}'),
    nullif(trim(coalesce(p_label, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    case when p_days_valid is null or p_days_valid <= 0 then null
         else now() + make_interval(days => p_days_valid) end,
    auth.uid(),
    v_max
  )
  returning * into v_invite;

  return v_invite;
end;
$$;
grant execute on function create_invite(text, uuid, uuid[], text, text, int, int) to authenticated;


-- ----------------------------------------------------------------------------
-- 4. Entrare con un invito
-- ----------------------------------------------------------------------------
-- Tre cambiamenti: le categorie non diventano piu' una delega per chi non
-- gestisce niente; un codice condiviso si puo' usare piu' volte e chi lo usa
-- aspetta conferma; e si registra con che codice si e' entrati.
--
-- Anche qui la vecchia firma va eliminata, per la stessa ragione di sopra:
-- con due funzioni, una chiamata a due argomenti sarebbe ambigua.
drop function if exists join_team_with_invite(text, text);

create or replace function join_team_with_invite(
  p_code text, p_display_name text, p_claim text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_invite invites;
  v_sector uuid;
  v_max int;
  v_condiviso boolean;
  v_claim text;
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
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception 'Questo invito è scaduto';
  end if;

  v_max := coalesce(v_invite.max_uses, 1);
  if v_invite.used_at is not null or v_invite.uses >= v_max then
    raise exception 'Questo invito è già stato usato';
  end if;
  v_condiviso := v_max > 1;

  -- Chi entra con un codice condiviso dice di chi e' la scheda. Per un atleta
  -- la risposta e' il suo nome, che ha appena scritto: non si chiede due volte
  -- la stessa cosa.
  v_claim := nullif(trim(coalesce(
    p_claim,
    case when v_invite.role = 'atleta' then p_display_name else null end
  )), '');

  /* UN INVITO NOMINATIVO E' GIA' L'APPROVAZIONE, UN CODICE CONDIVISO NO.
     Il primo l'ha creato qualcuno sapendo chi stava invitando. Il secondo e'
     un codice mandato in un gruppo, e un gruppo si gira. */
  insert into profiles (id, team_id, display_name, role, claim_note, invite_id,
                        approved_at, approved_by)
    values (auth.uid(), v_invite.team_id, p_display_name, v_invite.role,
            v_claim, v_invite.id,
            case when v_condiviso then null else now() end,
            case when v_condiviso then null else v_invite.created_by end);

  /* LE CATEGORIE DELL'INVITO SOLO A CHI GESTISCE.
     `profile_sectors` non dice di che categoria sei, dice quale categoria
     gestisci: `has_sector_access()` non guarda il ruolo, e una riga qui vale
     la scrittura su calendario, tabellini, classifica, allenamenti e presenze.
     Per un atleta o un genitore la categoria si sa dalla scheda collegata —
     `profile_players` piu` `player_sectors` — e una riga qui gli darebbe
     soltanto dei poteri che nessuno ha voluto dargli.
     `segnapunti` resta fra chi gestisce: segnare una partita e` scrivere un
     tabellino, e quella riga e` cio` che glielo permette. */
  if v_invite.role in ('admin','presidente','allenatore','staff','segnapunti') then
    foreach v_sector in array v_invite.sector_ids loop
      insert into profile_sectors (profile_id, sector_id)
        values (auth.uid(), v_sector)
        on conflict do nothing;
    end loop;
  end if;

  if v_invite.player_id is not null then
    insert into profile_players (profile_id, player_id)
      values (auth.uid(), v_invite.player_id)
      on conflict do nothing;
  end if;

  -- `uses` dentro la update e' il valore di prima: il conto arriva al massimo
  -- con questo ingresso, e allora l'invito e' finito.
  update invites
     set uses = uses + 1,
         used_at = case when uses + 1 >= v_max then now() else used_at end,
         used_by = case when v_max = 1 then auth.uid() else used_by end
   where id = v_invite.id;

  return v_invite.team_id;
end;
$$;
grant execute on function join_team_with_invite(text, text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- 4b. L'anteprima dice anche che il codice e' condiviso
-- ----------------------------------------------------------------------------
-- Chi si registra con un codice condiviso ha bisogno di sapere due cose che
-- con un invito nominativo non valgono: che dovra' aspettare una conferma, e
-- che il nome che scrive serve a riconoscerlo in rosa. Senza dirglielo, scrive
-- «Giorgio» e chi conferma non sa chi sia.
--
-- Il tipo di ritorno cambia: la funzione va eliminata, non sostituita.
drop function if exists invite_preview(text);

create or replace function invite_preview(p_code text)
returns table (team_name text, city text, sport text, role text,
               player_name text, sector_names text[], condiviso boolean)
language sql stable security definer set search_path = public as $$
  select
    t.name, t.city, t.sport, i.role,
    p.name,
    coalesce(array(select s.name from sectors s where s.id = any(i.sector_ids) order by s.sort_order), '{}'),
    coalesce(i.max_uses, 1) > 1
  from invites i
  join teams t on t.id = i.team_id
  left join players p on p.id = i.player_id
  where upper(i.code) = upper(trim(p_code))
    and i.used_at is null
    and i.revoked_at is null
    and coalesce(i.uses, 0) < coalesce(i.max_uses, 1)
    and (i.expires_at is null or i.expires_at > now())
  limit 1
$$;

grant execute on function invite_preview(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- 5. Chi sta aspettando
-- ----------------------------------------------------------------------------
-- Un amministratore vede tutti, come prima. Chi ha creato un codice vede chi
-- e' entrato con QUEL codice — e nient'altro: la sala d'attesa di un'altra
-- categoria non e' cosa sua.
--
-- Il tipo di ritorno cambia, e un tipo di ritorno non si sostituisce: la
-- funzione va eliminata prima.
drop function if exists chi_aspetta();

create or replace function chi_aspetta()
returns table (
  id uuid,
  display_name text,
  role text,
  claim_note text,
  created_at timestamptz,
  invito text,
  categorie text[]
)
language sql stable security definer set search_path = public as $$
  select p.id, p.display_name, p.role, p.claim_note, p.created_at,
         i.label,
         coalesce(array(select s.name from sectors s
                         where s.id = any(coalesce(i.sector_ids, '{}'))
                         order by s.sort_order), '{}')
    from profiles p
    left join invites i on i.id = p.invite_id
   where p.approved_at is null
     and p.team_id = (select me.team_id from profiles me
                       where me.id = auth.uid() and me.active
                         and me.approved_at is not null)
     and (
       exists (select 1 from profiles me
                where me.id = auth.uid() and me.role in ('admin', 'presidente'))
       or (i.id is not null and i.created_by = auth.uid())
     )
   order by p.created_at;
$$;

grant execute on function chi_aspetta() to authenticated;


-- ----------------------------------------------------------------------------
-- 6. Confermare e rifiutare
-- ----------------------------------------------------------------------------
-- Chi ha creato il codice conferma chi e' arrivato col suo codice. Il ruolo lo
-- puo' correggere fra atleta e genitore, come un amministratore, e la scheda a
-- cui collega deve essere di una categoria che gestisce.
create or replace function approva_iscritto(
  p_profile uuid, p_player uuid default null, p_role text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
  v_capo boolean;
  v_mio boolean;
begin
  select team_id into v_team from profiles
   where id = auth.uid() and active and approved_at is not null;
  if v_team is null then
    raise exception 'Solo un amministratore può approvare chi si iscrive.';
  end if;

  v_capo := my_role() in ('admin', 'presidente');
  v_mio := exists (
    select 1 from profiles p join invites i on i.id = p.invite_id
     where p.id = p_profile and i.created_by = auth.uid()
  );
  if not v_capo and not v_mio then
    raise exception 'Puoi confermare solo chi è entrato con un codice che hai creato tu.';
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
    -- Un amministratore collega a qualunque scheda; un allenatore solo alle
    -- schede delle sue categorie, come in ogni altra schermata.
    if not v_capo and not can_manage_player(p_player) then
      raise exception 'Questa scheda non è in una categoria che gestisci.';
    end if;
    insert into profile_players (profile_id, player_id)
      values (p_profile, p_player)
      on conflict do nothing;
  end if;
end;
$$;

grant execute on function approva_iscritto(uuid, uuid, text) to authenticated;


create or replace function rifiuta_iscritto(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  select team_id into v_team from profiles
   where id = auth.uid() and active and approved_at is not null;
  if v_team is null then
    raise exception 'Solo un amministratore può rifiutare un''iscrizione.';
  end if;

  if not (my_role() in ('admin', 'presidente')) and not exists (
    select 1 from profiles p join invites i on i.id = p.invite_id
     where p.id = p_profile and i.created_by = auth.uid()
  ) then
    raise exception 'Puoi rifiutare solo chi è entrato con un codice che hai creato tu.';
  end if;

  delete from profiles
   where id = p_profile and team_id = v_team and approved_at is null;
end;
$$;

grant execute on function rifiuta_iscritto(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 7. Vedere e revocare il proprio codice
-- ----------------------------------------------------------------------------
-- L'elenco degli inviti contiene i codici in chiaro: un allenatore vede i
-- SUOI, non quelli delle altre categorie. Le policy permissive si sommano in
-- OR, quindi questa aggiunge senza togliere niente all'amministratore.
drop policy if exists "invites_creatore_select" on invites;
create policy "invites_creatore_select" on invites for select
  using (team_id = current_team_id() and created_by = auth.uid());

create or replace function revoke_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv invites;
begin
  select * into v_inv from invites
   where id = p_invite_id and team_id = current_team_id();
  if v_inv.id is null then
    raise exception 'Invito non trovato';
  end if;
  if not is_admin() and v_inv.created_by <> auth.uid() then
    raise exception 'Puoi revocare solo un codice che hai creato tu';
  end if;
  -- Non si cancella: la riga resta, così chi ha invitato chi e quando rimane
  -- leggibile. Un codice condiviso si revoca anche se qualcuno l'ha già usato
  -- — serve a fermare gli altri, e chi è entrato è entrato.
  update invites set revoked_at = now() where id = p_invite_id;
end;
$$;

grant execute on function revoke_invite(uuid) to authenticated;


-- ============================================================================
-- CONTROLLO
-- ============================================================================
-- Una riga sola, sempre: un elenco vuoto non si distingue da «non ha
-- funzionato».
select
  (select count(*) from information_schema.columns
    where table_name = 'invites' and column_name in ('max_uses','uses')) = 2
    as colonne_invito,
  (select count(*) from information_schema.columns
    where table_name = 'profiles' and column_name = 'invite_id') = 1
    as colonna_profilo,
  (select count(*) from pg_proc where proname = 'create_invite') = 1
    as create_invite_unica,
  (select count(*) from pg_proc where proname = 'join_team_with_invite') = 1
    as join_unica,
  (select pg_get_function_result(oid) like '%invito%' from pg_proc
    where proname = 'chi_aspetta')
    as chi_aspetta_rifatta,
  (select count(*) from profile_sectors ps join profiles p on p.id = ps.profile_id
    where p.role in ('genitore','atleta')) = 0
    as deleghe_sbagliate_rimosse,
  (select pg_get_function_result(oid) like '%condiviso%' from pg_proc
    where proname = 'invite_preview')
    as anteprima_rifatta,
  (select count(*) from pg_policies
    where tablename = 'invites' and policyname = 'invites_creatore_select') = 1
    as policy_creatore;

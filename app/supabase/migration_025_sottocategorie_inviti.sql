-- ============================================================================
-- SQUAD — migrazione 025
-- Sottocategorie dei settori + inviti nominativi
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase.
--
-- Due cose distinte, in una sola migrazione perché la seconda usa la prima:
-- un invito può assegnare le categorie, e le categorie ora hanno una gerarchia.
-- ============================================================================


-- ============================================================================
-- 1. SOTTOCATEGORIE
-- ============================================================================
-- Una società con un solo "Under 15" non ha bisogno di niente. Una che ne ha
-- due squadre, o un minibasket diviso per annate, oggi deve mettere tutto sullo
-- stesso piano e distinguerle solo col nome: "U15 Blu", "U15 Bianca",
-- "Minibasket Aquilotti", "Minibasket Scoiattoli". Funziona finché sono poche.
--
-- Una sottocategoria È un settore, con un genitore. Non è una tabella nuova né
-- un concetto nuovo: rosa, allenamenti, partite, classifica, permessi e policy
-- continuano a lavorare per settore come hanno sempre fatto, e non sanno
-- nemmeno che esiste una gerarchia. L'unica cosa che cambia è come si presenta
-- l'elenco.

alter table sectors add column if not exists parent_id uuid references sectors(id) on delete cascade;

create index if not exists sectors_parent_idx on sectors(parent_id);

-- Un solo livello. Non per limitare: perché "Under 15 › Blu › Play" non
-- descrive niente che il nome non dica meglio, e ogni livello in più moltiplica
-- i selettori di settore che un allenatore deve attraversare per arrivare alla
-- propria rosa. Il vincolo sta nel database e non nell'interfaccia perché è
-- l'interfaccia a poter cambiare.
create or replace function sectors_depth_guard()
returns trigger language plpgsql as $$
begin
  if new.parent_id is not null then
    if new.parent_id = new.id then
      raise exception 'Una categoria non può essere sottocategoria di se stessa';
    end if;
    if exists (select 1 from sectors s where s.id = new.parent_id and s.parent_id is not null) then
      raise exception 'Le sottocategorie non possono avere a loro volta sottocategorie';
    end if;
    if exists (select 1 from sectors s where s.parent_id = new.id) then
      raise exception 'Questa categoria ha già delle sottocategorie: non può diventarne una';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sectors_depth_guard_trg on sectors;
create trigger sectors_depth_guard_trg
  before insert or update of parent_id on sectors
  for each row execute function sectors_depth_guard();


-- ============================================================================
-- 2. INVITI NOMINATIVI
-- ============================================================================
-- Il codice società è uno solo, uguale per tutti e permanente: chiunque lo
-- riceva sceglie da sé chi dice di essere, e può solo dichiararsi atleta,
-- genitore, scout o staff. Un allenatore va poi promosso a mano, le categorie
-- vanno assegnate a mano, e il collegamento fra un genitore e suo figlio va
-- fatto a mano. Tre passaggi manuali per ogni persona, ognuno dimenticabile —
-- e finché non li fai la persona è entrata ma non vede niente.
--
-- Un invito è un codice usa e getta che porta con sé quelle tre decisioni,
-- prese da chi invita, prima che la persona si registri.
--
-- PERCHÉ QUI I RUOLI CON POTERE SONO AMMESSI
--
-- join_team() rifiuta admin, presidente, allenatore e staff, e deve continuare
-- a farlo: là il codice è condiviso e permanente, quindi il ruolo lo sceglie
-- chi si registra. Qui il ruolo lo ha scritto un amministratore in un codice
-- creato apposta per una persona sola. Non è la stessa situazione, e trattarla
-- come tale costringerebbe a promuovere a mano proprio i casi che pesano.
--
-- Il codice diventa quindi una credenziale, e va trattato come tale:
--   - 12 caratteri da un alfabeto senza 0/O e 1/I/L (~10^18 combinazioni:
--     indovinarlo non è una strada);
--   - vale una volta sola, e chi lo usa resta scritto nella riga;
--   - scade, per impostazione predefinita dopo 14 giorni;
--   - si può revocare finché non è stato usato.
-- Resta il fatto che chi lo intercetta lo può spendere: è un invito, non
-- un'autenticazione. Vale quanto il canale su cui lo mandi.

create table if not exists invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  code text not null unique,
  role text not null check (role in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta')),
  player_id uuid references players(id) on delete cascade,
  sector_ids uuid[] not null default '{}',
  label text,
  note text,
  expires_at timestamptz,
  used_at timestamptz,
  used_by uuid references profiles(id) on delete set null,
  revoked_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists invites_team_idx on invites(team_id, created_at desc);

alter table invites enable row level security;

-- Chi può invitare può vedere gli inviti. Nessun altro: l'elenco contiene i
-- codici in chiaro, che è esattamente ciò che non deve circolare.
drop policy if exists "invites_admin_all" on invites;
create policy "invites_admin_all" on invites for all
  using (team_id = current_team_id() and is_admin())
  with check (team_id = current_team_id() and is_admin());


-- ----------------------------------------------------------------------------
-- Generazione del codice
-- ----------------------------------------------------------------------------
-- Alfabeto senza le coppie che si confondono lette ad alta voce o trascritte a
-- mano (0/O, 1/I/L): un invito si detta al telefono più spesso di quanto si
-- copi e incolli.
create or replace function generate_invite_token()
returns text language plpgsql as $$
declare
  v_alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_i int;
begin
  loop
    v_code := '';
    for v_i in 1..12 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from invites where code = v_code);
  end loop;
  return v_code;
end;
$$;


-- ----------------------------------------------------------------------------
-- Creare un invito
-- ----------------------------------------------------------------------------
-- SECURITY DEFINER perché deve poter leggere players e sectors per validarli
-- anche quando le policy di lettura non lo permetterebbero da sole. I controlli
-- di appartenenza sono qui sotto, espliciti: senza, un amministratore potrebbe
-- legare un invito a un giocatore di un'altra società.
create or replace function create_invite(
  p_role text,
  p_player_id uuid default null,
  p_sector_ids uuid[] default '{}',
  p_label text default null,
  p_note text default null,
  p_days_valid int default 14
) returns invites
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
  v_invite invites;
  v_sector uuid;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può creare inviti';
  end if;
  v_team_id := current_team_id();
  if v_team_id is null then
    raise exception 'Nessuna società associata a questo account';
  end if;

  if p_role not in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta') then
    raise exception 'Ruolo non valido';
  end if;

  if p_player_id is not null then
    if not exists (select 1 from players where id = p_player_id and team_id = v_team_id) then
      raise exception 'Il giocatore indicato non appartiene a questa società';
    end if;
    if p_role not in ('genitore','atleta') then
      raise exception 'Solo un genitore o un atleta si collegano a una scheda giocatore';
    end if;
  end if;

  foreach v_sector in array coalesce(p_sector_ids, '{}') loop
    if not exists (select 1 from sectors where id = v_sector and team_id = v_team_id) then
      raise exception 'Una delle categorie indicate non appartiene a questa società';
    end if;
  end loop;

  insert into invites (team_id, code, role, player_id, sector_ids, label, note, expires_at, created_by)
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
    auth.uid()
  )
  returning * into v_invite;

  return v_invite;
end;
$$;

grant execute on function create_invite(text, uuid, uuid[], text, text, int) to authenticated;


-- ----------------------------------------------------------------------------
-- Anteprima pubblica
-- ----------------------------------------------------------------------------
-- Serve prima della registrazione, quando non c'è ancora nessuna sessione.
-- Restituisce il minimo per far capire a chi si iscrive dove sta entrando e
-- come: società, ruolo, categorie e — se c'è — il nome del giocatore a cui
-- verrà collegato. Non restituisce mai il codice né chi l'ha creato, e su un
-- codice sbagliato non restituisce niente invece di dire perché: non è un
-- oracolo per distinguere un codice scaduto da uno inesistente.
create or replace function invite_preview(p_code text)
returns table (team_name text, city text, sport text, role text, player_name text, sector_names text[])
language sql stable security definer set search_path = public as $$
  select
    t.name, t.city, t.sport, i.role,
    p.name,
    coalesce(array(select s.name from sectors s where s.id = any(i.sector_ids) order by s.sort_order), '{}')
  from invites i
  join teams t on t.id = i.team_id
  left join players p on p.id = i.player_id
  where upper(i.code) = upper(trim(p_code))
    and i.used_at is null
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  limit 1
$$;

grant execute on function invite_preview(text) to anon, authenticated;


-- ----------------------------------------------------------------------------
-- Usare un invito
-- ----------------------------------------------------------------------------
-- Fa in un colpo solo quello che prima erano tre passaggi manuali: crea il
-- profilo col ruolo giusto, assegna le categorie, collega la scheda giocatore.
--
-- Il blocco del codice (`for update`) non è formalità: due registrazioni
-- simultanee con lo stesso invito, senza, creerebbero due profili privilegiati
-- da un codice usa e getta.
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

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_invite.team_id, p_display_name, v_invite.role);

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

grant execute on function join_team_with_invite(text, text) to authenticated;


-- ----------------------------------------------------------------------------
-- Revocare un invito
-- ----------------------------------------------------------------------------
-- Non si cancella: la riga resta, così chi ha invitato chi e quando rimane
-- leggibile. Un invito già usato non si revoca — togliere l'accesso a un
-- account esistente si fa dalla schermata Utenti, che è dove ci si aspetta di
-- trovarlo.
create or replace function revoke_invite(p_invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può revocare un invito';
  end if;
  update invites set revoked_at = now()
    where id = p_invite_id and team_id = current_team_id() and used_at is null;
end;
$$;

grant execute on function revoke_invite(uuid) to authenticated;

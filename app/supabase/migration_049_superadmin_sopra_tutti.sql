-- ============================================================================
-- SQUAD — migrazione 049
-- Il SuperAdmin è sopra le società, anche nell'anticamera
-- ============================================================================
--
-- IL MODELLO, DETTO UNA VOLTA
--
-- Sopra c'è il SuperAdmin: non appartiene a nessuna società, le vede tutte, e
-- quando ENTRA in una vale come un suo amministratore. Sotto ci sono le
-- società, ognuna con i propri amministratori, che vedono solo la loro.
--
-- Nel database questo modello è già scritto in due funzioni, e tutto il resto
-- si appoggia a quelle:
--
--   current_team_id()  guarda PRIMA platform_presence (la società visitata) e
--                      poi il profilo. Per un SuperAdmin dentro una società
--                      risponde quella, non la sua.
--   my_role()          risponde 'admin' a chiunque abbia una presenza aperta,
--                      e quindi is_admin() risponde di sì.
--
-- COSA AVEVO SBAGLIATO
--
-- Le tre funzioni dell'anticamera (migrazione 046) non passano da lì: si
-- chiedono a mano «di quale società sono amministratore?» leggendo profiles.
-- Per un amministratore di società la risposta è giusta. Per un SuperAdmin è
-- LA SUA società — non quella che sta visitando — quindi visitandone un'altra
-- non vedrebbe nessuno in attesa e non potrebbe approvare nessuno. E un
-- SuperAdmin puro, senza nessun profilo, resterebbe fuori del tutto.
--
-- La correzione è togliere quella domanda a mano e usare le due funzioni che
-- il modello ce l'hanno già dentro. Vale anche per sono_admin_della_societa()
-- della 048, che così smette pure di leggere profiles.

-- ============================================================================
-- 1. LA POLICY: CHI VEDE I PROFILI IN ATTESA
-- ============================================================================
-- Nessuna lettura di profiles qui dentro: is_admin() e current_team_id() sono
-- SECURITY DEFINER e la fanno loro, al riparo dalla ricorsione che ha bloccato
-- tutto ieri.

create or replace function sono_admin_della_societa(p_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() and p_team = current_team_id()
$$;


-- ============================================================================
-- 2. CHI STA ASPETTANDO
-- ============================================================================

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
     and is_admin()
     and p.team_id = current_team_id()
   order by p.created_at;
$$;


-- ============================================================================
-- 3. APPROVARE E RIFIUTARE
-- ============================================================================

create or replace function approva_iscritto(
  p_profile uuid, p_player uuid default null, p_role text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può approvare chi si iscrive.';
  end if;

  -- La società è quella in cui si sta operando adesso: per un amministratore
  -- è la sua, per un SuperAdmin è quella in cui è entrato.
  v_team := current_team_id();
  if v_team is null then
    raise exception 'Non sei dentro nessuna società.';
  end if;

  if not exists (select 1 from profiles where id = p_profile and team_id = v_team) then
    raise exception 'Iscritto non trovato.';
  end if;

  if p_role is not null and p_role not in ('genitore', 'atleta') then
    raise exception 'Da qui si conferma come atleta o come genitore.';
  end if;

  update profiles
     set approved_at = now(),
         -- approved_by ha una chiave esterna su profiles: un SuperAdmin PURO
         -- non ha un profilo da nessuna parte, e scriverci il suo uuid farebbe
         -- fallire l'approvazione con un errore di vincolo. Meglio non sapere
         -- chi ha aperto la porta che non poterla aprire.
         approved_by = (select me.id from profiles me where me.id = auth.uid()),
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

create or replace function rifiuta_iscritto(p_profile uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_team uuid;
begin
  if not is_admin() then
    raise exception 'Solo un amministratore può rifiutare un''iscrizione.';
  end if;

  v_team := current_team_id();
  if v_team is null then
    raise exception 'Non sei dentro nessuna società.';
  end if;

  delete from profiles
   where id = p_profile and team_id = v_team and approved_at is null;
end;
$$;


-- ============================================================================
-- NOTA SU «approved_by»
-- ============================================================================
-- Resta l'utente vero anche quando è un SuperAdmin: la colonna risponde a
-- «chi ha aperto la porta», e la risposta onesta è la persona, non il ruolo
-- con cui stava operando. Il suo profilo può stare in un'altra società: la
-- chiave esterna guarda profiles in generale, non la squadra, quindi regge.
--
-- Un SuperAdmin PURO invece un profilo non ce l'ha proprio, e scriverci il suo
-- uuid farebbe fallire l'approvazione con un errore di vincolo. In quel caso
-- la colonna resta vuota: non sapere chi ha aperto la porta è meno grave che
-- non poterla aprire.

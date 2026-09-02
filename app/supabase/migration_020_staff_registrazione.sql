-- ============================================================================
-- Team Manager Basket — migrazione 020
-- Lo staff può registrarsi da solo con il codice invito
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase.
--
-- Un allenatore che riceve il codice della società si trovava a scegliere fra
-- atleta, genitore e segnapunti: nessuna delle tre lo descrive. Finiva per
-- registrarsi come atleta e poi andava corretto a mano.
--
-- PERCHÉ È SICURO
--
-- `staff` da solo non dà nessun potere. Ogni scrittura di settore passa da
-- can_manage_sector(), che è is_team_manager() AND has_sector_access(), e
-- has_sector_access() richiede una riga esplicita in profile_sectors. Un
-- account appena registrato non ne ha nessuna: vede l'app, non può cambiare
-- niente. È l'amministratore che, dalla schermata Utenti, gli assegna le
-- categorie e — se è il caso — lo promuove ad Allenatore.
--
-- Restano NON auto-assegnabili i ruoli che hanno potere per sé: admin,
-- presidente e allenatore. Quelli continua a darli solo un amministratore.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Dipendenze dalla migrazione 011, che risulta non essere mai passata
-- ----------------------------------------------------------------------------
-- L'errore "function is_admin() does not exist" dice questo: is_admin esiste
-- solo nella 011. Ne discendono altre due cose, entrambe già attive adesso:
--
--   1. il vincolo sui ruoli è ancora quello della 002, che ammette solo
--      admin, allenatore, segnapunti e famiglia. Registrarsi come Genitore o
--      Atleta viene rifiutato dal database, e gli account che nell'elenco
--      Utenti compaiono come "UNDEFINED" hanno role = 'famiglia', un valore
--      che l'app non conosce più;
--   2. is_team_manager() è quella della 010, che elenca solo admin e
--      allenatore: uno staff non avrebbe alcun potere nemmeno con i settori
--      assegnati, e il presidente nemmeno.
--
-- Le righe qui sotto sono copiate senza modifiche dalla 011 e sono tutte
-- ripetibili, quindi questa migrazione funziona sia che la 011 sia passata sia
-- che non lo sia. Resta comunque consigliato eseguire la 011 per intero: porta
-- anche le policy su squadra, settori, rosa e loghi che qui non sono comprese.

-- Il vincolo si allarga, si migrano le righe vecchie, poi si stringe.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','presidente','staff','allenatore','segnapunti','famiglia','genitore','atleta'));

update profiles set role = 'genitore' where role = 'famiglia';

alter table profiles drop constraint profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta'));

create or replace function is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente')
$$;

create or replace function is_team_manager()
returns boolean language sql stable security definer set search_path = public as $$
  select my_role() in ('admin', 'presidente', 'allenatore', 'staff')
$$;

create or replace function can_manage_sector(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_team_manager() and has_sector_access(p_sector_id)
$$;

-- ----------------------------------------------------------------------------
-- La registrazione accetta anche lo staff
-- ----------------------------------------------------------------------------

create or replace function join_team(
  p_invite_code text, p_display_name text, p_role text default 'genitore'
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
  -- admin, presidente e allenatore restano assegnabili solo da un
  -- amministratore dalla schermata Utenti: hanno potere anche senza settori.
  if p_role not in ('staff', 'segnapunti', 'genitore', 'atleta') then
    raise exception 'Ruolo non valido in fase di registrazione';
  end if;

  select id into v_team_id from teams where invite_code = upper(trim(p_invite_code));
  if v_team_id is null then
    raise exception 'Codice invito non valido';
  end if;

  insert into profiles (id, team_id, display_name, role)
    values (auth.uid(), v_team_id, p_display_name, p_role);

  return v_team_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Chiusura di una falla che l'auto-registrazione dello staff renderebbe reale
-- ----------------------------------------------------------------------------
-- La policy di scrittura sulla classifica accettava `sector_id is null` per
-- chiunque fosse team manager, senza controllo di settore: sono righe legacy,
-- create prima che la classifica fosse divisa per categoria. Con lo staff che
-- può registrarsi da solo, quel varco diventerebbe l'unico punto in cui un
-- account appena creato e senza settori può scrivere. Le righe legacy restano
-- modificabili, ma solo da un amministratore.

drop policy if exists "standings_write_staff" on standings;
create policy "standings_write_staff" on standings for all
  using (
    team_id = current_team_id()
    and (can_manage_sector(sector_id) or (sector_id is null and is_admin()))
  )
  with check (
    team_id = current_team_id()
    and (can_manage_sector(sector_id) or (sector_id is null and is_admin()))
  );

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

-- ============================================================================
-- Chiusura di una falla che l'auto-registrazione dello staff renderebbe reale
-- ============================================================================
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

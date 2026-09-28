-- ============================================================================
-- SQUAD — migrazione 052
-- Il ruolo in campo: lo dice chi gioca, se non c'è ancora
-- ============================================================================
--
-- Playmaker, guardia, ala, centro. Nella scheda dell'atleta il campo c'era ma
-- lo vedeva solo la società: alle famiglie compariva «Ruolo —» e nessun modo
-- di riempirlo. update_linked_player_details() scrive data di nascita, codice
-- fiscale, telefono, email e altezza — il ruolo no, e non per una scelta
-- pensata: semplicemente non era stato messo.
--
-- Chi gioca il proprio ruolo lo sa. Ed è la stessa situazione del numero di
-- maglia: la persona che ha l'informazione non era quella che poteva scriverla.
--
-- STESSA REGOLA DEL NUMERO, E NON PER SIMMETRIA
--
-- Si sceglie UNA VOLTA, finché il campo è vuoto; cambiarlo dopo resta della
-- società. Due campi adiacenti con due regole diverse sarebbero solo confusi,
-- ma qui c'è anche una ragione tecnica: nella pallavolo il ruolo NON è
-- descrittivo. «Libero» e «Centrale» fanno funzionare il cambio automatico del
-- libero a ogni rotazione (migrazione dell'app, utils/rotazione.js). Un
-- genitore che cambiasse il ruolo a metà stagione sposterebbe le persone in
-- campo durante una partita, in silenzio.
--
-- Nel basket il ruolo è descrittivo e il rischio non c'è — ma la regola è una
-- sola per tutti gli sport, perché è la stessa schermata.
--
-- QUALI RUOLI SIANO VALIDI LO SA L'APP, NON IL DATABASE
--
-- L'elenco dipende dallo sport della società e vive nella configurazione
-- (basket.js, pallavolo.js, calcio.js). Duplicarlo qui vorrebbe dire due
-- elenchi che prima o poi divergono. Qui si controlla quello che il database
-- può controllare da solo: che sia tuo, che non ci sia già, e che sia una
-- stringa breve e non vuota.

create or replace function choose_my_position(p_player_id uuid, p_position text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_ruolo text;
  v_attuale text;
begin
  v_ruolo := nullif(trim(coalesce(p_position, '')), '');

  if v_ruolo is null then
    raise exception 'Scegli un ruolo.';
  end if;
  if length(v_ruolo) > 40 then
    raise exception 'Il ruolo è troppo lungo.';
  end if;

  -- Collegato a QUESTO atleta, non «a un atleta».
  if not exists (
    select 1 from profile_players pp
     where pp.profile_id = auth.uid() and pp.player_id = p_player_id
  ) then
    raise exception 'Questa scheda non è la tua.';
  end if;

  select nullif(trim(coalesce(role_position, '')), '') into v_attuale
    from players where id = p_player_id and team_id = current_team_id();

  if coalesce(v_attuale, '') <> '' then
    raise exception 'Il ruolo c''è già: per cambiarlo serve la società.';
  end if;

  update players set role_position = v_ruolo
   where id = p_player_id and team_id = current_team_id();

  return v_ruolo;
end;
$$;

grant execute on function choose_my_position(uuid, text) to authenticated;

-- ============================================================================
-- Team Manager Basket — migrazione 009
-- Chiude un'escalation di privilegi sulla tabella profiles
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 008.
--
-- PROBLEMA
-- La policy originale era:
--     create policy "profiles_update_self_name" on profiles for update
--       using (id = auth.uid());
-- Il commento accanto diceva "ognuno modifica il proprio display_name", ma RLS
-- in Postgres filtra per RIGA, non per COLONNA: quella regola permette a un
-- utente qualsiasi di aggiornare *ogni* campo della propria riga. Con la sola
-- chiave anonima e la propria sessione era quindi possibile eseguire
--     update profiles set role = 'admin' where id = <se stesso>
-- e diventare amministratore, oppure assegnarsi finance_role, oppure —
-- da quando esiste — can_upload_documents, aggirando il permesso che
-- l'amministratore concede da Utenti.
--
-- SOLUZIONE
-- Si toglie la policy di update libera e si espone una funzione che scrive i
-- soli campi che l'utente può legittimamente cambiare di sé. Stesso schema già
-- usato per update_linked_player_details nella migrazione 008.
-- ============================================================================

drop policy if exists "profiles_update_self_name" on profiles;

-- Nome visualizzato e telefono: gli unici campi del proprio profilo che
-- l'utente può modificare da sé. Ruolo, ruolo finanza, permesso documenti,
-- stato attivo e squadra restano all'amministratore.
create or replace function update_my_profile(p_display_name text, p_phone text)
returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row profiles;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  if coalesce(trim(p_display_name), '') = '' then
    raise exception 'Il nome non può essere vuoto';
  end if;

  update profiles
     set display_name = trim(p_display_name),
         phone        = nullif(trim(coalesce(p_phone, '')), '')
   where id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Profilo non trovato';
  end if;
  return v_row;
end;
$$;

-- Segna le notifiche come lette: scrittura innocua ma sul proprio profilo,
-- quindi passa anch'essa da qui ora che l'update diretto non è più permesso.
create or replace function mark_notifications_seen()
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := now();
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;
  update profiles set notifications_seen_at = v_now where id = auth.uid();
  return v_now;
end;
$$;

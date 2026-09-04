-- ============================================================================
-- Team Manager Basket — migrazione 024
-- Fotografia del profilo
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la 023.
--
-- Le iniziali restano il comportamento predefinito: funzionano sempre, non
-- chiedono niente a nessuno e per molti bastano. Chi vuole può mettere la
-- propria foto, con l'inquadratura scelta a mano — la stessa meccanica delle
-- foto dei giocatori, dove il ritaglio automatico tagliava le teste.
--
-- Il percorso passa da una funzione e non da una policy di update: le RLS
-- filtrano per riga e non per colonna, quindi un permesso di scrittura diretta
-- sul proprio profilo riaprirebbe l'auto-assegnazione del ruolo chiusa dalla
-- migrazione 009.
-- ============================================================================

alter table profiles add column avatar_path text;
alter table profiles add column avatar_focal_x numeric not null default 50;
alter table profiles add column avatar_focal_y numeric not null default 50;

create or replace function set_my_avatar(
  p_path text, p_focal_x numeric default 50, p_focal_y numeric default 50
) returns profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row profiles;
begin
  if auth.uid() is null then
    raise exception 'Non autenticato';
  end if;

  update profiles
     set avatar_path    = nullif(trim(coalesce(p_path, '')), ''),
         avatar_focal_x = least(greatest(coalesce(p_focal_x, 50), 0), 100),
         avatar_focal_y = least(greatest(coalesce(p_focal_y, 50), 0), 100)
   where id = auth.uid()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Profilo non trovato';
  end if;
  return v_row;
end;
$$;

-- ============================================================================
-- Deposito delle immagini
-- ============================================================================
-- Bucket privato: le foto si leggono con URL firmati a scadenza, come già
-- avviene per quelle dei giocatori. La cartella è l'id dell'utente, ed è su
-- quella che si regge tutto il controllo degli accessi.

insert into storage.buckets (id, name, public)
  values ('user-avatars', 'user-avatars', false)
  on conflict (id) do nothing;

-- Chi carica scrive solo nella propria cartella: senza questo controllo
-- chiunque potrebbe sovrascrivere la foto di un altro.
drop policy if exists "avatars_write_own" on storage.objects;
create policy "avatars_write_own" on storage.objects for insert
  with check (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_update_own" on storage.objects;
create policy "avatars_update_own" on storage.objects for update
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "avatars_delete_own" on storage.objects;
create policy "avatars_delete_own" on storage.objects for delete
  using (
    bucket_id = 'user-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- In lettura la foto la vedono i membri della stessa società: l'avatar compare
-- accanto al nome in elenchi che quelle persone vedono già.
drop policy if exists "avatars_read_team" on storage.objects;
create policy "avatars_read_team" on storage.objects for select
  using (
    bucket_id = 'user-avatars'
    and exists (
      select 1 from profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.team_id = current_team_id()
    )
  );

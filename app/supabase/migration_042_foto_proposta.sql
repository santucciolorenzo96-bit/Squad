-- ============================================================================
-- SQUAD — migrazione 042
-- La foto dell'atleta: la propone la famiglia, la pubblica la società
-- ============================================================================
--
-- La fotografia della rosa e' della societa': compare nello scout, in
-- anagrafica, nel referto, e la vedono tutti. Per questo la cambia chi gestisce
-- la categoria — l'abbiamo appena sistemato, perche' il pulsante lo vedevano
-- anche le famiglie e a loro il database rispondeva soltanto «new row violates
-- row-level security policy».
--
-- Ma la foto ce l'ha in mano la famiglia, non la societa': e' sul telefono di
-- un genitore, non nell'archivio del segretario. Chiudere del tutto la porta
-- vuol dire che la foto non arriva mai, ed e' esattamente cosa e' successo
-- finora.
--
-- Quindi lo stesso modello dei documenti, che in quest'app funziona gia':
-- CARICA LA FAMIGLIA, PUBBLICA LA SOCIETA'. Una foto inopportuna non finisce
-- in giro, e una foto buona non ha bisogno che qualcuno se la faccia mandare
-- per WhatsApp e la ricarichi.
--
-- La proposta vive accanto alla foto vera, non al suo posto: finche' non viene
-- pubblicata, in rosa e nello scout non cambia niente.

alter table players add column if not exists photo_pending_path text;
alter table players add column if not exists photo_pending_focal_x numeric not null default 50;
alter table players add column if not exists photo_pending_focal_y numeric not null default 50;
alter table players add column if not exists photo_pending_by uuid references profiles(id);
alter table players add column if not exists photo_pending_at timestamptz;


-- ============================================================================
-- 1. LA FAMIGLIA PUO' CARICARE, MA SOLO UNA PROPOSTA
-- ============================================================================
-- Il nome del file deve iniziare per «proposta_». Non e' una formalita': e' il
-- modo in cui una regola di storage puo' distinguere un file che aspetta
-- un'approvazione da uno pubblicato, senza doverlo chiedere a un'altra tabella.
--
-- Solo inserimento: aggiornare e cancellare restano della societa', altrimenti
-- una famiglia potrebbe sovrascrivere la foto gia' pubblicata di suo figlio —
-- o, con il percorso giusto, di un altro.

drop policy if exists "player_photos_storage_propose" on storage.objects;
create policy "player_photos_storage_propose" on storage.objects for insert
  with check (
    bucket_id = 'player-photos'
    and has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    and name like '%/proposta\_%'
  );


-- ============================================================================
-- 2. DEPOSITARE LA PROPOSTA
-- ============================================================================
-- Scrive SOLO le colonne della proposta, e solo sul proprio atleta: le policy
-- di Postgres sono per riga e non per colonna, quindi senza questa funzione
-- aprire la proposta vorrebbe dire aprire tutta l'anagrafica.

create or replace function propose_player_photo(
  p_player_id uuid, p_path text, p_focal_x numeric default 50, p_focal_y numeric default 50
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from profile_players pp
     where pp.profile_id = auth.uid() and pp.player_id = p_player_id
  ) then
    raise exception 'Questa scheda non è la tua.';
  end if;

  if coalesce(p_path, '') = '' then
    raise exception 'Manca la fotografia.';
  end if;

  update players set
    photo_pending_path = p_path,
    photo_pending_focal_x = coalesce(p_focal_x, 50),
    photo_pending_focal_y = coalesce(p_focal_y, 50),
    photo_pending_by = auth.uid(),
    photo_pending_at = now()
  where id = p_player_id;
end;
$$;

grant execute on function propose_player_photo(uuid, text, numeric, numeric) to authenticated;


-- ============================================================================
-- 3. LA SOCIETA' LO DEVE SAPERE
-- ============================================================================
-- Una proposta che resta in una colonna non l'ha proposta a nessuno. Stesso
-- posto delle notifiche dei documenti, perche' e' lo stesso gesto.

create or replace function notify_photo_proposed() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sector uuid;
begin
  if new.photo_pending_path is null
     or new.photo_pending_path is not distinct from old.photo_pending_path then
    return new;
  end if;

  select ps.sector_id into v_sector
    from player_sectors ps where ps.player_id = new.id limit 1;
  if v_sector is null then return new; end if;

  insert into notifications (team_id, sector_id, type, title, body, actor_id, link_tab)
    values (new.team_id, v_sector, 'photo_proposed',
            'Fotografia di ' || coalesce(new.name, 'un atleta'),
            'Proposta dalla famiglia, in attesa di pubblicazione', auth.uid(), 'anagrafica');
  return new;
end;
$$;

drop trigger if exists trg_photo_proposed on players;
create trigger trg_photo_proposed
  after update of photo_pending_path on players
  for each row execute function notify_photo_proposed();

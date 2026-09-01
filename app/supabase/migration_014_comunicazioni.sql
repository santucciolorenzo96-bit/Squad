-- ============================================================================
-- Team Manager Basket — migrazione 014
-- Comunicazioni strutturate: il messaggio diventa un flusso con risposte
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 013.
--
-- Le notifiche esistenti sono un feed in sola lettura per settore: nessuno
-- stato per destinatario, nessuna risposta. Una convocazione ha bisogno di
-- sapere CHI deve rispondere e CHI ha risposto, quindi serve un'entità propria.
--
-- I destinatari sono i GIOCATORI, non gli account: la convocazione riguarda
-- l'atleta, e rispondono per lui gli account collegati (genitore o atleta
-- stesso). Così una risposta resta valida anche se cambia chi segue il ragazzo.
-- ============================================================================

create table communications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid not null references sectors(id) on delete cascade,
  kind text not null default 'convocazione'
    check (kind in ('convocazione', 'trasferta', 'avviso')),
  title text not null,
  body text,
  event_date date,
  meet_time text,        -- ritrovo
  start_time text,       -- inizio gara o attività
  location text,
  requires_response boolean not null default true,
  respond_by date,
  closed_at timestamptz,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table communication_recipients (
  communication_id uuid not null references communications(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'declined')),
  note text,
  responded_at timestamptz,
  responded_by uuid references profiles(id),
  primary key (communication_id, player_id)
);

create index communications_sector_idx on communications(sector_id, event_date);
create index communication_recipients_player_idx on communication_recipients(player_id);

alter table communications enable row level security;
alter table communication_recipients enable row level security;

-- ============================================================================
-- Helper (SECURITY DEFINER: attraversano altre tabelle, quindi non devono
-- riattivarne le policy — è lo stesso accorgimento della migrazione 013)
-- ============================================================================

create or replace function communication_sector(p_comm_id uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select sector_id from communications where id = p_comm_id
$$;

-- Sono collegato a un giocatore fra i destinatari di questa comunicazione?
create or replace function is_my_communication(p_comm_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from communication_recipients cr
    join profile_players pp on pp.player_id = cr.player_id
    where cr.communication_id = p_comm_id and pp.profile_id = auth.uid()
  )
$$;

-- ============================================================================
-- RLS
-- ============================================================================

create policy "communications_select" on communications for select
  using (
    team_id = current_team_id()
    and (has_sector_access(sector_id) or is_my_communication(id))
  );

create policy "communications_write_staff" on communications for all
  using (team_id = current_team_id() and can_manage_sector(sector_id))
  with check (team_id = current_team_id() and can_manage_sector(sector_id));

create policy "communication_recipients_select" on communication_recipients for select
  using (
    has_sector_access(communication_sector(communication_id))
    or has_family_access_to_player(player_id)
  );

-- Lo staff compone e corregge l'elenco dei convocati. Le famiglie NON scrivono
-- qui direttamente: passano dalla funzione sotto, che tocca i soli campi della
-- risposta (RLS filtra per riga, non per colonna).
create policy "communication_recipients_write_staff" on communication_recipients for all
  using (can_manage_sector(communication_sector(communication_id)))
  with check (can_manage_sector(communication_sector(communication_id)));

-- ============================================================================
-- Risposta del destinatario
-- ============================================================================

create or replace function respond_to_communication(
  p_communication_id uuid, p_player_id uuid, p_status text, p_note text default null
) returns communication_recipients
language plpgsql security definer set search_path = public as $$
declare
  v_row communication_recipients;
  v_closed timestamptz;
begin
  if p_status not in ('confirmed', 'declined', 'pending') then
    raise exception 'Risposta non valida';
  end if;
  -- deve essere un giocatore collegato al mio account, oppure devo essere staff
  if not (has_family_access_to_player(p_player_id)
          or can_manage_sector(communication_sector(p_communication_id))) then
    raise exception 'Non sei autorizzato a rispondere per questo giocatore';
  end if;

  select closed_at into v_closed from communications where id = p_communication_id;
  if v_closed is not null then
    raise exception 'La comunicazione è chiusa: contatta la società';
  end if;

  update communication_recipients
     set status = p_status,
         note = p_note,
         responded_at = now(),
         responded_by = auth.uid()
   where communication_id = p_communication_id and player_id = p_player_id
  returning * into v_row;

  if v_row.player_id is null then
    raise exception 'Questo giocatore non è fra i destinatari';
  end if;
  return v_row;
end;
$$;

-- ============================================================================
-- Avviso nel campanello quando parte una comunicazione
-- ============================================================================

create or replace function notify_new_communication() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (team_id, sector_id, type, title, body, actor_id)
  values (
    new.team_id, new.sector_id, 'comunicazione',
    new.title,
    case when new.requires_response
         then 'Richiede conferma' || coalesce(' entro il ' || to_char(new.respond_by, 'DD/MM/YYYY'), '')
         else coalesce(new.body, '') end,
    new.created_by
  );
  return new;
end;
$$;

create trigger trg_notify_new_communication
after insert on communications
for each row execute function notify_new_communication();

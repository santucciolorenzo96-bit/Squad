-- ============================================================================
-- SQUAD — migrazione 044
-- Correggere un tabellino chiuso: una finestra breve, e la traccia di chi
-- ============================================================================
--
-- Cancellare un'intera partita si poteva (migrazione 035). Correggere un
-- canestro sbagliato no: l'unico rimedio era buttare via la partita e
-- rifarla a memoria. Per un errore di battitura.
--
-- COME SI CORREGGE
--
-- Riaprendo il tabellino nello scout, non con un secondo editor. Chi corregge
-- ha gia' in mano l'interfaccia con cui ha segnato, e un modulo diverso —
-- venti caselle numeriche su un telefono — sarebbe un posto nuovo dove
-- sbagliare. Il tabellino torna «in corso», si corregge, si richiude.
--
-- Mentre e' riaperto sparisce dallo storico e dalle statistiche: e' giusto,
-- perche' in quel momento e' un tabellino che non e' ancora vero. E l'indice
-- che permette una sola partita in corso per squadra impedisce di riaprirne
-- una mentre se ne sta giocando un'altra, che e' esattamente cio' che deve
-- succedere.
--
-- QUANDO
--
-- Entro 48 ore dalla fine, per chi poteva tenerla. Un errore ci si accorge la
-- sera stessa o il giorno dopo; passata una settimana, quel numero e' gia'
-- entrato in medie, classifiche e discorsi, e rimetterlo a posto e' una
-- decisione, non una correzione. Dopo le 48 ore resta l'amministratore, che
-- risponde di quella decisione.
--
-- L'applicazione dice la stessa cosa in `puoiCorreggere` (utils/regole.js).
-- Se le due si scollano, esce un pulsante che il database rifiuta.
--
-- E SEMPRE LA TRACCIA
--
-- Ogni riapertura e ogni richiusura lasciano una riga con chi, quando e il
-- punteggio prima e dopo. Non per sospetto: perche' un tabellino che cambia
-- dopo la partita, senza che si sappia chi l'ha cambiato, e' un tabellino di
-- cui non ci si fida piu'.

create table if not exists game_corrections (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  game_id uuid not null references games(id) on delete cascade,
  azione text not null check (azione in ('riaperta', 'richiusa')),
  chi uuid references profiles(id),
  quando timestamptz not null default now(),
  punteggio text
);

create index if not exists game_corrections_game_idx on game_corrections(game_id);

alter table game_corrections enable row level security;

-- Si legge: la traccia serve a chi guarda il referto, non a un revisore
-- immaginario. Non si scrive dal client — la scrivono la funzione e il
-- trigger qui sotto, che sono gli unici a sapere quando e' successo davvero.
drop policy if exists "game_corrections_select" on game_corrections;
create policy "game_corrections_select" on game_corrections for select
  using (team_id = current_team_id());


-- ============================================================================
-- RIAPRIRE
-- ============================================================================

create or replace function riapri_tabellino(p_game uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g record;
  v_altra uuid;
begin
  select * into g from games where id = p_game;
  if g is null or g.team_id <> current_team_id() then
    raise exception 'Partita non trovata.';
  end if;
  if g.status <> 'finished' then
    raise exception 'Questa partita è già aperta.';
  end if;

  -- Chi: chi poteva tenerla, entro 48 ore. Dopo, solo un amministratore.
  if not (
    is_admin()
    or (
      coalesce(g.ended_at, g.started_at) > now() - interval '48 hours'
      and (
        g.sector_id is null
        or has_sector_access(g.sector_id)
        or (has_family_access(g.sector_id) and family_can_score_matches())
      )
    )
  ) then
    raise exception 'Sono passate più di 48 ore: questa correzione la può fare un amministratore.';
  end if;

  -- Una sola partita in corso per squadra: e' un indice, e senza questo
  -- controllo l'errore che uscirebbe parlerebbe di vincoli e non di partite.
  select id into v_altra from games
   where team_id = g.team_id and status = 'live' and id <> p_game limit 1;
  if v_altra is not null then
    raise exception 'C''è già una partita in corso: chiudila prima di correggere questa.';
  end if;

  insert into game_corrections (team_id, game_id, azione, chi, punteggio)
    values (g.team_id, g.id, 'riaperta', auth.uid(),
            g.team_score::text || '-' || g.opp_score::text);

  update games set status = 'live', clock_running = false where id = p_game;
  return p_game;
end;
$$;

grant execute on function riapri_tabellino(uuid) to authenticated;


-- ============================================================================
-- RICHIUDERE
-- ============================================================================
-- Non e' una funzione: e' un trigger, perche' la richiusura avviene dal
-- percorso normale di fine partita e nessuno deve ricordarsi di registrarla.
-- Scatta solo se quella partita era stata riaperta per correzione — una
-- partita che finisce per la prima volta non e' una correzione.

create or replace function log_correzione_chiusa() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'live' and new.status = 'finished' and exists (
    select 1 from game_corrections c where c.game_id = new.id and c.azione = 'riaperta'
  ) then
    insert into game_corrections (team_id, game_id, azione, chi, punteggio)
      values (new.team_id, new.id, 'richiusa', auth.uid(),
              new.team_score::text || '-' || new.opp_score::text);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_correzione_chiusa on games;
create trigger trg_correzione_chiusa
  after update of status on games
  for each row execute function log_correzione_chiusa();

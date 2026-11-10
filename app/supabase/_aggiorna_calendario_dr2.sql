-- ============================================================================
-- CALENDARIO DR2: NUOVO CAMPO DI CASA (PALAKATANE) E ORARI AGGIORNATI
-- ============================================================================
-- Da incollare nel SQL Editor di Supabase. Non e' una migrazione: e' un
-- aggiornamento di dati, da lanciare UNA volta.
--
-- Le partite si cercano per CATEGORIA e per la DATA CHE AVEVANO nel PDF
-- federale (quello da cui sono state importate). Ogni riga dice: la data di
-- prima, la data di adesso, l'ora di adesso, e se si gioca in casa.
--
-- O SI APPLICANO TUTTE O NON SE NE APPLICA NESSUNA. Se anche una sola partita
-- non si trova — perche' qualcuno l'ha gia' modificata a mano, o perche' e'
-- gia' stata giocata — lo script si ferma con un errore che la nomina, e il
-- calendario resta com'era. Nessun aggiornamento a meta'.
--
-- DOPO, in fondo, due controlli che rispondono SEMPRE con una riga.
--
-- COSA CAMBIA, rispetto al PDF originale:
--   in casa (campo -> PALAKATANE, ora nuova, data uguale):
--     g.1  15/11  17:00 -> 20:30      g.11 07/02  17:00 -> 20:30
--     g.4  06/12  17:00 -> 20:30      g.14 28/02  17:00 -> 20:30
--     g.6  20/12  17:00 -> 20:45      g.16 14/03  17:00 -> 20:30
--     g.8  17/01  17:00 -> 20:30      g.18 28/03  17:00 -> 20:30
--   in trasferta (spostate, il campo non cambia):
--     g.5  Aretusa (Siracusa)   15/12 19:50 -> 03/01/27 16:00
--     g.15 Azzurra (Belpasso)   06/03 19:00 -> 09/03/27 20:30
--   NON TOCCATE (gia' uguali all'elenco: g.2, g.7, g.9, g.13, g.17) e la g.10
--   (31/01, Aci Sant'Antonio), che non era nell'elenco dei cambiamenti.
-- ============================================================================

do $$
declare
  v_sector uuid;
  v_n int;
  v_mancano text;
  v_giocate text;
  v_attese int;
  v_campo constant text := 'PALAKATANE - SP 13, 37 MOTTA SANT''ANASTASIA (CT)';
begin
  -- La categoria: una sola, altrimenti non si sa su quale lavorare.
  select count(*) into v_n from sectors where upper(trim(name)) = 'DR2';
  if v_n <> 1 then
    raise exception 'Trovo % categorie chiamate DR2, ne serve esattamente una. Nessuna modifica fatta.', v_n;
  end if;
  select id into v_sector from sectors where upper(trim(name)) = 'DR2';

  create temp table _mod (
    giornata int, vecchia date, nuova date, ora text, casa boolean
  ) on commit drop;

  insert into _mod (giornata, vecchia, nuova, ora, casa) values
    ( 1, '2026-11-15', '2026-11-15', '20:30', true),
    ( 4, '2026-12-06', '2026-12-06', '20:30', true),
    ( 5, '2026-12-15', '2027-01-03', '16:00', false),
    ( 6, '2026-12-20', '2026-12-20', '20:45', true),
    ( 8, '2027-01-17', '2027-01-17', '20:30', true),
    (11, '2027-02-07', '2027-02-07', '20:30', true),
    (14, '2027-02-28', '2027-02-28', '20:30', true),
    (15, '2027-03-06', '2027-03-09', '20:30', false),
    (16, '2027-03-14', '2027-03-14', '20:30', true),
    (18, '2027-03-28', '2027-03-28', '20:30', true);

  select count(*) into v_attese from _mod;

  -- 1. Le partite che non si trovano, per nome: cosi' si sa quali sono.
  select string_agg('giornata ' || m.giornata || ' del ' || to_char(m.vecchia, 'DD/MM/YYYY'), ', ' order by m.giornata)
    into v_mancano
  from _mod m
  where not exists (
    select 1 from calendar c where c.sector_id = v_sector and c.date = m.vecchia
  );
  if v_mancano is not null then
    raise exception 'Non trovo in calendario: %. Forse sono gia'' state modificate a mano. Nessuna modifica fatta.', v_mancano;
  end if;

  -- 2. Una partita gia' giocata non si sposta: ha un risultato legato a quel
  --    giorno e a quel campo.
  select string_agg(c.opponent || ' (' || to_char(c.date, 'DD/MM/YYYY') || ')', ', ')
    into v_giocate
  from calendar c join _mod m on c.sector_id = v_sector and c.date = m.vecchia
  where c.played;
  if v_giocate is not null then
    raise exception 'Queste partite risultano gia'' giocate e non le sposto: %. Nessuna modifica fatta.', v_giocate;
  end if;

  -- 3. Il calendario. Il campo cambia solo per le partite in casa: quelle in
  --    trasferta tengono il campo del PDF, che e' gia' quello dell'avversario.
  update calendar c
     set date = m.nuova,
         time = m.ora,
         location = case when m.casa then v_campo else c.location end
    from _mod m
   where c.sector_id = v_sector and c.date = m.vecchia;
  get diagnostics v_n = row_count;
  if v_n <> v_attese then
    raise exception 'Ho aggiornato % righe ma ne aspettavo %. Nessuna modifica fatta.', v_n, v_attese;
  end if;

  -- 4. Il girone: le due partite spostate cambiano data anche nei risultati,
  --    dove stanno insieme a quelle di tutte le altre squadre. Se il girone
  --    non e' stato caricato non c'e' niente da fare e va bene lo stesso.
  update league_matches l
     set date = m.nuova, updated_at = now()
    from _mod m
   where l.sector_id = v_sector
     and l.giornata = m.giornata
     and m.vecchia <> m.nuova
     and (upper(l.home_team) like '%CESTISTICA ETNEA%' or upper(l.away_team) like '%CESTISTICA ETNEA%');
end
$$;


-- ----------------------------------------------------------------------------
-- CONTROLLO 1: UNA RIGA. Le otto partite in casa devono essere al PalaKatane e
-- nessuna partita ancora da giocare deve restare al PalaCatania.
-- ----------------------------------------------------------------------------
select
  count(*) filter (where c.location ilike '%palakatane%') as al_palakatane,
  count(*) filter (where c.location ilike '%palacatania%' and not c.played) as ancora_palacatania_da_giocare,
  count(*) filter (where c.date = '2027-01-03' and c.time = '16:00') as aretusa_spostata,
  count(*) filter (where c.date = '2027-03-09' and c.time = '20:30') as azzurra_spostata
from calendar c
join sectors s on s.id = c.sector_id
where upper(trim(s.name)) = 'DR2';
-- Atteso: 8 · 0 · 1 · 1


-- ----------------------------------------------------------------------------
-- CONTROLLO 2: il calendario com'e' adesso, in ordine di data.
-- ----------------------------------------------------------------------------
select c.giornata, to_char(c.date, 'DD/MM/YYYY') as data, c.time as ora,
       case c.home when true then 'casa' when false then 'trasferta' else '?' end as dove,
       c.opponent as avversario, c.location as campo
from calendar c
join sectors s on s.id = c.sector_id
where upper(trim(s.name)) = 'DR2'
order by c.date, c.time;

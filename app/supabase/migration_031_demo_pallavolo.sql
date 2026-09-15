-- ============================================================================
-- SQUAD — migrazione 031
-- Una società di pallavolo finta, ma con dentro una stagione vera
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase. Richiede la 030 (l'ingresso del
-- SuperAdmin): la società nasce SENZA account, e ci si entra dalla console.
--
-- A COSA SERVE. A far vedere SQUAD a un dirigente senza raccontargliela. Una
-- società vuota non dimostra niente — ogni schermata risponde «nessun dato» —
-- e una società piena a caso dimostra peggio, perché il primo numero storto
-- che nota gli fa perdere fiducia in tutti gli altri.
--
-- Quindi i dati qui dentro sono COERENTI, e lo sono apposta:
--
--   * i punteggi dei set rispettano il regolamento — 25 con due di scarto, il
--     27-25 dove si è andati ai vantaggi, il quinto set a 15 — perché adesso
--     l'app quel regolamento lo conosce e rifiuterebbe il resto;
--   * i tabellini tornano con i set: i punti delle nostre più gli errori
--     avversari fanno il punteggio, e la quota di errori sta fra il 18 e il
--     25%, che è quella vera;
--   * i liberi non fanno punti e difendono il doppio, le centrali murano più
--     delle altre, le palleggiatrici hanno quasi tutte le alzate. Un dirigente
--     di pallavolo queste tre cose le vede prima dei totali;
--   * la classifica torna con le partite giocate, punti FIPAV compresi — 3 se
--     vinci 3-0 o 3-1, 2 se vinci 3-2, 1 se perdi 2-3;
--   * i documenti sono un mazzo realistico: la maggior parte a posto, uno in
--     scadenza fra venti giorni, uno scaduto, uno in verifica e due che non ci
--     sono. È quello che fa esistere la schermata Gestione;
--   * c'è un'amichevole vinta 3-0 che NON entra nelle statistiche: è la cosa
--     più facile da far notare, e spiega da sola perché la distinzione esiste;
--   * alle presenze c'è una che non manca mai e una che manca spesso, perché è
--     la prima cosa che un allenatore cerca.
--
-- PER TOGLIERLA, quando non serve più: in fondo al file c'è la riga.
-- ============================================================================


-- ============================================================================
-- L'AIUTO PER I TABELLINI
-- ============================================================================
-- Prende lo scheletro della rosa e tre liste ordinate come la rosa — punti,
-- muri e alzate — e restituisce il tabellino completo. Il resto si ricava:
-- chi fa punti attacca, chi attacca sbaglia, chi non fa punti difende. Serve
-- solo a non scrivere dodici oggetti per quattro partite.
create or replace function squad_demo_tabellino(
  p_rosa jsonb, p_punti int[], p_muri int[], p_alzate int[], p_set int
) returns jsonb
language sql immutable as $$
  select jsonb_agg(
    jsonb_set(g.riga, '{stats}', jsonb_build_object(
      'points',          p_punti[g.i],
      -- Un punto è un attacco vincente, un muro o un ace: niente altro.
      'aces',            p_punti[g.i] / 8,
      'blocks',          p_muri[g.i],
      'kills',           greatest(p_punti[g.i] - p_muri[g.i] - (p_punti[g.i] / 8), 0),
      'attackErrors',    (p_punti[g.i] / 6),
      'serveErrors',     (p_punti[g.i] / 10),
      'receptionErrors', case when p_punti[g.i] = 0 then 2 else g.i % 3 end,
      -- Chi non fa punti sta in seconda linea, e in seconda linea si difende.
      'digs',            case when p_punti[g.i] = 0 then 17 + (g.i % 6) else 3 + ((g.i * 5) % 9) end,
      'assists',         p_alzate[g.i],
      'setsPlayed',      p_set
    )) order by g.i
  )
  from (
    select riga, ordinalita::int as i
    from jsonb_array_elements(p_rosa) with ordinality as t(riga, ordinalita)
  ) g
$$;


do $$
declare
  v_team      uuid;
  v_stagione  uuid;
  v_serie     uuid;   -- Serie D femminile
  v_under     uuid;   -- Under 16 femminile
  v_oggi      date := current_date;
  v_pid       uuid;
  v_rosa      jsonb;
  r           record;
  i           int;
  v_nomi      text[];
  v_numeri    text[];
  v_ruoli     text[];
  v_nati      int[];
begin

  -- ==========================================================================
  -- LA SOCIETÀ
  -- ==========================================================================
  if exists (select 1 from teams where invite_code = 'DEMOVB') then
    raise notice 'La società demo esiste già: niente da fare.';
    return;
  end if;

  insert into teams (name, city, category, sport, invite_code, primary_color, secondary_color)
  values ('Volley Demo Aurora', 'Rimini', 'Serie D', 'pallavolo', 'DEMOVB', '#8B5CF6', '#EC4899')
  returning id into v_team;

  insert into seasons (team_id, name, start_date, end_date,
                       enrollment_deadline, registration_deadline)
  values (v_team, '2025/2026', date '2025-09-01', date '2026-06-30',
          date '2025-09-15', date '2025-10-31')
  returning id into v_stagione;

  insert into sectors (team_id, name, sort_order) values (v_team, 'Serie D femminile', 0)
  returning id into v_serie;
  insert into sectors (team_id, name, sort_order) values (v_team, 'Under 16 femminile', 1)
  returning id into v_under;


  -- ==========================================================================
  -- LA ROSA DELLA SERIE D
  -- ==========================================================================
  -- Dodici: il sestetto, il libero, e cinque cambi. L'ordine conta, perché i
  -- tabellini più sotto ci si appoggiano — la 7 e la 12 sono i due liberi.
  v_nomi := array[
    'Giulia Baroncini', 'Martina Pedrelli', 'Sofia Guerra', 'Chiara Montanari',
    'Alice Fabbri', 'Elena Casadei', 'Beatrice Zavatta', 'Anna Ricci Belluzzi',
    'Sara Mussoni', 'Francesca Tosi', 'Ilaria Bianchi', 'Noemi Amaducci'
  ];
  v_numeri := array['1','3','4','5','6','7','8','9','10','11','13','14'];
  v_ruoli := array[
    'Palleggiatore', 'Opposto', 'Schiacciatore', 'Centrale',
    'Schiacciatore', 'Centrale', 'Libero', 'Palleggiatore',
    'Schiacciatore', 'Centrale', 'Opposto', 'Libero'
  ];
  v_nati := array[2002, 2004, 2003, 2001, 2005, 2000, 2004, 2006, 2003, 2002, 2005, 2007];

  for i in 1 .. array_length(v_nomi, 1) loop
    -- created_at esplicito, e non il valore automatico: dentro una sola
    -- transazione now() e' identico per tutte, e «ordinate per created_at»
    -- diventerebbe «in ordine qualunque». L'ordine qui conta davvero — i
    -- tabellini piu' sotto sanno che la settima e la dodicesima sono i liberi.
    insert into players (team_id, number, name, birth_date, role_position, height_cm,
                         guardian_phone, email, joined_at, created_at)
    values (
      v_team, v_numeri[i], v_nomi[i],
      make_date(v_nati[i], 1 + ((i * 7) % 12), 1 + ((i * 11) % 27)),
      v_ruoli[i],
      case v_ruoli[i]
        when 'Libero' then 165 + (i % 6)
        when 'Centrale' then 180 + (i % 7)
        else 172 + (i % 9)
      end,
      '33' || (3 + (i % 6))::text || ' ' || (100 + i * 7)::text || ' ' || (2000 + i * 13)::text,
      case when i % 3 = 0
        then lower(split_part(v_nomi[i], ' ', 1)) || '.' || lower(split_part(v_nomi[i], ' ', 2)) || '@example.it'
      end,
      date '2025-09-01',
      now() + (i || ' seconds')::interval
    )
    returning id into v_pid;

    insert into player_sectors (player_id, sector_id, season_id) values (v_pid, v_serie, v_stagione);
  end loop;


  -- ==========================================================================
  -- LA ROSA DELL'UNDER 16
  -- ==========================================================================
  -- Serve a far vedere che le categorie sono separate davvero: rosa, calendario
  -- e statistiche cambiano tutti insieme cambiando categoria in alto.
  v_nomi := array[
    'Viola Marcheselli', 'Emma Gardini', 'Ludovica Bagli', 'Greta Succi',
    'Matilde Ceccarelli', 'Aurora Pizzagalli', 'Gaia Rinaldi', 'Camilla Vandi',
    'Nicole Semprini', 'Rebecca Turci'
  ];
  v_numeri := array['2','4','5','7','8','9','11','12','15','18'];
  v_ruoli := array[
    'Palleggiatore', 'Schiacciatore', 'Centrale', 'Opposto', 'Libero',
    'Schiacciatore', 'Centrale', 'Palleggiatore', 'Schiacciatore', 'Opposto'
  ];

  for i in 1 .. array_length(v_nomi, 1) loop
    insert into players (team_id, number, name, birth_date, role_position, height_cm, guardian_phone, joined_at, created_at)
    values (
      v_team, v_numeri[i], v_nomi[i],
      make_date(2010, 1 + ((i * 5) % 12), 1 + ((i * 9) % 27)),
      v_ruoli[i], 160 + (i % 12),
      '34' || (2 + (i % 7))::text || ' ' || (200 + i * 9)::text || ' ' || (3000 + i * 17)::text,
      date '2025-09-01',
      now() + ((100 + i) || ' seconds')::interval
    )
    returning id into v_pid;

    insert into player_sectors (player_id, sector_id, season_id) values (v_pid, v_under, v_stagione);
  end loop;


  -- ==========================================================================
  -- I DOCUMENTI
  -- ==========================================================================
  -- Il mazzo che fa esistere la schermata Gestione. Niente file veri: conta la
  -- riga, ed è quella che l'app legge per dire chi può scendere in campo.
  for r in (
    -- ::int perche' row_number() restituisce un bigint, e «data + bigint»
    -- non e' un'operazione che Postgres conosce: solo «data + integer».
    select p.id, (row_number() over (order by p.created_at))::int as n
    from players p
    join player_sectors ps on ps.player_id = p.id
    where p.team_id = v_team and ps.sector_id = v_serie
  ) loop
    if r.n = 3 then        -- scade fra venti giorni: «da seguire»
      insert into player_documents (team_id, player_id, doc_type, file_path, file_name, status, expires_at)
      values (v_team, r.id, 'certificato_medico', 'demo/cert.pdf', 'certificato.pdf', 'approved', v_oggi + 20);
    elsif r.n = 6 then     -- scaduto il mese scorso: «ferma»
      insert into player_documents (team_id, player_id, doc_type, file_path, file_name, status, expires_at)
      values (v_team, r.id, 'certificato_medico', 'demo/cert.pdf', 'certificato.pdf', 'approved', v_oggi - 28);
    elsif r.n = 9 then     -- caricato e non ancora guardato: «da approvare»
      insert into player_documents (team_id, player_id, doc_type, file_path, file_name, status, expires_at)
      values (v_team, r.id, 'certificato_medico', 'demo/cert.pdf', 'certificato.pdf', 'in_review', v_oggi + 300);
    elsif r.n in (11, 12) then
      null;                -- le due ultime arrivate: non c'è proprio
    else
      insert into player_documents (team_id, player_id, doc_type, file_path, file_name, status, expires_at)
      values (v_team, r.id, 'certificato_medico', 'demo/cert.pdf', 'certificato.pdf', 'approved', v_oggi + 150 + r.n);
    end if;

    if r.n <= 10 then
      insert into player_documents (team_id, player_id, doc_type, file_path, file_name, status, expires_at)
      values (v_team, r.id, 'tesseramento_fip', 'demo/tess.pdf', 'tesseramento.pdf', 'approved', date '2026-06-30');
    end if;
  end loop;


  -- ==========================================================================
  -- GLI ALLENAMENTI
  -- ==========================================================================
  -- Otto già fatti e quattro da fare: l'elenco ha sia «Passati» sia «Futuri»,
  -- e la vista calendario ha qualcosa da mostrare.
  for i in -8 .. 3 loop
    insert into trainings (team_id, sector_id, season_id, title, date, start_time, end_time, location)
    values (
      v_team, v_serie, v_stagione,
      case when i % 2 = 0 then 'Tecnica e fondamentali' else 'Situazioni di gioco' end,
      v_oggi + (i * 3), '20:00', '22:00', 'Palestra Comunale via Marconi'
    );
  end loop;

  for i in -4 .. 2 loop
    insert into trainings (team_id, sector_id, season_id, title, date, start_time, end_time, location)
    values (v_team, v_under, v_stagione, 'Allenamento Under 16', v_oggi + (i * 4), '18:30', '20:00', 'Palestra Comunale via Marconi');
  end loop;


  -- ==========================================================================
  -- LE PRESENZE
  -- ==========================================================================
  -- Una che manca spesso e una sempre presente: senza quelle due la schermata
  -- delle presenze non dimostra niente.
  for r in (
    select t.id as tid, q.id as pid, t.date,
           (row_number() over (partition by t.id order by q.created_at))::int as n
    from trainings t
    cross join (
      select pl.* from players pl
      join player_sectors ps on ps.player_id = pl.id
      where ps.sector_id = v_serie
    ) q
    where t.sector_id = v_serie and t.date <= v_oggi
  ) loop
    insert into training_attendance (training_id, player_id, status)
    values (
      r.tid, r.pid,
      case
        when r.n = 11 and (extract(day from r.date)::int % 3) = 0 then 'absent'
        when r.n = 11 and (extract(day from r.date)::int % 5) = 0 then 'excused'
        when r.n = 5  and (extract(day from r.date)::int % 4) = 0 then 'excused'
        when (extract(day from r.date)::int + r.n::int) % 13 = 0 then 'absent'
        else 'present'
      end
    )
    on conflict do nothing;
  end loop;


  -- ==========================================================================
  -- IL CALENDARIO
  -- ==========================================================================
  insert into calendar (team_id, sector_id, season_id, giornata, opponent, date, time, location, home, played, team_score, opp_score) values
    (v_team, v_serie, v_stagione, 1, 'Riccione Volley',          v_oggi - 35, '18:00', 'Palestra Comunale via Marconi', true,  true, 3, 1),
    (v_team, v_serie, v_stagione, 2, 'Pallavolo Cesenatico',     v_oggi - 28, '20:30', 'PalaCesenatico',                false, true, 1, 3),
    (v_team, v_serie, v_stagione, 3, 'Libertas Forlì',           v_oggi - 21, '18:00', 'Palestra Comunale via Marconi', true,  true, 3, 0),
    (v_team, v_serie, v_stagione, 4, 'Idea Volley Bellaria',     v_oggi - 14, '19:00', 'PalaBellaria',                  false, true, 3, 2),
    (v_team, v_serie, v_stagione, 5, 'Gymnasium Santarcangelo',  v_oggi - 7,  '18:00', 'Palestra Comunale via Marconi', true,  true, 2, 3),
    (v_team, v_serie, v_stagione, 6, 'Volley Club Rimini',       v_oggi + 4,  '18:00', 'Palestra Comunale via Marconi', true,  false, null, null),
    (v_team, v_serie, v_stagione, 7, 'Pallavolo Savignano',      v_oggi + 11, '20:30', 'PalaSavignano',                 false, false, null, null),
    (v_team, v_serie, v_stagione, 8, 'Riccione Volley',          v_oggi + 18, '20:30', 'PalaRiccione',                  false, false, null, null);

  -- La prossima partita e' per CATEGORIA, non per societa': dalla migrazione
  -- 002 la chiave di next_match e' sector_id. Ogni categoria ha la sua.
  insert into next_match (team_id, sector_id, opponent, date, time, location, home)
  values (v_team, v_serie, 'Volley Club Rimini', to_char(v_oggi + 4, 'YYYY-MM-DD'),
          '18:00', 'Palestra Comunale via Marconi', true)
  on conflict (sector_id) do update
    set opponent = excluded.opponent, date = excluded.date, time = excluded.time,
        location = excluded.location, home = excluded.home;


  -- ==========================================================================
  -- LA CLASSIFICA
  -- ==========================================================================
  -- Punti FIPAV. Noi: 3-1, 1-3, 3-0, 3-2, 2-3 = 3 + 0 + 3 + 2 + 1 = 9, e
  -- dodici set vinti contro nove persi. Sono gli stessi numeri del calendario.
  insert into standings (team_id, sector_id, season_id, team_name, played, wins, losses, draws, points, is_us, stats) values
    (v_team, v_serie, v_stagione, 'Pallavolo Cesenatico',    5, 5, 0, 0, 15, false, '{"sv":15,"sp":3}'::jsonb),
    (v_team, v_serie, v_stagione, 'Volley Club Rimini',      5, 4, 1, 0, 11, false, '{"sv":13,"sp":6}'::jsonb),
    (v_team, v_serie, v_stagione, 'Volley Demo Aurora',      5, 3, 2, 0,  9, true,  '{"sv":12,"sp":9}'::jsonb),
    (v_team, v_serie, v_stagione, 'Idea Volley Bellaria',    5, 2, 3, 0,  8, false, '{"sv":11,"sp":11}'::jsonb),
    (v_team, v_serie, v_stagione, 'Gymnasium Santarcangelo', 5, 2, 3, 0,  7, false, '{"sv":10,"sp":12}'::jsonb),
    (v_team, v_serie, v_stagione, 'Libertas Forlì',          5, 2, 3, 0,  6, false, '{"sv":9,"sp":12}'::jsonb),
    (v_team, v_serie, v_stagione, 'Pallavolo Savignano',     5, 1, 4, 0,  4, false, '{"sv":7,"sp":13}'::jsonb),
    (v_team, v_serie, v_stagione, 'Riccione Volley',         5, 1, 4, 0,  3, false, '{"sv":6,"sp":14}'::jsonb);


  -- ==========================================================================
  -- I TABELLINI
  -- ==========================================================================
  select jsonb_agg(jsonb_build_object(
           'id', p.id, 'number', p.number, 'name', p.name, 'onCourt', false,
           'stats', '{}'::jsonb
         ) order by p.created_at)
    into v_rosa
    from players p
    join player_sectors ps on ps.player_id = p.id
    where ps.sector_id = v_serie;

  -- Giornata 1 — 3-1 in casa con Riccione. 98 punti nostri nei quattro set,
  -- 79 fatti dalle nostre: il 19% arriva dagli errori loro.
  insert into games (team_id, sector_id, season_id, status, opp_name, num_quarters, quarter,
                     team_score, opp_score, period_scores, players, friendly, started_at, ended_at)
  values (
    v_team, v_serie, v_stagione, 'finished', 'Riccione Volley', 4, 4, 3, 1,
    '[{"us":25,"them":19},{"us":23,"them":25},{"us":25,"them":21},{"us":25,"them":18}]'::jsonb,
    squad_demo_tabellino(v_rosa,
      array[18,14,12, 9, 8, 6, 0, 4, 3, 3, 2, 0],
      array[ 1, 2, 1, 3, 1, 2, 0, 0, 1, 2, 0, 0],
      array[31, 2, 1, 0, 1, 0, 3,14, 1, 0, 0, 2], 4),
    false, (v_oggi - 35)::timestamptz, (v_oggi - 35)::timestamptz
  );

  -- Giornata 3 — 3-0 con Forlì, e un set finito ai vantaggi.
  insert into games (team_id, sector_id, season_id, status, opp_name, num_quarters, quarter,
                     team_score, opp_score, period_scores, players, friendly, started_at, ended_at)
  values (
    v_team, v_serie, v_stagione, 'finished', 'Libertas Forlì', 3, 3, 3, 0,
    '[{"us":25,"them":20},{"us":27,"them":25},{"us":25,"them":22}]'::jsonb,
    squad_demo_tabellino(v_rosa,
      array[16,12, 9, 8, 6, 5, 0, 3, 2, 1, 0, 0],
      array[ 0, 1, 1, 3, 1, 2, 0, 0, 0, 1, 0, 0],
      array[26, 1, 0, 0, 1, 0, 2,11, 0, 0, 0, 1], 3),
    false, (v_oggi - 21)::timestamptz, (v_oggi - 21)::timestamptz
  );

  -- Giornata 5 — 2-3 al tie-break in casa. Il quinto set a 15, come dice il
  -- regolamento: è la partita da aprire per far vedere il tabellino set per set.
  insert into games (team_id, sector_id, season_id, status, opp_name, num_quarters, quarter,
                     team_score, opp_score, period_scores, players, friendly, started_at, ended_at)
  values (
    v_team, v_serie, v_stagione, 'finished', 'Gymnasium Santarcangelo', 5, 5, 2, 3,
    '[{"us":25,"them":22},{"us":21,"them":25},{"us":25,"them":23},{"us":19,"them":25},{"us":13,"them":15}]'::jsonb,
    squad_demo_tabellino(v_rosa,
      array[19,15,12,10, 8, 7, 0, 5, 3, 2, 1, 0],
      array[ 1, 2, 1, 4, 1, 3, 0, 0, 1, 1, 0, 0],
      array[34, 2, 1, 0, 1, 0, 4,16, 1, 0, 0, 3], 5),
    false, (v_oggi - 7)::timestamptz, (v_oggi - 7)::timestamptz
  );

  -- L'amichevole con la Juniores. Vinta 3-0, e NON entra nelle statistiche:
  -- è la dimostrazione più corta di perché la distinzione esiste.
  insert into games (team_id, sector_id, season_id, status, opp_name, num_quarters, quarter,
                     team_score, opp_score, period_scores, players, friendly, started_at, ended_at)
  values (
    v_team, v_serie, v_stagione, 'finished', 'Juniores (amichevole)', 3, 3, 3, 0,
    '[{"us":25,"them":11},{"us":25,"them":14},{"us":25,"them":9}]'::jsonb,
    squad_demo_tabellino(v_rosa,
      array[ 9, 8, 8, 7, 6, 6, 0, 5, 4, 3, 2, 2],
      array[ 0, 1, 1, 2, 1, 2, 0, 0, 1, 1, 0, 0],
      array[14, 1, 1, 0, 1, 0, 2,13, 1, 0, 0, 1], 3),
    true, (v_oggi - 17)::timestamptz, (v_oggi - 17)::timestamptz
  );


  -- ==========================================================================
  -- LE COMUNICAZIONI
  -- ==========================================================================
  insert into communications (team_id, sector_id, kind, title, body, event_date, meet_time, start_time, location, requires_response, respond_by) values
    (v_team, v_serie, 'convocazione', 'Convocazione · Volley Club Rimini',
     'Ritrovo in palestra un''ora prima. Portate la divisa da gara e la seconda maglia.',
     v_oggi + 4, '17:00', '18:00', 'Palestra Comunale via Marconi', true, v_oggi + 2),
    (v_team, v_serie, 'trasferta', 'Trasferta a Savignano',
     'Partenza in pullman dal piazzale della palestra. Chi arriva con mezzi propri avvisi entro lunedì.',
     v_oggi + 11, '18:30', '20:30', 'PalaSavignano', true, v_oggi + 8),
    (v_team, v_under, 'avviso', 'Palestra chiusa giovedì',
     'Giovedì la palestra è occupata dal torneo scolastico: allenamento spostato a venerdì, stessa ora.',
     v_oggi + 2, null, null, null, false, null);

  -- I trigger delle notifiche hanno fatto il loro mestiere mentre inserivamo:
  -- una per ogni allenamento, una per ogni documento, una per la prossima
  -- partita. Sono corrette, ma quaranta avvisi non letti in una societa' appena
  -- nata sono solo rumore davanti a chi la guarda per la prima volta.
  delete from notifications where team_id = v_team;

  raise notice 'Società demo creata: Volley Demo Aurora (codice DEMOVB). Entraci dalla console SuperAdmin.';
end
$$;


-- ============================================================================
-- PER TOGLIERLA
-- ============================================================================
-- Due righe: il resto va via in cascata.
--
--   delete from teams where invite_code = 'DEMOVB';
--   drop function if exists squad_demo_tabellino(jsonb, int[], int[], int[], int);
-- ============================================================================

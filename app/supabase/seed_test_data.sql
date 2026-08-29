-- ============================================================================
-- Team Manager Basket — dati di test "metà stagione"
-- ============================================================================
-- Da eseguire UNA VOLTA nel SQL Editor di Supabase, sul team con invite code
-- BA536A (o cambia il codice qui sotto). Non tocca altri team.
--
-- Popola, per 3 settori (Prima Squadra + Under 19 + Under 15 — riusa "Prima
-- Squadra" se già esiste dal create_team automatico, crea gli altri due):
--   - rosa (9 giocatori a settore, con età/altezza coerenti col settore)
--   - calendario campionato (6 partite giocate + 6 da giocare, per settore)
--   - storico partite giocate con boxscore giocatore per giocatore
--   - classifica (la nostra squadra + 7 avversarie fittizie)
--   - programma allenamenti ricorrente (2 volte a settimana) + presenze sulle
--     sedute passate + le prossime sedute già generate
-- Popola anche il modulo Finanza (condiviso a livello di società): un
-- esercizio, categorie, centri di costo (uno a settore + Amministrazione),
-- conti, fornitori, sponsor, e ~10 entrate/uscite con pagamenti in stati
-- diversi (pagato, parziale, previsto, scaduto) per testare Entrate/Uscite/
-- Scadenze. Imposta finance_role='admin' sull'admin del team.
--
-- Non crea account utente aggiuntivi (staff/famiglia): creare un account
-- richiede una vera registrazione tramite l'app, non è fattibile da SQL.
-- Non crea certificati/documenti giocatore: richiederebbero file reali su
-- storage, non generabili da qui.
--
-- Protezione: se il team ha già giocatori, lo script si ferma subito senza
-- scrivere nulla (evita di seminare due volte per errore).
-- ============================================================================

do $$
declare
  v_invite_code text := 'BA536A';
  v_team_id uuid;
  v_team_name text;
  v_admin_id uuid;

  v_sector_names text[] := array['Prima Squadra','Under 19','Under 15'];
  v_all_sector_ids uuid[] := '{}';
  v_sector_id uuid;

  v_names text[] := array[
    'Marco Bianchi','Luca Ferrari','Alessandro Russo','Davide Romano','Matteo Colombo','Andrea Ricci','Simone Marino','Federico Greco','Lorenzo Bruno',
    'Nicolò Gallo','Riccardo Conti','Tommaso De Luca','Giacomo Costa','Gabriele Giordano','Francesco Mancini','Leonardo Rizzo','Christian Lombardi','Daniele Moretti',
    'Emanuele Barbieri','Stefano Fontana','Michele Santoro','Pietro Mariani','Antonio Rinaldi','Salvatore Caruso','Filippo Ferrara','Enrico Galli','Massimo Farina'
  ];
  v_numbers text[] := array['4','5','6','7','8','9','10','11','12'];
  v_positions text[] := array['Playmaker','Guardia','Ala piccola','Ala grande','Centro'];
  v_opp_names text[] := array[
    'Basket Riviera','Virtus Collina','Stella Rossa Basket','Pallacanestro Torreblu','Basket Aurora','Fortitudo Vallata',
    'Basket Nordest','Pallacanestro Lagomare','Robur Pineta','Amatori Basket City','Basket Vecchia Città','Nuova Pallacanestro Est'
  ];

  v_player_id uuid;
  v_birth_base date;
  v_birth_range int;
  v_height_base int;
  v_height_range int;

  v_rec1 uuid;
  v_rec2 uuid;
  v_training_id uuid;
  v_d date;
  v_dow int;

  v_date date;
  v_home boolean;
  v_opponent text;
  v_location text;
  v_team_score int;
  v_opp_score int;
  v_players_json jsonb;
  v_game_id uuid;
  v_wins int;
  v_losses int;

  v_cc_ids uuid[] := '{}';
  v_cc_scratch uuid;
  v_cc_admin uuid;
  v_fy_id uuid;
  v_cat_quote uuid; v_cat_sponsor uuid; v_cat_contrib uuid;
  v_cat_affitto uuid; v_cat_materiale uuid; v_cat_trasferte uuid; v_cat_arbitraggi uuid;
  v_acc_bank uuid; v_acc_cash uuid;
  v_supp_sport uuid; v_supp_palestra uuid;
  v_spons_auto uuid; v_spons_farmacia uuid;
  v_entry_id uuid;
begin
  select id, name into v_team_id, v_team_name from teams where invite_code = upper(v_invite_code);
  if v_team_id is null then
    raise exception 'Nessun team trovato con invite code %', v_invite_code;
  end if;

  if exists (select 1 from players where team_id = v_team_id) then
    raise exception 'Il team % ha già giocatori: script già eseguito, oppure team non vuoto. Non scrivo nulla.', v_team_name;
  end if;

  select id into v_admin_id from profiles where team_id = v_team_id and role = 'admin' order by created_at limit 1;
  if v_admin_id is null then
    raise exception 'Nessun admin trovato per il team %', v_team_name;
  end if;

  -- ==========================================================================
  -- SETTORI
  -- ==========================================================================
  for idx in 1..3 loop
    select id into v_sector_id from sectors where team_id = v_team_id and name = v_sector_names[idx];
    if v_sector_id is null then
      insert into sectors (team_id, name, sort_order) values (v_team_id, v_sector_names[idx], idx - 1)
        returning id into v_sector_id;
    end if;
    v_all_sector_ids := array_append(v_all_sector_ids, v_sector_id);

    -- ------------------------------------------------------------------
    -- ROSA (9 giocatori)
    -- ------------------------------------------------------------------
    if idx = 1 then v_birth_base := date '1990-01-01'; v_birth_range := 5475; v_height_base := 178; v_height_range := 27;
    elsif idx = 2 then v_birth_base := date '2006-01-01'; v_birth_range := 730; v_height_base := 172; v_height_range := 22;
    else v_birth_base := date '2010-01-01'; v_birth_range := 730; v_height_base := 158; v_height_range := 22;
    end if;

    for j in 1..9 loop
      insert into players (team_id, number, name, birth_date, role_position, height_cm, joined_at)
        values (
          v_team_id, v_numbers[j], v_names[(idx - 1) * 9 + j],
          v_birth_base + floor(random() * v_birth_range)::int,
          v_positions[((j - 1) % 5) + 1],
          v_height_base + floor(random() * v_height_range)::int,
          current_date - floor(random() * 700)::int
        )
        returning id into v_player_id;
      insert into player_sectors (player_id, sector_id) values (v_player_id, v_sector_id);
    end loop;

    -- ------------------------------------------------------------------
    -- CALENDARIO + STORICO (giornata 1-6 giocate, 7-12 da giocare)
    -- ------------------------------------------------------------------
    v_wins := 0; v_losses := 0;
    for g in 1..12 loop
      if g <= 6 then
        v_date := current_date - ((7 - g) * 7);
      else
        v_date := current_date + ((g - 6) * 7);
      end if;
      v_home := (g % 2 = 1);
      v_opponent := v_opp_names[(((g - 1) + (idx - 1) * 4) % array_length(v_opp_names, 1)) + 1];
      v_location := case when v_home then 'Palestra Comunale' else 'Trasferta' end;

      if g <= 6 then
        with roster as (
          select p.id, p.number, p.name, row_number() over (order by p.number) as rn
          from players p join player_sectors ps on ps.player_id = p.id
          where ps.sector_id = v_sector_id
        ),
        stats as (
          select r.id, r.number, r.name, r.rn,
            (case when r.rn <= 5 then floor(random() * 6) + 1 else floor(random() * 3) end)::int as fgm2,
            (case when r.rn <= 5 then floor(random() * 3) else floor(random() * 2) end)::int as fgm3,
            (case when r.rn <= 5 then floor(random() * 5) else floor(random() * 2) end)::int as ftm,
            floor(random() * 4)::int as orb, floor(random() * 6)::int as drb,
            (case when r.rn <= 5 then floor(random() * 6) else floor(random() * 2) end)::int as ast,
            floor(random() * 3)::int as stl, floor(random() * 4)::int as tov,
            floor(random() * 2)::int as blk, floor(random() * 2)::int as blk_against,
            floor(random() * 5)::int as pf, floor(random() * 4)::int as pf_drawn,
            (floor(random() * 21) - 10)::int as plus_minus,
            (case when r.rn <= 5 then 900 + floor(random() * 600) else 300 + floor(random() * 400) end)::int as seconds
          from roster r
        ),
        stats2 as (
          select s.*, (e2.fga2_extra + s.fgm2) as fga2, (e3.fga3_extra + s.fgm3) as fga3, (e1.fta_extra + s.ftm) as fta
          from stats s, lateral (select floor(random() * 4)::int as fga2_extra) e2,
               lateral (select floor(random() * 3)::int as fga3_extra) e3,
               lateral (select floor(random() * 2)::int as fta_extra) e1
        )
        select
          jsonb_agg(jsonb_build_object(
            'id', s.id, 'number', s.number, 'name', s.name, 'onCourt', s.rn <= 5,
            'stats', jsonb_build_object(
              'fgm2', s.fgm2, 'fga2', s.fga2, 'fgm3', s.fgm3, 'fga3', s.fga3,
              'ftm', s.ftm, 'fta', s.fta, 'orb', s.orb, 'drb', s.drb, 'ast', s.ast,
              'stl', s.stl, 'tov', s.tov,
              'tovTypes', jsonb_build_object('generica', s.tov, 'palleggio', 0, 'passaggio', 0, 'passi', 0),
              'blk', s.blk, 'blkAgainst', s.blk_against, 'pf', s.pf, 'pfDrawn', s.pf_drawn,
              'plusMinus', s.plus_minus, 'seconds', s.seconds
            )
          )),
          sum(s.fgm2 * 2 + s.fgm3 * 3 + s.ftm)
        into v_players_json, v_team_score
        from stats2 s;

        v_opp_score := greatest(30, v_team_score + (floor(random() * 31)::int - 15));
        if v_team_score > v_opp_score then v_wins := v_wins + 1; else v_losses := v_losses + 1; end if;

        insert into games (
          team_id, sector_id, status, opp_name, quarter_length, num_quarters, quarter,
          clock, clock_running, team_score, opp_score, quarter_fouls, players, started_at, ended_at
        ) values (
          v_team_id, v_sector_id, 'finished', v_opponent, 600, 4, 4,
          0, false, v_team_score, v_opp_score, '{}'::jsonb, v_players_json,
          v_date + time '18:30', v_date + time '18:30' + interval '100 minutes'
        ) returning id into v_game_id;

        insert into calendar (team_id, sector_id, giornata, opponent, date, time, location, home, played, team_score, opp_score)
          values (v_team_id, v_sector_id, g, v_opponent, v_date, '18:30', v_location, v_home, true, v_team_score, v_opp_score);
      else
        insert into calendar (team_id, sector_id, giornata, opponent, date, time, location, home, played)
          values (v_team_id, v_sector_id, g, v_opponent, v_date, '18:30', v_location, v_home, false);
      end if;
    end loop;

    -- ------------------------------------------------------------------
    -- CLASSIFICA
    -- ------------------------------------------------------------------
    insert into standings (team_id, sector_id, team_name, played, wins, losses, points, is_us)
      values (v_team_id, v_sector_id, v_team_name, 6, v_wins, v_losses, v_wins * 2 + v_losses, true);
    for i in 1..7 loop
      declare
        v_played int := 5 + floor(random() * 3)::int;
        v_w int;
        v_l int;
      begin
        v_w := floor(random() * (v_played + 1))::int;
        v_l := v_played - v_w;
        insert into standings (team_id, sector_id, team_name, played, wins, losses, points, is_us)
          values (v_team_id, v_sector_id, v_opp_names[(((idx - 1) * 3 + i - 1) % array_length(v_opp_names, 1)) + 1],
            v_played, v_w, v_l, v_w * 2 + v_l, false);
      end;
    end loop;

    -- ------------------------------------------------------------------
    -- ALLENAMENTI (programma ricorrente martedì+giovedì, 6 settimane passate
    -- + 3 future, con presenze sulle sedute passate)
    -- ------------------------------------------------------------------
    insert into training_recurrences (team_id, sector_id, weekday, start_time, end_time, location, active)
      values (v_team_id, v_sector_id, 2, '18:30', '20:00', 'Palestra Comunale', true)
      returning id into v_rec1;
    insert into training_recurrences (team_id, sector_id, weekday, start_time, end_time, location, active)
      values (v_team_id, v_sector_id, 4, '18:30', '20:00', 'Palestra Comunale', true)
      returning id into v_rec2;

    for offset_days in -42..21 loop
      v_d := current_date + offset_days;
      v_dow := extract(dow from v_d)::int;
      if v_dow = 2 or v_dow = 4 then
        insert into trainings (team_id, sector_id, title, date, start_time, end_time, location, recurrence_id)
          values (v_team_id, v_sector_id, 'Allenamento', v_d, '18:30', '20:00', 'Palestra Comunale',
            case when v_dow = 2 then v_rec1 else v_rec2 end)
          returning id into v_training_id;

        if v_d < current_date then
          insert into training_attendance (training_id, player_id, status)
            select v_training_id, t.player_id,
              case when t.r < 0.8 then 'present' when t.r < 0.9 then 'excused' else 'absent' end
            from (select ps.player_id, random() as r from player_sectors ps where ps.sector_id = v_sector_id) t;
        end if;
      end if;
    end loop;
  end loop;

  -- ==========================================================================
  -- FINANZA (condivisa a livello di società)
  -- ==========================================================================
  update profiles set finance_role = 'admin' where team_id = v_team_id and role = 'admin';

  insert into fiscal_years (team_id, name, start_date, end_date)
    values (v_team_id, 'Stagione test', (current_date - interval '6 months')::date, (current_date + interval '6 months')::date)
    returning id into v_fy_id;

  insert into finance_categories (team_id, kind, name) values (v_team_id, 'income', 'Quote iscrizione') returning id into v_cat_quote;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'income', 'Sponsorizzazioni') returning id into v_cat_sponsor;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'income', 'Contributi federali') returning id into v_cat_contrib;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'expense', 'Affitto palestra') returning id into v_cat_affitto;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'expense', 'Materiale sportivo') returning id into v_cat_materiale;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'expense', 'Trasferte e trasporti') returning id into v_cat_trasferte;
  insert into finance_categories (team_id, kind, name) values (v_team_id, 'expense', 'Arbitraggi e tasse gara') returning id into v_cat_arbitraggi;

  for idx in 1..3 loop
    insert into cost_centers (team_id, sector_id, name) values (v_team_id, v_all_sector_ids[idx], v_sector_names[idx])
      returning id into v_cc_scratch;
    v_cc_ids := array_append(v_cc_ids, v_cc_scratch);
  end loop;
  insert into cost_centers (team_id, sector_id, name) values (v_team_id, null, 'Amministrazione') returning id into v_cc_admin;

  insert into finance_accounts (team_id, name, type, iban, initial_balance)
    values (v_team_id, 'Conto corrente', 'bank', 'IT60X0000000000000000000000', 4500.00) returning id into v_acc_bank;
  insert into finance_accounts (team_id, name, type, initial_balance)
    values (v_team_id, 'Cassa contanti', 'cash', 250.00) returning id into v_acc_cash;

  insert into finance_suppliers (team_id, name) values (v_team_id, 'Sport Center Snc') returning id into v_supp_sport;
  insert into finance_suppliers (team_id, name) values (v_team_id, 'Palestra Comunale ASD') returning id into v_supp_palestra;

  insert into finance_sponsors (team_id, sector_id, name, contract_value, contract_start, contract_end)
    values (v_team_id, v_all_sector_ids[1], 'AutoOfficina Rossi & Figli', 1500.00, (current_date - interval '6 months')::date, (current_date + interval '6 months')::date)
    returning id into v_spons_auto;
  insert into finance_sponsors (team_id, sector_id, name, contract_value, contract_start, contract_end)
    values (v_team_id, null, 'Farmacia Centrale', 800.00, (current_date - interval '6 months')::date, (current_date + interval '6 months')::date)
    returning id into v_spons_farmacia;

  -- 1. quote iscrizione Prima Squadra: pagata per intero
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, party_name, created_by)
    values (v_team_id, 'income', v_cat_quote, 1200.00, current_date - 60, current_date - 45, 'Quote iscrizione atleti', 'Quote iscrizione Prima Squadra', v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[1], 1200.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_bank, 'income', 1200.00, current_date - 50, 'bonifico', v_admin_id);

  -- 2. quote iscrizione Under 19: parzialmente incassata
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, party_name, created_by)
    values (v_team_id, 'income', v_cat_quote, 900.00, current_date - 55, current_date - 40, 'Quote iscrizione atleti', 'Quote iscrizione Under 19', v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[2], 900.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_cash, 'income', 500.00, current_date - 40, 'contanti', v_admin_id);

  -- 3. sponsorizzazione AutoOfficina: pagata per intero
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, sponsor_id, created_by)
    values (v_team_id, 'income', v_cat_sponsor, 1500.00, current_date - 30, current_date - 10, 'Sponsorizzazione stagionale', v_spons_auto, v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[1], 1500.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_bank, 'income', 1500.00, current_date - 12, 'bonifico', v_admin_id);

  -- 4. sponsorizzazione Farmacia: ancora da incassare (previsto)
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, sponsor_id, created_by)
    values (v_team_id, 'income', v_cat_sponsor, 800.00, current_date - 20, current_date + 10, 'Sponsorizzazione stagionale', v_spons_farmacia, v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_admin, 800.00);

  -- 5. affitto palestra: pagato
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, supplier_id, created_by)
    values (v_team_id, 'expense', v_cat_affitto, 600.00, current_date - 25, current_date - 20, 'Affitto palestra mensile', v_supp_palestra, v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_admin, 600.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_bank, 'expense', 600.00, current_date - 20, 'bonifico', v_admin_id);

  -- 6. materiale sportivo: pagato
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, supplier_id, created_by)
    values (v_team_id, 'expense', v_cat_materiale, 350.00, current_date - 15, current_date - 5, 'Palloni e materiale allenamento', v_supp_sport, v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[3], 350.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_bank, 'expense', 350.00, current_date - 6, 'carta', v_admin_id);

  -- 7. trasferta: scaduta, non pagata
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, party_name, created_by)
    values (v_team_id, 'expense', v_cat_trasferte, 280.00, current_date - 10, current_date - 3, 'Trasporto trasferta campionato', 'Noleggio pullman trasferta', v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[1], 280.00);

  -- 8. tasse gara: parzialmente pagata
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, party_name, created_by)
    values (v_team_id, 'expense', v_cat_arbitraggi, 150.00, current_date - 7, current_date + 5, 'Tasse gara e arbitraggi', 'Tasse gara giornata 5-6', v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[2], 150.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by)
    values (v_team_id, v_entry_id, v_acc_cash, 'expense', 80.00, current_date - 2, 'contanti', v_admin_id);

  -- 9. contributo federale: futuro, non ancora incassato
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, party_name, created_by)
    values (v_team_id, 'income', v_cat_contrib, 600.00, current_date + 5, current_date + 20, 'Contributo federale attività giovanile', 'Contributo federale', v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_ids[3], 600.00);

  -- 10. affitto palestra prossimo mese: futuro, non ancora pagato
  insert into finance_entries (team_id, kind, category_id, planned_amount, accrual_date, due_date, description, supplier_id, created_by)
    values (v_team_id, 'expense', v_cat_affitto, 600.00, current_date + 10, current_date + 15, 'Affitto palestra mensile', v_supp_palestra, v_admin_id)
    returning id into v_entry_id;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry_id, v_cc_admin, 600.00);

  raise notice 'Fatto: team % popolato con % settori, rosa/calendario/storico/classifica/allenamenti e dati Finanza.', v_team_name, array_length(v_all_sector_ids, 1);
end $$;

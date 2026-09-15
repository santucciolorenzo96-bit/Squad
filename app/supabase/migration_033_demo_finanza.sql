-- ============================================================================
-- SQUAD — migrazione 033
-- La cassa della società demo (e le date della 031, raddrizzate)
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, DOPO la 031.
--
-- DUE COSE.
--
-- 1. La 031 aveva lasciato fuori la finanza, e per un dirigente è la sezione
--    che guarda con più attenzione di tutte: è l'unica dove i numeri sono i
--    suoi soldi. Una schermata vuota lì dentro non dice «non l'abbiamo ancora
--    compilata», dice «non ci hanno pensato».
--
-- 2. Nella 031 avevo scritto la stagione a mano — «2025/2026» — invece di
--    ricavarla dalla data di oggi. Risultato: il tesseramento di tutte le
--    atlete scadeva il 30 giugno 2026, cioè nel passato, e la demo si sarebbe
--    aperta con dodici ragazze ferme per tesseramento scaduto. Qui si
--    raddrizza, e tutto quello che c'è sotto è calcolato sull'anno sportivo in
--    corso invece che su uno scritto nel file.
--
-- La cassa è piccola ma completa: due conti, le categorie di entrata e uscita,
-- i centri di costo per categoria sportiva, due sponsor, tre fornitori, le
-- quote di dodici atlete — otto pagate, due in ritardo, due non ancora scadute
-- — e le spese vere di una società di pallavolo: palestra, arbitri, iscrizione,
-- divise, palloni, pullman.
--
-- I numeri non sono cifre tonde: chi gestisce una società riconosce a occhio un
-- affitto palestra da 1.200 euro a rata e si insospettisce davanti a uno da
-- 10.000.
-- ============================================================================

do $$
declare
  v_team     uuid;
  v_serie    uuid;
  v_under    uuid;
  v_oggi     date := current_date;
  -- L'anno sportivo: da luglio a giugno. A settembre siamo nella stagione che
  -- comincia quest'anno; a marzo, in quella cominciata l'anno scorso.
  v_anno     int := case when extract(month from current_date) >= 7
                         then extract(year from current_date)::int
                         else extract(year from current_date)::int - 1 end;
  v_ese      uuid;
  v_conto_b  uuid;
  v_conto_c  uuid;
  v_cc_serie uuid; v_cc_under uuid; v_cc_soc uuid;
  v_sp1      uuid; v_sp2 uuid;
  v_forn_pal uuid; v_forn_att uuid; v_forn_fed uuid;
  v_e_quote  uuid; v_e_sponsor uuid; v_e_contrib uuid;
  v_u_pal    uuid; v_u_arb uuid; v_u_att uuid; v_u_isc uuid; v_u_tras uuid;
  v_entry    uuid;
  r          record;
  i          int := 0;
begin

  select id into v_team from teams where invite_code = 'DEMOVB';
  if v_team is null then
    raise exception 'La società demo non c''è: esegui prima la 031.';
  end if;

  select id into v_serie from sectors where team_id = v_team and name = 'Serie D femminile';
  select id into v_under from sectors where team_id = v_team and name = 'Under 16 femminile';


  -- ==========================================================================
  -- 0. LE DATE DELLA 031, RADDRIZZATE
  -- ==========================================================================
  -- Stagione, data di iscrizione e scadenza dei tesseramenti seguono l'anno
  -- sportivo in corso invece di quello che avevo scritto io. Si può rieseguire
  -- senza danno: sono tre update idempotenti.
  update seasons
     set name = v_anno::text || '/' || (v_anno + 1)::text,
         start_date = make_date(v_anno, 7, 1),
         end_date = make_date(v_anno + 1, 6, 30)
   where team_id = v_team;

  update players set joined_at = make_date(v_anno, 9, 1) where team_id = v_team;

  update player_documents
     set expires_at = make_date(v_anno + 1, 6, 30)
   where team_id = v_team and doc_type = 'tesseramento_fip';


  -- ==========================================================================
  -- 1. L'ESERCIZIO
  -- ==========================================================================
  -- Va da luglio a giugno come l'anno sportivo, non come l'anno solare: è il
  -- motivo per cui esiste come oggetto invece di essere «il 2025».
  if exists (select 1 from fiscal_years where team_id = v_team) then
    raise notice 'La cassa della demo esiste già: raddrizzate solo le date.';
    return;
  end if;

  insert into fiscal_years (team_id, name, start_date, end_date)
  values (v_team, v_anno::text || '/' || (v_anno + 1)::text,
          make_date(v_anno, 7, 1), make_date(v_anno + 1, 6, 30))
  returning id into v_ese;


  -- ==========================================================================
  -- 2. I CONTI
  -- ==========================================================================
  insert into finance_accounts (team_id, name, type, iban, initial_balance, initial_balance_date)
  values (v_team, 'Conto corrente BCC', 'bank', 'IT60X0542811101000000123456', 6800.00, make_date(v_anno, 7, 1))
  returning id into v_conto_b;

  insert into finance_accounts (team_id, name, type, initial_balance, initial_balance_date)
  values (v_team, 'Cassa contanti', 'cash', 320.00, make_date(v_anno, 7, 1))
  returning id into v_conto_c;


  -- ==========================================================================
  -- 3. LE CATEGORIE
  -- ==========================================================================
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'income', 'Quote associative', 0) returning id into v_e_quote;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'income', 'Sponsor', 1) returning id into v_e_sponsor;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'income', 'Contributi e 5x1000', 2) returning id into v_e_contrib;

  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'expense', 'Affitto palestra', 0) returning id into v_u_pal;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'expense', 'Arbitraggi e gare', 1) returning id into v_u_arb;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'expense', 'Materiale sportivo', 2) returning id into v_u_att;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'expense', 'Iscrizioni e tesseramenti', 3) returning id into v_u_isc;
  insert into finance_categories (team_id, kind, name, sort_order) values (v_team, 'expense', 'Trasferte', 4) returning id into v_u_tras;


  -- ==========================================================================
  -- 4. I CENTRI DI COSTO
  -- ==========================================================================
  -- Rispondono alla domanda che un consiglio direttivo fa sempre: «quanto ci
  -- costa la prima squadra rispetto al settore giovanile».
  insert into cost_centers (team_id, sector_id, name, sort_order) values (v_team, v_serie, 'Serie D', 0) returning id into v_cc_serie;
  insert into cost_centers (team_id, sector_id, name, sort_order) values (v_team, v_under, 'Under 16', 1) returning id into v_cc_under;
  insert into cost_centers (team_id, name, sort_order) values (v_team, 'Società', 2) returning id into v_cc_soc;


  -- ==========================================================================
  -- 5. SPONSOR E FORNITORI
  -- ==========================================================================
  insert into finance_sponsors (team_id, name, contract_value, contract_start, contract_end)
  values (v_team, 'Termoidraulica Pasini', 3500.00, make_date(v_anno, 9, 1), make_date(v_anno + 1, 6, 30))
  returning id into v_sp1;

  insert into finance_sponsors (team_id, sector_id, name, contract_value, contract_start, contract_end)
  values (v_team, v_serie, 'Bar Centrale Rimini', 1200.00, make_date(v_anno, 9, 1), make_date(v_anno + 1, 6, 30))
  returning id into v_sp2;

  insert into finance_suppliers (team_id, name, vat_number, email)
  values (v_team, 'Comune di Rimini — impianti sportivi', '00304260409', 'impianti@comune.rimini.it')
  returning id into v_forn_pal;

  insert into finance_suppliers (team_id, name, vat_number)
  values (v_team, 'Sport Service Romagna', '02914560401')
  returning id into v_forn_att;

  insert into finance_suppliers (team_id, name)
  values (v_team, 'FIPAV — Comitato Territoriale')
  returning id into v_forn_fed;


  -- ==========================================================================
  -- 6. LE QUOTE DELLE ATLETE
  -- ==========================================================================
  -- Trecento euro a testa. Otto pagate, DUE IN RITARDO — scadute la settimana
  -- scorsa — e due che devono ancora scadere. Senza i due ritardi la schermata
  -- Scadenze non avrebbe niente da mostrare, ed è quella che un tesoriere apre
  -- per prima.
  for r in (
    select p.id, p.name
    from players p
    join player_sectors ps on ps.player_id = p.id
    where p.team_id = v_team and ps.sector_id = v_serie
    order by p.created_at
  ) loop
    i := i + 1;

    insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                                 accrual_date, due_date, description, player_id)
    values (v_team, v_ese, 'income', v_e_quote, 300.00,
            make_date(v_anno, 9, 1),
            case when i <= 8 then make_date(v_anno, 9, 10)
                 when i <= 10 then v_oggi - 7          -- in ritardo
                 else v_oggi + 25 end,                 -- non ancora scadute
            'Quota associativa ' || v_anno::text || '/' || (v_anno + 1)::text || ' · ' || r.name,
            r.id)
    returning id into v_entry;

    insert into finance_entry_allocations (entry_id, cost_center_id, amount)
    values (v_entry, v_cc_serie, 300.00);

    if i <= 8 then
      insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
      values (v_team, v_entry,
              case when i % 4 = 0 then v_conto_c else v_conto_b end,
              'income', 300.00, make_date(v_anno, 9, 1) + i,
              case when i % 4 = 0 then 'contanti' else 'bonifico' end, true);
    end if;
  end loop;


  -- ==========================================================================
  -- 7. SPONSOR E CONTRIBUTI
  -- ==========================================================================
  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, sponsor_id)
  values (v_team, v_ese, 'income', v_e_sponsor, 3500.00,
          make_date(v_anno, 9, 1), make_date(v_anno, 12, 31),
          'Sponsorizzazione stagionale · maglia da gara', v_sp1)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_soc, 3500.00);
  -- Metà adesso, metà a dicembre: è come si firmano davvero questi contratti.
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'income', 1750.00, make_date(v_anno, 9, 8), 'bonifico', true);

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, sponsor_id)
  values (v_team, v_ese, 'income', v_e_sponsor, 1200.00,
          make_date(v_anno, 9, 1), v_oggi + 12,
          'Sponsorizzazione · pannello a bordo campo', v_sp2)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 1200.00);

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, party_name)
  values (v_team, v_ese, 'income', v_e_contrib, 640.00,
          make_date(v_anno, 8, 20), make_date(v_anno, 8, 20),
          '5x1000 — annualità ' || (v_anno - 2)::text, 'Agenzia delle Entrate')
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_soc, 640.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'income', 640.00, make_date(v_anno, 8, 20), 'bonifico', true);


  -- ==========================================================================
  -- 8. LA PALESTRA
  -- ==========================================================================
  -- Quattro rate da 1.200: la prima pagata, le altre tre ancora da pagare. È la
  -- voce più grossa di qualunque società che non ha un impianto suo, ed è
  -- quella su cui un dirigente si riconosce.
  --
  -- Due terzi alla Serie D e un terzo all'Under 16: usano la stessa palestra in
  -- giorni diversi, ed è così che un costo condiviso si divide davvero.
  for i in 1 .. 4 loop
    insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                                 accrual_date, due_date, description, supplier_id)
    values (v_team, v_ese, 'expense', v_u_pal, 1200.00,
            (make_date(v_anno, 7, 31) + ((i - 1) * interval '2 months'))::date,
            (make_date(v_anno, 8, 10) + ((i - 1) * interval '2 months'))::date,
            'Affitto Palestra Comunale · rata ' || i || ' di 4',
            v_forn_pal)
    returning id into v_entry;

    insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 800.00);
    insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_under, 400.00);

    if i = 1 then
      insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
      values (v_team, v_entry, v_conto_b, 'expense', 1200.00, make_date(v_anno, 8, 8), 'bonifico', true);
    end if;
  end loop;


  -- ==========================================================================
  -- 9. ISCRIZIONI, MATERIALE, ARBITRI, TRASFERTE
  -- ==========================================================================
  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, supplier_id)
  values (v_team, v_ese, 'expense', v_u_isc, 1450.00,
          make_date(v_anno, 8, 25), make_date(v_anno, 9, 5),
          'Iscrizione campionato Serie D e tesseramenti', v_forn_fed)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 1450.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'expense', 1450.00, make_date(v_anno, 9, 3), 'bonifico', true);

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, supplier_id)
  values (v_team, v_ese, 'expense', v_u_isc, 780.00,
          make_date(v_anno, 8, 25), make_date(v_anno, 9, 5),
          'Iscrizione campionato Under 16 e tesseramenti', v_forn_fed)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_under, 780.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'expense', 780.00, make_date(v_anno, 9, 3), 'bonifico', true);

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, supplier_id)
  values (v_team, v_ese, 'expense', v_u_att, 1680.00,
          make_date(v_anno, 7, 20), make_date(v_anno, 8, 5),
          'Divise da gara e da riscaldamento · 24 completi', v_forn_att)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 1120.00);
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_under, 560.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'expense', 1680.00, make_date(v_anno, 8, 4), 'bonifico', true);

  -- Non pagata: scade fra cinque giorni, e serve a far vedere una scadenza che
  -- non è ancora un problema accanto a due che lo sono.
  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, supplier_id)
  values (v_team, v_ese, 'expense', v_u_att, 310.00, v_oggi - 10, v_oggi + 5,
          'Palloni da gara Mikasa · 6 pezzi', v_forn_att)
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 310.00);

  -- Un arbitraggio per ogni gara in casa già giocata, pagato in contanti la
  -- sera stessa: è esattamente come funziona.
  for i in 1 .. 3 loop
    insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                                 accrual_date, due_date, description, party_name)
    values (v_team, v_ese, 'expense', v_u_arb, 85.00,
            v_oggi - (35 - (i - 1) * 14), v_oggi - (35 - (i - 1) * 14),
            'Arbitraggio gara interna · giornata ' || (i * 2 - 1),
            'Designazione arbitrale FIPAV')
    returning id into v_entry;
    insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 85.00);
    insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
    values (v_team, v_entry, v_conto_c, 'expense', 85.00, v_oggi - (35 - (i - 1) * 14), 'contanti', true);
  end loop;

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, party_name)
  values (v_team, v_ese, 'expense', v_u_tras, 240.00, v_oggi - 28, v_oggi - 20,
          'Pullman trasferta Cesenatico', 'Autolinee Adriatica')
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 240.00);
  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, reconciled)
  values (v_team, v_entry, v_conto_b, 'expense', 240.00, v_oggi - 19, 'bonifico', true);

  insert into finance_entries (team_id, fiscal_year_id, kind, category_id, planned_amount,
                               accrual_date, due_date, description, party_name)
  values (v_team, v_ese, 'expense', v_u_tras, 240.00, v_oggi - 14, v_oggi + 2,
          'Pullman trasferta Bellaria', 'Autolinee Adriatica')
  returning id into v_entry;
  insert into finance_entry_allocations (entry_id, cost_center_id, amount) values (v_entry, v_cc_serie, 240.00);

  delete from notifications where team_id = v_team;

  raise notice 'Cassa della demo creata per l''anno sportivo %/%.', v_anno, v_anno + 1;
end
$$;


-- ============================================================================
-- PER TOGLIERLA
-- ============================================================================
-- Va via insieme alla società: delete from teams where invite_code = 'DEMOVB';
-- ============================================================================

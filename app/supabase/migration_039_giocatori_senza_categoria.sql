-- ============================================================================
-- SQUAD — migrazione 039
-- Un giocatore senza categoria si vede ma non si tocca: chiudiamo la crepa
-- ============================================================================
--
-- IL GUASTO, COM'E' ARRIVATO
--
-- «new row violates row-level security policy» caricando la fotografia di un
-- atleta dall'Anagrafica. Le regole del deposito c'erano tutte ed erano
-- giuste: il rifiuto non veniva da una migrazione saltata, veniva dal fatto
-- che chi caricava non soddisfaceva la condizione.
--
-- LEGGERE E SCRIVERE DICEVANO DUE COSE DIVERSE
--
-- La lettura della rosa (players_select, migrazione 011) dice:
--
--     sei amministratore
--     oppure il giocatore sta in una categoria a cui hai accesso
--     oppure IL GIOCATORE NON STA IN NESSUNA CATEGORIA     <-- questa riga
--
-- L'ultima riga esiste apposta: un giocatore appena creato, o rimasto fuori
-- da un passaggio di stagione, non deve sparire dagli occhi della societa'.
--
-- La scrittura (has_sector_access_to_player) invece dice solo:
--
--     sei amministratore
--     oppure il giocatore sta in una categoria a cui hai accesso
--
-- Risultato: un allenatore VEDE quel giocatore in elenco, apre la sua scheda,
-- carica la foto — e il database rifiuta. Non e' un permesso mancante, e' una
-- incoerenza: mostriamo una riga che poi non si lascia modificare. Lo stesso
-- valeva per l'anagrafica, i documenti e la scheda evolutiva, perche' tutte
-- passano da questa funzione.
--
-- LA CORREZIONE
--
-- Una riga sola, la stessa che la lettura ha gia': un giocatore che non sta in
-- nessuna categoria e' di tutta la societa'. Chi gestisce (can_manage_player
-- resta `is_team_manager() and ...`, quindi genitori e atleti restano fuori)
-- puo' occuparsene finche' qualcuno non lo assegna.
--
-- Non allarga niente di piu': quel giocatore era gia' visibile a tutti.

create or replace function has_sector_access_to_player(p_player_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select is_admin()
    or exists (
      select 1 from player_sectors psec
      join profile_sectors ps on ps.sector_id = psec.sector_id
      where psec.player_id = p_player_id and ps.profile_id = auth.uid()
    )
    -- Come in players_select: senza categoria, il giocatore e' di tutti.
    or not exists (
      select 1 from player_sectors psec where psec.player_id = p_player_id
    )
$$;


-- ============================================================================
-- CHI ERA RIMASTO SENZA CATEGORIA
-- ============================================================================
-- Non cambia niente, serve solo a vedere se il caso c'era davvero e quanto e'
-- diffuso. Zero righe qui vuol dire che il guasto sulla foto aveva l'altra
-- causa — il pulsante mostrato a un genitore — corretta nell'app.

select p.id, p.number, p.name, p.created_at
  from players p
 where not exists (select 1 from player_sectors ps where ps.player_id = p.id)
 order by p.created_at desc;

-- ============================================================================
-- SQUAD — migrazione 060
-- Cancellare un tabellino: solo un amministratore, aperto o chiuso
-- ============================================================================
--
-- La 035 aveva due regole dentro la stessa policy:
--
--   * una partita CHIUSA la toglie solo un amministratore;
--   * un tabellino ancora APERTO lo scarta chi lo stava tenendo — chi ha
--     accesso a quella categoria, o un genitore abilitato a segnare.
--
-- La seconda regge finché il tabellino aperto è davvero vuoto. Ma «aperto»
-- non vuol dire «vuoto»: una partita segnata per un'ora intera è un tabellino
-- aperto come un altro, e il pulsante per buttarla via stava esattamente
-- nella schermata di chi la stava segnando — a bordo campo, su un tablet, di
-- fretta.
--
-- Una cancellazione non lascia traccia. La riga non c'è più, e nessuna
-- colonna dice chi l'ha toccata: non si può nemmeno ricostruire cosa è
-- successo. È così che è sparita una partita vera, segnata per intero.
--
-- Chi segna non perde nessuna via d'uscita, perché quella non distruttiva ce
-- l'aveva già: CHIUDERE la partita. Un tabellino chiuso per sbaglio finisce
-- nello storico — si vede, si corregge, e un amministratore lo può togliere.
-- Un tabellino scartato non finisce in nessun posto.
--
-- L'applicazione dice la stessa cosa in `canDeleteGame` (utils/permissions.js),
-- e il test `cancellazionePartita` è scritto guardando questa policy. Le tre
-- devono restare d'accordo: altrimenti si finisce con un pulsante che il
-- database rifiuta, o con il pulsante che serviva e non c'è.

drop policy if exists "games_delete" on games;

create policy "games_delete" on games for delete
  using (team_id = current_team_id() and is_admin());


-- ----------------------------------------------------------------- CONTROLLO
-- La policy non deve più nominare lo stato della partita né gli accessi di
-- settore: se `cita_stato_o_settore` è false, la stretta è andata a segno.

select
  policyname,
  qual like '%is_admin()%'                                   as chiede_amministratore,
  (qual like '%status%' or qual like '%has_sector_access%'
   or qual like '%can_score_matches%')                        as cita_stato_o_settore
from pg_policies
where tablename = 'games' and policyname = 'games_delete';

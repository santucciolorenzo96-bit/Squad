-- ============================================================================
-- SQUAD — migrazione 035
-- Cancellare una partita: la policy che non c'è mai stata
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor di Supabase, dopo la 034.
-- È idempotente: rieseguirla non fa danni.
--
-- IL PROBLEMA
--
-- Su `games` la sicurezza a livello di riga è attiva dal primo giorno, e ci
-- sono le policy di lettura, di inserimento e di aggiornamento. Di
-- cancellazione no: nessuna, mai.
--
-- Con la sicurezza a livello di riga, una cancellazione non permessa NON è un
-- errore. È una cancellazione di zero righe, che torna indietro senza dire
-- niente. Quindi «Scarta il tabellino» nella schermata Scout, che esiste da
-- sempre, non ha mai cancellato niente: l'app diceva «tabellino scartato» e il
-- tabellino restava dov'era.
--
-- È lo stesso modo di fallire dell'allenamento senza stagione della 034: in
-- silenzio, sembrando riuscito. Sono i guasti che costano di più, perché
-- nessuno li cerca.
--
-- LA REGOLA
--
-- Due casi con due rischi diversi, e quindi due regole dentro la stessa policy.
--
-- Un tabellino ancora APERTO è un errore in corso: aperto per sbaglio, o su una
-- partita che poi non si è giocata. Lo scarta chi lo stava tenendo — stessa
-- persona, stesso momento, niente da perdere.
--
-- Una partita CHIUSA è storia: dentro ci sono il risultato, il tabellino di
-- ogni giocatore e tutto quello che quei numeri producono in statistiche,
-- record e medie. Quella la toglie solo un amministratore. Non perché gli
-- altri siano meno affidabili: perché è l'unica cosa in quella schermata che
-- non si può rifare a memoria.
--
-- L'applicazione dice la stessa cosa in `canDeleteGame` (utils/permissions.js).
-- Le due devono restare d'accordo, altrimenti si finisce con un pulsante che
-- il database rifiuta — o, peggio, senza il pulsante che invece servirebbe.

drop policy if exists "games_delete" on games;

create policy "games_delete" on games for delete
  using (
    team_id = current_team_id()
    and (
      -- La storia la tocca solo un amministratore.
      is_admin()
      -- Il tabellino aperto lo scarta chi lo sta tenendo.
      or (
        status = 'live'
        and (
          sector_id is null
          or has_sector_access(sector_id)
          or (has_family_access(sector_id) and family_can_score_matches())
        )
      )
    )
  );

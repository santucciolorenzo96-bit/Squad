-- ============================================================================
-- SQUAD — l'ultimo orfano: Gianni Monreale 7
-- ============================================================================
--
-- Confermato: e' la stessa persona di «Gianni Morreale» numero 20, in rosa
-- nella DR2. Il cognome del primo inserimento era sbagliato — una erre invece
-- di due — ed e' stato corretto reinserendolo, lasciando indietro la riga
-- vecchia.
--
-- Non si porta dietro niente: il PASSO E2 aveva contato zero documenti, zero
-- presenze, zero schede evolutive, zero comunicazioni, zero movimenti
-- economici e zero account collegati. E' un guscio vuoto.
--
-- Questo file sta a se': se hai gia' lanciato il PASSO I2 non serve rilanciare
-- niente di quello.

-- ============================================================================
-- GUARDA PRIMA — deve uscire UNA riga sola
-- ============================================================================

select p.id, p.number, p.name, p.created_at
  from players p join teams t on t.id = p.team_id
 where t.name = 'Cestistica Etnea'
   and trim(p.number) = '7'
   and lower(trim(p.name)) = 'gianni monreale'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id);

-- ============================================================================
-- CANCELLA
-- ============================================================================
-- Il filtro e' triplo — numero 7, cognome con una erre sola, e nessuna
-- categoria — cosi' il Morreale in rosa non puo' essere toccato nemmeno per
-- sbaglio: lui ha il 20, due erre, e una categoria.

delete from players p
 using teams t
 where t.id = p.team_id
   and t.name = 'Cestistica Etnea'
   and trim(p.number) = '7'
   and lower(trim(p.name)) = 'gianni monreale'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id);

-- ============================================================================
-- LA VERIFICA FINALE — deve uscire ZERO righe
-- ============================================================================
-- Nessun giocatore della Cestistica Etnea fuori da ogni rosa. Da qui in avanti
-- non se ne creano di nuovi: la migrazione 039 ha allineato scrittura e
-- lettura, e l'app non lascia piu' a meta' un giocatore appena creato.

select p.number, p.name, p.created_at
  from players p join teams t on t.id = p.team_id
 where t.name = 'Cestistica Etnea'
   and not exists (select 1 from player_sectors ps where ps.player_id = p.id);

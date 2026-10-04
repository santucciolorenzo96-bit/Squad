-- ============================================================================
-- SQUAD — migrazione 058
-- Le categorie tornano piatte: via le sottocategorie
-- ============================================================================
--
-- La migrazione 025 aveva aggiunto una gerarchia alle categorie: un settore
-- poteva avere un genitore, e «Under 15 · Blu» era una sottocategoria di
-- «Under 15».
--
-- Si toglie, per due ragioni.
--
-- LA PRIMA: non la usava nessuno. Zero righe con `parent_id` valorizzato in
-- tutto il database, su tutte le società. Una funzionalità che nessuno usa non
-- è gratis — costava una colonna, un indice, un trigger, e l'indentazione da
-- disegnare e mantenere in quattro schermate diverse.
--
-- LA SECONDA, ed è quella che conta: aveva un buco che non si poteva chiudere
-- senza inventare una semantica nuova. NESSUNA lettura aggregava i figli. Rosa,
-- allenamenti, calendario, partite e statistiche cercano tutte il settore per
-- corrispondenza esatta (`sector_id = ?`), quindi aprire una categoria che
-- aveva sottocategorie mostrava una rosa vuota, nessun allenamento e nessuna
-- partita — senza una riga che dicesse perché. Da fuori non sembrava una
-- scelta: sembrava un guasto.
--
-- Aggregare i figli avrebbe risolto quel sintomo e aperto tre domande peggiori:
-- dove si aggiunge un atleta, di chi è una partita, quale calendario si sta
-- guardando. Una categoria è una squadra. Se due gruppi si allenano e giocano
-- separati sono due categorie; se non lo fanno, sono una.
--
-- NOTA: le sottocategorie della FINANZA non c'entrano niente. Sono un'altra
-- tabella — `finance_categories`, migrazione 006 — e lì la gerarchia serve
-- davvero per i bilanci. Questa migrazione non la tocca.

-- ----------------------------------------------------------------- PASSO 1
-- Il controllo prima di toccare: se qualcuno nel frattempo ne avesse create,
-- questa migrazione si ferma invece di cancellargli delle categorie.
--
-- `on delete cascade` sulla colonna vuol dire che togliere la colonna NON
-- cancella righe — i dati sono al sicuro comunque — ma un `parent_id` che
-- sparisce senza che nessuno se ne accorga trasformerebbe una sottocategoria
-- in una categoria di primo livello con un nome che da solo non si capisce
-- («Blu»). Meglio fermarsi e rinominarle prima.

do $$
declare
  n int;
begin
  select count(*) into n from sectors where parent_id is not null;
  if n > 0 then
    raise exception
      'Ci sono % sottocategorie: rinominale per esteso (per esempio «Under 15 Blu») e rilancia questa migrazione.', n;
  end if;
end $$;


-- ----------------------------------------------------------------- PASSO 2
-- Via il trigger, l'indice e la colonna. In quest'ordine: il trigger dipende
-- dalla colonna, l'indice pure.

drop trigger if exists sectors_depth_guard_trg on sectors;
drop function if exists sectors_depth_guard();
drop index if exists sectors_parent_idx;

alter table sectors drop column if exists parent_id;


-- ----------------------------------------------------------------- CONTROLLO
-- Deve restituire zero righe: la colonna non c'è più.

select column_name
from information_schema.columns
where table_name = 'sectors' and column_name = 'parent_id';

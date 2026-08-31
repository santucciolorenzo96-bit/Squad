-- ============================================================================
-- Team Manager Basket — migrazione 012
-- Dati fiscali della società, necessari ai documenti amministrativi
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase, dopo la migrazione 011.
--
-- La dichiarazione per la detrazione 730 e il modulo d'iscrizione devono
-- riportare gli estremi dell'associazione: senza questi campi uscirebbero con
-- gli spazi in bianco. Sono tutti facoltativi: chi non li compila ottiene
-- comunque il documento, con le righe corrispondenti vuote da completare a mano.
-- ============================================================================

alter table teams add column fiscal_code text;        -- codice fiscale dell'associazione
alter table teams add column vat_number text;         -- partita IVA, se presente
alter table teams add column address text;            -- sede legale: via e numero
alter table teams add column zip text;
alter table teams add column province text;
alter table teams add column legal_rep text;          -- legale rappresentante
alter table teams add column registry_number text;    -- numero di iscrizione al Registro delle attività sportive
alter table teams add column contact_email text;
alter table teams add column contact_phone text;

-- Nessuna nuova policy: teams ha già select per i membri della squadra e
-- update riservato all'amministrazione (is_admin(), migrazione 011).

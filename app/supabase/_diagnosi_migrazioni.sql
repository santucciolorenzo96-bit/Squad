-- ============================================================================
-- Diagnosi: quali migrazioni sono passate
-- ============================================================================
-- Non modifica niente: si limita a leggere il catalogo di Postgres e a dire
-- quali migrazioni risultano applicate e quali no.
--
-- Serve perché una migrazione saltata non si manifesta subito: la 011 è
-- rimasta indietro per settimane e il sintomo è arrivato molto dopo, sotto
-- forma di ruoli che comparivano come "UNDEFINED" e di registrazioni rifiutate
-- dal database. Questa query rende visibile quello che prima era silenzioso.
--
-- Eseguila nel SQL Editor di Supabase quando qualcosa non torna, o dopo aver
-- applicato una serie di migrazioni per controllare di non averne persa una.
--
-- NOTA sulle funzioni: la presenza si verifica leggendo pg_proc, non con
-- to_regproc(). to_regproc vuole il NOME della funzione, non la firma con le
-- parentesi: to_regproc('is_admin()') restituisce NULL sempre, anche quando la
-- funzione esiste, e la migrazione risulterebbe mancante per sbaglio. Era
-- esattamente il difetto della prima versione di questo file.
-- ============================================================================

with atteso(ordine, migrazione, descrizione, presente) as (
  values
    (2,  '002 settori',        'Settori, documenti giocatore, allenamenti',
         to_regclass('public.sectors') is not null),
    (3,  '003 calendario',     'Calendario partite',
         to_regclass('public.calendar') is not null),
    (4,  '004 notifiche',      'Notifiche, allenamenti ricorrenti, presenze',
         to_regclass('public.training_attendance') is not null),
    (5,  '005 foto focal',     'Inquadratura delle foto giocatore',
         exists (select 1 from information_schema.columns
                 where table_name = 'players' and column_name = 'photo_focal_x')),
    (6,  '006 finanza',        'Conti, categorie, entrate, uscite, scadenze',
         to_regclass('public.finance_entries') is not null),
    (7,  '007 profilo',        'Telefono nel profilo, finanza per le famiglie',
         exists (select 1 from information_schema.columns
                 where table_name = 'profiles' and column_name = 'phone')),
    (8,  '008 dati famiglia',  'Caricamento documenti abilitabile per account',
         exists (select 1 from information_schema.columns
                 where table_name = 'profiles' and column_name = 'can_upload_documents')),
    (9,  '009 profilo sicuro', 'Chiusura dell''escalation di privilegi sul profilo',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'update_my_profile')),
    (10, '010 ruoli',          'Permessi di settore e permesso tabellino',
         exists (select 1 from information_schema.columns
                 where table_name = 'profiles' and column_name = 'can_score_matches')),
    (11, '011 nuovi ruoli',    'Sette ruoli: presidente, staff, genitore, atleta',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'is_admin')),
    (12, '012 dati fiscali',   'Dati fiscali della società per la modulistica',
         exists (select 1 from information_schema.columns
                 where table_name = 'teams' and column_name = 'vat_number')),
    (13, '013 fix finanza',    'Fine della ricorsione infinita sulle entrate',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'my_finance_role')),
    (14, '014 comunicazioni',  'Convocazioni con conferme tracciate',
         to_regclass('public.communications') is not null),
    (15, '015 scheda evolutiva','Obiettivo e nota dell''allenatore per atleta',
         to_regclass('public.player_development') is not null),
    (16, '016 sport',          'Sport della società: calcio e pallavolo',
         exists (select 1 from information_schema.columns
                 where table_name = 'teams' and column_name = 'sport')),
    (17, '017 scout',          'Punteggio periodo per periodo',
         exists (select 1 from information_schema.columns
                 where table_name = 'games' and column_name = 'period_scores')),
    (18, '018 risultati',      'Risultati di giornata e classifica calcolata',
         to_regclass('public.league_matches') is not null),
    (19, '019 partita aperta', 'Una partita dal vivo per categoria',
         exists (select 1 from pg_indexes
                 where indexname = 'games_one_live_per_sector')),
    (20, '020 staff',          'Registrazione dello staff col codice invito',
         exists (select 1 from pg_constraint
                 where conname = 'profiles_role_check'
                   and pg_get_constraintdef(oid) like '%staff%')),
    (21, '021 stagioni',       'Stagioni sportive, playoff e scadenze di settembre',
         to_regclass('public.seasons') is not null),
    (22, '022 privacy',         'Consenso registrato, cancellazione e accesso ai dati',
         exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                 where n.nspname = 'public' and p.proname = 'erase_player'))
)
select
  migrazione,
  case when presente then 'OK' else '>>> MANCANTE <<<' end as stato,
  descrizione
from atteso
order by ordine;

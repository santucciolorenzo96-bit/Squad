-- ============================================================================
-- CARICAMENTO DOCUMENTI: PERCHE' UNA FAMIGLIA NON RIESCE
-- ============================================================================
-- Da incollare nel SQL Editor di Supabase. Ogni passo restituisce SEMPRE una
-- riga: un elenco vuoto non si distingue da «non ha funzionato».

-- 1. LA MIGRAZIONE 059 E' STATA ESEGUITA?
--    Prima della 059 una famiglia poteva caricare solo se la societa' le aveva
--    acceso `can_upload_documents` — che nasce spento e non si poteva accendere
--    da nessuna parte. Se le due policy nominano ancora quel permesso, TUTTE
--    le famiglie ricevono un rifiuto del database.
select
  not exists (
    select 1 from pg_policies
    where policyname in ('player_documents_insert', 'player_documents_storage_write')
      and coalesce(qual, '') || coalesce(with_check, '') like '%family_can_upload_documents%'
  ) as policy_059_ok,
  not exists (select 1 from pg_proc where proname = 'family_can_upload_documents')
    as funzione_vecchia_tolta;
-- Se una delle due e' false: lancia supabase/migration_059_caricamento_documenti_libero.sql


-- 2. CHI NON PUO' CARICARE PERCHE' NON E' COLLEGATO A NESSUNA SCHEDA
--    Una famiglia carica solo per il PROPRIO atleta: lo dice profile_players.
--    Un genitore o un atleta senza quel collegamento riceve un rifiuto anche a
--    migrazione eseguita. Sempre una riga: quanti sono, e chi.
select
  count(*) as senza_scheda,
  coalesce(string_agg(p.display_name || ' (' || p.role || ')', ', '), '— nessuno —') as chi
from profiles p
where p.role in ('genitore', 'atleta')
  and p.active
  and p.approved_at is not null
  and not exists (select 1 from profile_players pp where pp.profile_id = p.id);


-- 3. FILE ORFANI NEL BUCKET
--    Il file si carica, poi si scrive la riga del documento: se la seconda
--    scrittura cadeva (rete, policy) il file restava senza nessun documento che
--    lo nomini, e ogni nuovo tentativo ne lasciava un altro. Da questa versione
--    l'app li toglie da sola; questi sono quelli di prima.
select
  count(*) as file_orfani,
  coalesce(pg_size_pretty(sum((o.metadata->>'size')::bigint)), '0 bytes') as peso
from storage.objects o
where o.bucket_id = 'player-documents'
  and not exists (select 1 from player_documents d where d.file_path = o.name);


-- 4. GLI ULTIMI CARICAMENTI, per vedere se qualcuno ci riesce
--    (sempre una riga di riepilogo, poi il dettaglio sotto)
select
  count(*) filter (where uploaded_at > now() - interval '30 days') as ultimi_30_giorni,
  count(*) filter (where uploaded_at > now() - interval '30 days' and status = 'in_review') as ancora_da_approvare,
  max(uploaded_at) as ultimo_caricamento
from player_documents;

-- ============================================================================
-- SQUAD — migrazione 059
-- Atleti e genitori caricano i documenti del proprio atleta, sempre
-- ============================================================================
--
-- Fino a oggi una famiglia poteva caricare un documento solo se la società le
-- aveva acceso `profiles.can_upload_documents`. Quel permesso nasce SPENTO
-- (`not null default false`), e l'interruttore per accenderlo era rimasto
-- nella vecchia interfaccia — quella che non si disegna più.
--
-- Risultato: non si poteva accendere da nessuna parte. Il caricamento dei
-- documenti da parte delle famiglie era spento per tutte le società, senza che
-- nessuno l'avesse deciso, e il pulsante «Carica» compariva lo stesso — quindi
-- chi lo premeva riceveva un rifiuto delle policy, con il messaggio del
-- database.
--
-- Il permesso non si rimette: si toglie.
--
-- Un documento caricato da una famiglia nasce `in_review` e NON COPRE finché
-- qualcuno non lo approva. Il permesso metteva un cancello davanti a un flusso
-- che ha già il cancello dietro, e in cambio chiedeva un interruttore da
-- accendere per ogni famiglia della società — quaranta interruttori per una
-- società di quaranta famiglie.
--
-- QUELLO CHE NON CAMBIA, e che è il motivo per cui si può fare:
--
--   * si carica solo per il PROPRIO atleta. Lo dice
--     `has_family_access_to_player`, che resta in tutte e due le policy;
--   * APPROVARE resta a chi gestisce — admin, presidente, allenatore, staff.
--     Le policy di update non si toccano: una famiglia non può cambiare lo
--     stato di un documento, nemmeno del proprio;
--   * cancellare resta allo staff.

-- ----------------------------------------------------------------- PASSO 1
-- La riga sulla tabella.
--
-- Il ramo dello staff resta `can_manage_player` e NON `has_sector_access`: la
-- 008 usava il secondo, la 010 l'ha stretto al primo, e quella che vale e'
-- l'ultima. Ricopiare la 008 senza accorgersene avrebbe riaperto il
-- caricamento a chi quel settore lo vede soltanto. L'unica cosa che cambia e'
-- il ramo della famiglia.

drop policy if exists "player_documents_insert" on player_documents;

create policy "player_documents_insert" on player_documents for insert
  with check (
    team_id = current_team_id()
    and (
      can_manage_player(player_id)
      or has_family_access_to_player(player_id)
    )
  );


-- ----------------------------------------------------------------- PASSO 2
-- Il file nel bucket. Il percorso è `societa/giocatore/nomefile`, quindi il
-- secondo pezzo della cartella è l'identificativo dell'atleta.

drop policy if exists "player_documents_storage_write" on storage.objects;

create policy "player_documents_storage_write" on storage.objects for insert
  with check (
    bucket_id = 'player-documents'
    and (
      can_manage_player(((storage.foldername(name))[2])::uuid)
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
    )
  );


-- ----------------------------------------------------------------- PASSO 3
-- La funzione non la usa più nessuno.
--
-- La colonna `profiles.can_upload_documents` RESTA, e non è una dimenticanza:
-- toglierla farebbe fallire la lettura dei profili su qualunque scheda ancora
-- aperta con la versione precedente dell'app, finché non la ricarica. Una
-- colonna inerte non fa danno; una schermata che smette di caricarsi sì.
-- Si potrà togliere con una riga, fra qualche giorno:
--
--     alter table profiles drop column if exists can_upload_documents;

drop function if exists family_can_upload_documents();


-- ----------------------------------------------------------------- CONTROLLO
-- Le due policy non devono più nominare il permesso. Zero righe = fatto.

select tablename, policyname
from pg_policies
where policyname in ('player_documents_insert', 'player_documents_storage_write')
  and qual || coalesce(with_check, '') like '%can_upload_documents%';

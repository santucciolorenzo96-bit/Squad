-- ============================================================================
-- SQUAD — migrazione 056
-- Gli atleti vedono i nomi dei compagni ma non le facce
-- ============================================================================
--
-- In Rosa e in Anagrafica una famiglia vede tutta la squadra della propria
-- categoria: nomi, numeri, ruoli. È voluto — `players_select` lo dice da
-- sempre, e una rosa in cui vedi solo tuo figlio non è una rosa.
--
-- Le fotografie no. La regola di lettura del deposito chiede o l'accesso da
-- staff a quella categoria, o il collegamento a QUELL'ATLETA: un'atleta vede
-- la propria faccia e nient'altro. In elenco compaiono tutti, ma con le
-- iniziali al posto del volto.
--
-- Non era una decisione: era la regola scritta guardando lo staff, e per le
-- famiglie è rimasta più stretta di quella che regge l'elenco accanto.
--
-- PERCHÉ ALLARGARLA È GIUSTO
--
-- La fotografia della rosa sta lì per farsi riconoscere: è il motivo per cui
-- l'abbiamo messa nello scout. I compagni di squadra si allenano insieme tre
-- volte a settimana — le facce le conoscono. Nasconderle a loro e mostrarle a
-- tutto lo staff della società non protegge nessuno, toglie solo senso
-- all'elenco.
--
-- Si allarga quanto basta e non di più: alla PROPRIA CATEGORIA, la stessa che
-- già si vede per nome. Un genitore dell'Under 15 continua a non vedere le
-- fotografie della prima squadra.

drop policy if exists "player_photos_storage_read" on storage.objects;
create policy "player_photos_storage_read" on storage.objects for select
  using (
    bucket_id = 'player-photos'
    and (
      -- Lo staff con accesso alla categoria dell'atleta.
      has_sector_access_to_player(((storage.foldername(name))[2])::uuid)
      -- La famiglia di quell'atleta.
      or has_family_access_to_player(((storage.foldername(name))[2])::uuid)
      -- E la famiglia di un COMPAGNO di quella categoria: la stessa
      -- condizione che regge l'elenco in cui quelle facce vanno.
      or exists (
        select 1 from player_sectors ps
         where ps.player_id = ((storage.foldername(name))[2])::uuid
           and has_family_access(ps.sector_id)
      )
    )
  );


-- ============================================================================
-- CONTROLLO
-- ============================================================================
-- Non si può provare da qui: `auth.uid()` nel SQL Editor è vuoto, e la regola
-- parla di chi guarda. Si prova dall'app, con un account atleta: in Rosa le
-- facce dei compagni della sua categoria devono comparire, quelle delle altre
-- categorie no.
--
-- Questa intanto dice che la regola è stata sostituita davvero.

select policyname, cmd
  from pg_policies
 where schemaname = 'storage' and tablename = 'objects'
   and policyname = 'player_photos_storage_read';

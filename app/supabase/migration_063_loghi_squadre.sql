-- ============================================================================
-- SQUAD — migrazione 063
-- I loghi delle squadre del girone, e un vincolo che a luglio sarebbe scoppiato
-- ============================================================================
--
-- Due cose che non c'entrano fra loro, in una migrazione sola perché la seconda
-- l'ho trovata guardando la prima, e lasciarla là voleva dire ritrovarla fra
-- otto mesi quando avrebbe fatto danno.

-- ----------------------------------------------------------------- PASSO 1
-- IL LOGO DI UNA SQUADRA DEL GIRONE.
--
-- Il logo della nostra società ce l'ha `teams.logo_url`. Delle altre non
-- c'era nessun posto dove metterlo, e in una classifica il logo è la cosa che
-- permette di trovare la propria riga senza leggere: in un elenco di nove
-- nomi scritti tutti in maiuscolo — «A.S.D. MENS SANA MASCALUCIA», «ASS.DIL.
-- POL. ARETUSA» — si legge la forma prima della parola.
--
-- VA SU `standings`, e non in una tabella nuova, perché quella tabella è già
-- l'elenco delle squadre del girone: una riga per squadra, con lo stesso
-- settore, la stessa stagione e gli stessi permessi. Una tabella in più
-- vorrebbe dire due elenchi di squadre da tenere d'accordo, e due elenchi
-- della stessa cosa si scollano sempre.
--
-- Il percorso e non l'indirizzo: il deposito è privato e si legge con URL
-- firmati a scadenza, come le foto degli atleti.

alter table standings add column if not exists logo_path text;


-- ----------------------------------------------------------------- PASSO 2
-- Il deposito dei loghi.
--
-- Privato come gli altri. La cartella è l'identificativo della SOCIETÀ — non
-- della squadra avversaria — ed è su quella che si regge il controllo degli
-- accessi: ogni società vede e scrive solo i loghi che ha caricato lei.

insert into storage.buckets (id, name, public)
  values ('team-logos', 'team-logos', false)
  on conflict (id) do nothing;

-- In scrittura: chi gestisce. Lo stesso gruppo che può scrivere la classifica
-- — admin, presidente, allenatore, staff — perché il logo è un dato della
-- classifica e non deve avere un cancello diverso da quello della riga a cui
-- appartiene.
drop policy if exists "team_logos_write" on storage.objects;
create policy "team_logos_write" on storage.objects for insert
  with check (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = current_team_id()::text
    and is_team_manager()
  );

drop policy if exists "team_logos_update" on storage.objects;
create policy "team_logos_update" on storage.objects for update
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = current_team_id()::text
    and is_team_manager()
  );

drop policy if exists "team_logos_delete" on storage.objects;
create policy "team_logos_delete" on storage.objects for delete
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = current_team_id()::text
    and is_team_manager()
  );

-- In lettura: tutta la società, famiglie comprese. La classifica la guardano
-- tutti, e un logo che si vede a metà degli utenti è peggio di nessun logo.
drop policy if exists "team_logos_read" on storage.objects;
create policy "team_logos_read" on storage.objects for select
  using (
    bucket_id = 'team-logos'
    and (storage.foldername(name))[1] = current_team_id()::text
  );


-- ----------------------------------------------------------------- PASSO 3
-- IL VINCOLO CHE A LUGLIO SAREBBE SCOPPIATO.
--
-- `league_matches_unique` sta su (settore, giornata, casa, trasferta) e serve
-- a impedire che lo stesso accoppiamento entri due volte nella stessa
-- giornata — è il modo in cui un doppio inserimento gonfierebbe la classifica
-- in silenzio. Giusto.
--
-- Ma la STAGIONE non c'è dentro. Fra un anno, nello stesso campionato e nello
-- stesso settore, la prima giornata avrà di nuovo le stesse due squadre: il
-- vincolo la rifiuterebbe come un doppione, e il calendario della stagione
-- nuova si caricherebbe a metà — senza un errore comprensibile, perché
-- «duplicate key» non dice «hai cambiato anno».
--
-- Non è un difetto che si vede provando: si vede a luglio. Si chiude adesso,
-- che costa una riga.
--
-- Le righe con `season_id` nullo restano distinte fra loro come prima, perché
-- Postgres considera i NULL diversi l'uno dall'altro: sono i recuperi e le
-- amichevoli, e devono poter esistere più volte.

drop index if exists league_matches_unique;

create unique index if not exists league_matches_unique
  on league_matches(sector_id, season_id, giornata, home_team, away_team);


-- ----------------------------------------------------------------- CONTROLLO
-- La colonna, il deposito, e l'indice che adesso conosce la stagione.
-- Tre `true`.

select
  exists (select 1 from information_schema.columns
          where table_name = 'standings' and column_name = 'logo_path')   as c_e_la_colonna,
  exists (select 1 from storage.buckets where id = 'team-logos')          as c_e_il_deposito,
  exists (select 1 from pg_indexes
          where indexname = 'league_matches_unique'
            and indexdef like '%season_id%')                              as indice_con_stagione;

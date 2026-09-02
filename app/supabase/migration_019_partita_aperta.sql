-- ============================================================================
-- Team Manager Basket — migrazione 019
-- Una partita dal vivo per CATEGORIA, non per società
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase. È scritta per essere eseguibile
-- anche se hai già lanciato la 017 o la 018: le colonne si aggiungono solo se
-- mancano, quindi non dà errore in nessuno dei due casi.
--
-- IL PROBLEMA
--
-- `games_one_live_per_team` imponeva una sola partita in corso per SOCIETÀ,
-- ma l'app cerca la partita in corso per SETTORE (fetchLiveGame filtra su
-- sector_id). I due non concordavano, e la conseguenza era invisibile:
--
--   - resta aperta una partita nell'Under 17 (dati di test, o un tentativo
--     interrotto a metà);
--   - apri Partita in Prima Squadra: l'app non la vede, perché guarda solo
--     il settore attivo, e ti mostra "Nuova partita";
--   - premi Inizia: il database rifiuta l'inserimento per l'indice unico;
--   - non succede niente.
--
-- Con più categorie — che è il caso normale di una società — le due partite
-- dal vivo sono legittime: sabato pomeriggio giocano l'Under 15 e la Prima
-- Squadra insieme, e due persone diverse tengono i due tabellini. Il vincolo
-- giusto è per settore.
--
-- COME VEDERE SE HAI PARTITE RIMASTE APERTE
--
--   select g.id, s.name as settore, g.opp_name, g.started_at
--   from games g left join sectors s on s.id = g.sector_id
--   where g.status = 'live';
--
-- Dalla 019 in poi l'app te le mostra da sola quando apri Partita, con la
-- possibilità di riprenderle o di chiuderle.
-- ============================================================================

alter table games add column if not exists period_scores jsonb not null default '[]'::jsonb;
alter table games add column if not exists calendar_match_id uuid references calendar(id) on delete set null;
create index if not exists games_calendar_match_idx on games(calendar_match_id);

drop index if exists games_one_live_per_team;

create unique index if not exists games_one_live_per_sector
  on games(sector_id) where (status = 'live');

-- ============================================================================
-- Team Manager Basket — migrazione 005: punto focale foto giocatore
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor del progetto Supabase, dopo le migrazioni
-- precedenti. Si applica in più sullo schema esistente.
-- ============================================================================

alter table players add column photo_focal_x numeric not null default 50;
alter table players add column photo_focal_y numeric not null default 50;

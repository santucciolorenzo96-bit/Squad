-- ============================================================================
-- SQUAD — diagnosi: «new row violates row-level security policy» sulle foto
-- ============================================================================
-- Nessuna modifica: solo domande. Esegui i quattro passi e mandami le
-- risposte; dal codice non si vede quale dei quattro casi sia, e tirare a
-- indovinare su una policy vuol dire aprire un permesso che non serviva.
--
-- CHE COSA STIAMO CERCANDO
--
-- Caricare una foto tocca due cose: il deposito dei file (storage.objects) e
-- la riga del giocatore o del profilo. L'errore arriva da un `with check` che
-- ha detto di no, e i sospetti sono quattro:
--
--   1. il deposito non esiste;
--   2. le regole di scrittura non ci sono (una migrazione non eseguita, o
--      eseguita prima che il deposito esistesse);
--   3. ci sono, ma chi sta caricando non le soddisfa;
--   4. il percorso del file non ha la forma che le regole si aspettano.
--
-- I passi qui sotto li escludono uno per uno.

-- ============================================================================
-- PASSO 1 — I DUE DEPOSITI ESISTONO?
-- ============================================================================
-- Devono comparire due righe: player-photos e user-avatars, entrambe private.

select id, name, public, created_at
  from storage.buckets
 where id in ('player-photos', 'user-avatars')
 order by id;

-- ============================================================================
-- PASSO 2 — QUALI REGOLE CI SONO SUL DEPOSITO?
-- ============================================================================
-- Ci si aspetta, per le foto degli atleti: read, write, update, delete.
-- Per gli avatar: avatars_write_own, avatars_update_own, avatars_delete_own,
-- avatars_read_team.
--
-- `cmd` dice a quale operazione si applica ciascuna: se manca la riga con
-- INSERT, il caricamento non può che fallire — ed è il sospetto numero due.

select
  policyname,
  cmd,
  -- La condizione per scrivere: è quella che ha detto di no.
  coalesce(with_check, qual) as condizione
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
  and (policyname like 'player_photos%' or policyname like 'avatars%')
order by policyname;

-- ============================================================================
-- PASSO 3 — IO, ADESSO, COSA SONO?
-- ============================================================================
-- Va eseguito DALL'APP, non dal SQL Editor: nell'editor sei il proprietario
-- del database e `auth.uid()` è nullo, quindi risponderebbe di un utente che
-- non esiste.
--
-- Il modo più rapido: apri SQUAD, apri la console del browser (F12) e incolla
--
--     const { data } = await window.supabase.rpc('chi_sono_per_le_foto');
--     console.table(data);
--
-- Se `window.supabase` non c'è, salta questo passo: i primi due bastano a
-- capire se il problema è il sospetto 1 o 2.

create or replace function chi_sono_per_le_foto()
returns table (
  utente uuid,
  ruolo text,
  e_amministratore boolean,
  gestisce_la_societa boolean,
  categorie_assegnate int
)
language sql stable security definer set search_path = public as $$
  select
    auth.uid(),
    my_role(),
    is_admin(),
    is_team_manager(),
    (select count(*)::int from profile_sectors where profile_id = auth.uid())
$$;

grant execute on function chi_sono_per_le_foto() to authenticated;

-- ============================================================================
-- PASSO 4 — CHE FORMA HANNO I FILE GIÀ CARICATI?
-- ============================================================================
-- Se in passato qualche foto è entrata, la sua forma dice quale percorso le
-- regole hanno accettato. Le foto degli atleti devono stare in
-- «societa/atleta/file», gli avatar in «utente/file».
--
-- Zero righe qui non è di per sé un guasto: vuol dire solo che non è mai
-- entrato niente, ed è compatibile con tutti e quattro i sospetti.

select
  bucket_id,
  name as percorso,
  array_length(storage.foldername(name), 1) as quante_cartelle,
  created_at
from storage.objects
where bucket_id in ('player-photos', 'user-avatars')
order by created_at desc
limit 20;

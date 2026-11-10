-- ============================================================================
-- DUE ACCOUNT DI PROVA DELLA PALLAVOLO: CANCELLAZIONE
-- ============================================================================
-- NON SI ANNULLA.
--
-- L'anteprima ha mostrato tre profili chiamati «Dario Morè»:
--
--   dariosquad@gmail.com      admin     Volley Demo Aurora   (pallavolo)  -> SI CANCELLA
--   megadario93@hotmail.it    genitore  Volley Demo Aurora   (pallavolo)  -> SI CANCELLA
--   dario.more993@gmail.com   atleta    Cestistica Etnea     (basket)     -> RESTA
--
-- Per questo si cancella per EMAIL ESATTA e non per nome: il nome e' lo stesso
-- per tutti e tre, e un nome non distingue un account di prova da quello vero.
--
-- Fa quello che fa «Cancella l'account» nella console SuperAdmin (funzione
-- delete_account, migrazione 032), senza la regola «deve rimanere un
-- amministratore» che esiste solo nella schermata Utenti: cancella la riga in
-- auth.users, e con lei il profilo, i collegamenti agli atleti e le categorie
-- assegnate. Le email tornano libere. Quello che hanno inserito nella societa'
-- resta, e perde solo il nome dell'autore.
--
-- Dopo, Volley Demo Aurora non ha piu' nessun profilo: il tuo account
-- SuperAdmin ci entra come amministratore, ma da li' non puo' approvare chi si
-- iscrive con il codice (quella funzione cerca un profilo admin dentro la
-- societa').
--
-- SI FERMA, SENZA CAMBIARE NIENTE, se:
--   · l'account da tenere non esiste, o e' fra quelli da cancellare;
--   · i due account non sono esattamente due, tutti e due in una societa' di
--     pallavolo;
--   · uno dei due e' un amministratore di piattaforma.

do $$
declare
  v_tengo uuid;
  v_n int;
begin
  select id into v_tengo from auth.users where lower(email) = 'dario.more993@gmail.com';
  if v_tengo is null then
    raise exception 'Non trovo l''account da tenere (dario.more993@gmail.com). Nessuna modifica fatta.';
  end if;

  select count(*) into v_n
  from auth.users u
  join profiles p on p.id = u.id
  join teams t on t.id = p.team_id
  where lower(u.email) in ('dariosquad@gmail.com', 'megadario93@hotmail.it')
    and lower(t.sport) = 'pallavolo'
    and u.id <> v_tengo;
  if v_n <> 2 then
    raise exception 'Trovo % account da cancellare in una societa'' di pallavolo, ne aspettavo 2. Nessuna modifica fatta.', v_n;
  end if;

  if exists (
    select 1 from platform_owners o join auth.users u on u.id = o.user_id
    where lower(u.email) in ('dariosquad@gmail.com', 'megadario93@hotmail.it')
  ) then
    raise exception 'Uno dei due e'' un amministratore di piattaforma: non lo cancello da qui. Nessuna modifica fatta.';
  end if;

  delete from auth.users
   where lower(email) in ('dariosquad@gmail.com', 'megadario93@hotmail.it')
     and id <> v_tengo;
  get diagnostics v_n = row_count;

  -- Se non sono esattamente due, si torna indietro: la funzione e' una sola
  -- transazione e l'eccezione annulla anche la cancellazione appena fatta.
  if v_n <> 2 then
    raise exception 'Ho cancellato % account ma ne aspettavo 2. Annullo tutto.', v_n;
  end if;
end
$$;

-- CONTROLLO: una riga sola. Devono dire tutte e due true.
select
  (select count(*) from auth.users
    where lower(email) in ('dariosquad@gmail.com', 'megadario93@hotmail.it')) = 0 as due_account_cancellati,
  exists (
    select 1 from profiles p
    join auth.users u on u.id = p.id
    join teams t on t.id = p.team_id
    where lower(u.email) = 'dario.more993@gmail.com'
      and p.role = 'atleta' and t.name = 'Cestistica Etnea'
  ) as account_da_tenere_intatto;

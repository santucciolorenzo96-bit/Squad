-- ============================================================================
-- ACCOUNT «DARIO MORE»: CANCELLAZIONE
-- ============================================================================
-- NON SI ANNULLA. Lancia prima l'anteprima (_account_dario_anteprima.sql) e
-- controlla che sia l'account giusto.
--
-- Fa quello che fa il comando «Cancella l'account» della console SuperAdmin
-- (funzione delete_account, migrazione 032), senza la regola «deve rimanere un
-- amministratore» che esiste solo nella schermata Utenti: cancella la riga in
-- auth.users, e con lei il profilo, i collegamenti agli atleti, le categorie
-- assegnate e l'indirizzo email, che torna libero. Quello che l'account ha
-- inserito nella societa' resta, e perde solo il nome dell'autore.
--
-- SI FERMA, SENZA CAMBIARE NIENTE, se:
--   · i profili che si chiamano cosi' non sono esattamente uno;
--   · quel profilo non sta in una societa' di PALLAVOLO (un omonimo nella
--     societa' di basket non si tocca);
--   · e' un amministratore di piattaforma.
--
-- Alla fine risponde con una riga che dice se e' sparito.

do $$
declare
  v_n int;
  v_id uuid;
  v_email text;
  v_societa text;
  v_sport text;
  v_owner boolean;
begin
  select count(*) into v_n from profiles where lower(display_name) like 'dario mor%';
  if v_n <> 1 then
    raise exception 'Trovo % profili che si chiamano Dario Mor..., ne serve esattamente uno. Nessuna modifica fatta.', v_n;
  end if;

  select p.id, u.email::text, t.name, t.sport
    into v_id, v_email, v_societa, v_sport
  from profiles p
  join auth.users u on u.id = p.id
  left join teams t on t.id = p.team_id
  where lower(p.display_name) like 'dario mor%';

  if coalesce(lower(v_sport), '') <> 'pallavolo' then
    raise exception 'Questo account sta nella societa'' «%» (sport: %), non in quella di pallavolo. Nessuna modifica fatta.',
      coalesce(v_societa, 'nessuna'), coalesce(v_sport, 'nessuno');
  end if;

  select exists (select 1 from platform_owners o where o.user_id = v_id) into v_owner;
  if v_owner then
    raise exception 'E'' un amministratore di piattaforma: non lo cancello da qui. Nessuna modifica fatta.';
  end if;

  delete from auth.users where id = v_id;
  raise notice 'Cancellato % (%), societa'' %.', v_email, v_id, v_societa;
end
$$;

-- CONTROLLO: una riga sola. Deve dire true.
select
  not exists (select 1 from profiles where lower(display_name) like 'dario mor%') as account_sparito,
  (select count(*) from profiles p join teams t on t.id = p.team_id
    where lower(t.sport) = 'pallavolo' and p.role in ('admin', 'presidente') and p.active) as admin_rimasti_nelle_societa_di_pallavolo;

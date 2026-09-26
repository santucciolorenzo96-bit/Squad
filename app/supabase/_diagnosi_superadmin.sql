-- ============================================================================
-- SQUAD — diagnosi: «Cannot coerce the result to a single JSON object»
-- ============================================================================
-- Non modifica niente. Due domande.
--
-- L'errore arriva da `select * from teams where id = ... limit 1` che torna
-- ZERO righe. La policy di lettura su teams e' una riga sola:
--
--     using (id = current_team_id())
--
-- Quindi delle due l'una: current_team_id() risponde NULL, oppure risponde una
-- societa' DIVERSA da quella che l'app sta chiedendo. Le due domande qui sotto
-- distinguono i casi, e sono le uniche che servono.

-- ============================================================================
-- PASSO 1 — IL PROFILO DEL SUPERADMIN
-- ============================================================================
-- Per ogni amministratore di piattaforma: ha un profilo? E' attivo? E soprattutto
-- `approvato` e' pieno?
--
-- La migrazione 046 fa dipendere current_team_id() da approved_at: se per
-- qualche ragione quella colonna e' rimasta vuota su questo profilo, la
-- funzione risponde null e teams non si lascia leggere. E' il primo sospetto.

select
  u.email,
  p.id            as profilo,
  p.role          as ruolo,
  p.active        as attivo,
  p.approved_at   as approvato,
  p.team_id       as societa_del_profilo,
  t.name          as nome_societa
from auth.users u
left join profiles p on p.id = u.id
left join teams t on t.id = p.team_id
where exists (select 1 from platform_owners po where po.user_id = u.id);


-- ============================================================================
-- PASSO 2 — DENTRO QUALE SOCIETA' RISULTA
-- ============================================================================
-- platform_presence e' la societa' in cui un amministratore di piattaforma e'
-- ENTRATO, e current_team_id() la guarda PRIMA del profilo. Se qui c'e' una
-- riga rimasta da una visita vecchia, il database risponde con quella societa'
-- mentre l'app ne sta chiedendo un'altra — e la lettura torna vuota.
--
-- Zero righe qui e' la risposta normale per chi non sta visitando nessuno.

select
  u.email,
  pp.team_id  as dentro_a,
  t.name      as nome,
  pp.entered_at as da_quando
from platform_presence pp
join auth.users u on u.id = pp.user_id
left join teams t on t.id = pp.team_id;


-- ============================================================================
-- PASSO 3 — QUANTI PROFILI SONO RIMASTI SENZA APPROVAZIONE
-- ============================================================================
-- Deve essere zero, o al massimo le persone che si sono iscritte DOPO la 046 e
-- aspettano davvero. Se qui compaiono profili vecchi, il back-fill della 046
-- non ha coperto tutto e vanno approvati a mano.

select p.id, p.display_name, p.role, p.created_at, t.name as societa
from profiles p
left join teams t on t.id = p.team_id
where p.approved_at is null
order by p.created_at;

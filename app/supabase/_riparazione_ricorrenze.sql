-- ============================================================================
-- SQUAD — riparazione: gli allenamenti ricorrenti generati il giorno prima
-- ============================================================================
-- NON è una migrazione. È una riparazione una tantum di dati, da eseguire
-- leggendo prima cosa trova e decidendo poi se applicarla.
--
-- COSA ERA SUCCESSO
--
-- La funzione che genera le occorrenze di un programma fisso partiva dalla
-- mezzanotte LOCALE del giorno voluto e la scriveva in UTC. In Italia la
-- mezzanotte di martedì è le 22:00 di lunedì, quindi ogni occorrenza è stata
-- salvata con la data del giorno PRECEDENTE a quello programmato.
--
-- Il difetto nel codice è chiuso (utils/format.js, giornoISO): da adesso le
-- occorrenze nuove nascono giuste. Questo file serve solo per quelle vecchie.
--
-- PRIMA DI ESEGUIRE, DUE COSE DA SAPERE
--
-- 1. Le occorrenze vengono generate SOLO dall'interfaccia precedente
--    (classica.html). La nuova non le crea ancora: se non hai mai usato i
--    programmi fissi da lì, il passo 1 non troverà niente ed è tutto a posto.
--
-- 2. Un allenamento generato e poi spostato a mano finisce nel conto se per
--    caso è stato spostato al giorno prima. Il passo 1 serve proprio a
--    guardarli uno per uno prima di toccarli.
--
-- ============================================================================
-- PASSO 1 — GUARDARE. Non modifica niente.
-- ============================================================================
-- `weekday` segue la convenzione di JavaScript e di Postgres: 0 = domenica.
-- Un'occorrenza sbagliata ha il giorno della settimana esattamente uno
-- indietro rispetto a quello del suo programma.

select
  s.name                                          as categoria,
  case r.weekday
    when 0 then 'domenica'  when 1 then 'lunedì'   when 2 then 'martedì'
    when 3 then 'mercoledì' when 4 then 'giovedì'  when 5 then 'venerdì'
    else 'sabato' end                             as programmato_di,
  t.date                                          as data_attuale,
  case extract(dow from t.date)::int
    when 0 then 'domenica'  when 1 then 'lunedì'   when 2 then 'martedì'
    when 3 then 'mercoledì' when 4 then 'giovedì'  when 5 then 'venerdì'
    else 'sabato' end                             as cade_di,
  t.date + 1                                      as data_corretta,
  t.title,
  t.start_time,
  t.date < current_date                           as gia_passato,
  exists (
    select 1 from training_attendance a where a.training_id = t.id
  )                                               as ha_presenze,
  -- Se sulla data giusta c'è già un allenamento dello stesso programma, questo
  -- è un doppione: spostarlo creerebbe due allenamenti nello stesso giorno.
  exists (
    select 1 from trainings t2
     where t2.recurrence_id = t.recurrence_id
       and t2.date = t.date + 1
  )                                               as collide
from trainings t
join training_recurrences r on r.id = t.recurrence_id
join sectors s on s.id = t.sector_id
where t.recurrence_id is not null
  and extract(dow from t.date)::int = (r.weekday + 6) % 7
order by s.name, t.date;

-- ============================================================================
-- PASSO 2 — SISTEMARE. Esegui solo dopo aver guardato il passo 1.
-- ============================================================================
-- Sposta in avanti di un giorno le occorrenze sbagliate.
--
-- Le presenze NON si perdono: sono legate all'allenamento, non alla sua data,
-- quindi restano attaccate alla stessa riga che si sta spostando.
--
-- Si escludono le collisioni: dove sulla data giusta esiste già un allenamento
-- dello stesso programma, spostare creerebbe un doppione. Quelli, se ce ne
-- sono, il passo 1 li elenca e vanno decisi a mano.

update trainings t
   set date = t.date + 1
  from training_recurrences r
 where r.id = t.recurrence_id
   and extract(dow from t.date)::int = (r.weekday + 6) % 7
   and not exists (
     select 1 from trainings t2
      where t2.recurrence_id = t.recurrence_id
        and t2.date = t.date + 1
   );

-- ----------------------------------------------------------------------------
-- SOLO GLI ALLENAMENTI FUTURI, se preferisci non toccare il passato
-- ----------------------------------------------------------------------------
-- Il passato è già successo: la squadra si è allenata il giorno in cui si è
-- presentata, non quello scritto nell'app. Correggerlo rende lo storico
-- coerente col programma; lasciarlo stare lo lascia coerente con le presenze
-- che qualcuno ha segnato quel giorno. Non c'è una risposta giusta per tutti.
--
-- Per toccare solo il futuro, aggiungi questa riga alla update qui sopra:
--
--     and t.date >= current_date
--
-- ============================================================================
-- PASSO 3 — RICONTROLLARE
-- ============================================================================
-- Rieseguendo il passo 1 non deve restare niente, tranne le eventuali
-- collisioni.

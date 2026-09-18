-- ============================================================================
-- SQUAD — riparazione, secondo giro: le occorrenze DOPPIE
-- ============================================================================
-- Il primo giro presupponeva che le occorrenze sbagliate fossero da spostare.
-- Non lo sono: sulla data corretta ce n'è già una, quindi quelle nel giorno
-- sbagliato sono doppioni da togliere, non allenamenti da rimettere a posto.
--
-- Tutte sono già passate e nessuna ha presenze segnate, il che rende la
-- cancellazione la cosa meno invasiva che si possa fare.
--
-- Ma prima di cancellare qualcosa voglio sapere COS'È il gemello. Il passo A
-- non tocca niente e serve a quello.

-- ============================================================================
-- PASSO A — GUARDARE I DUE, AFFIANCATI. Non modifica niente.
-- ============================================================================
-- Per ogni occorrenza nel giorno sbagliato, accanto c'è quella del giorno
-- giusto. Se sono la stessa cosa — stesso orario, stesso luogo, stesso
-- programma — allora una delle due è di troppo, e si sa quale.
--
-- `creato_il` è la colonna che spiega la storia: dice quale delle due è
-- arrivata prima, e quindi da dove sono nate.

select
  s.name                        as categoria,
  sb.date                       as data_sbagliata,
  sb.created_at                 as sbagliata_creata_il,
  gi.date                       as data_giusta,
  gi.created_at                 as giusta_creata_il,
  sb.start_time = gi.start_time as stesso_orario,
  sb.location is not distinct from gi.location as stesso_luogo,
  sb.title      is not distinct from gi.title  as stesso_titolo,
  exists (select 1 from training_attendance a where a.training_id = gi.id)
                                as la_giusta_ha_presenze
from trainings sb
join training_recurrences r on r.id = sb.recurrence_id
join sectors s on s.id = sb.sector_id
join trainings gi
  on gi.recurrence_id = sb.recurrence_id
 and gi.date = sb.date + 1
where sb.recurrence_id is not null
  and extract(dow from sb.date)::int = (r.weekday + 6) % 7
order by s.name, sb.date;

-- ============================================================================
-- PASSO B — QUANTE SONO, IN TOTALE
-- ============================================================================
-- Un solo numero, per sapere cosa aspettarsi dalla cancellazione.

select count(*) as da_cancellare
from trainings sb
join training_recurrences r on r.id = sb.recurrence_id
where sb.recurrence_id is not null
  and extract(dow from sb.date)::int = (r.weekday + 6) % 7
  and exists (
    select 1 from trainings gi
     where gi.recurrence_id = sb.recurrence_id
       and gi.date = sb.date + 1
  );

-- ============================================================================
-- PASSO C — CANCELLARE. Esegui solo dopo aver letto A e B.
-- ============================================================================
-- Si cancella SOLO quello che è:
--   - nato da un programma fisso (recurrence_id non nullo)
--   - nel giorno esattamente precedente a quello programmato
--   - con il suo gemello già presente nel giorno giusto
--   - senza nessuna presenza segnata
--
-- L'ultima condizione è la più importante e non c'era nel primo file: se
-- qualcuno ha segnato le presenze su quella riga, quella riga è la storia di
-- una sera in cui la squadra c'era davvero, e non si butta via per riordinare
-- un calendario.

delete from trainings sb
 using training_recurrences r
 where r.id = sb.recurrence_id
   and extract(dow from sb.date)::int = (r.weekday + 6) % 7
   and exists (
     select 1 from trainings gi
      where gi.recurrence_id = sb.recurrence_id
        and gi.date = sb.date + 1
   )
   and not exists (
     select 1 from training_attendance a where a.training_id = sb.id
   );

-- ============================================================================
-- PASSO D — RICONTROLLARE
-- ============================================================================
-- Il passo B deve tornare 0. Se non torna 0, quello che resta ha delle
-- presenze segnate: va guardato uno per uno e deciso a mano, perché lì
-- dentro c'è il lavoro di qualcuno.

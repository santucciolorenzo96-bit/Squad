-- Che ruoli esistono davvero e quanti account per ciascuno
select coalesce(role, '(nullo)') as ruolo, count(*) as quanti
from profiles
group by role
order by quanti desc;

-- Gli account che l'app non sa etichettare
select id, display_name, role, active, created_at
from profiles
where role is null
   or role not in ('admin','presidente','staff','allenatore','segnapunti','genitore','atleta')
order by created_at;

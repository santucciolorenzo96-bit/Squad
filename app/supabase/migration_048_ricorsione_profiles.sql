-- ============================================================================
-- SQUAD — migrazione 048 — RIPARAZIONE URGENTE
-- La 046 ha chiuso fuori tutti: una policy su profiles che legge profiles
-- ============================================================================
--
-- COSA HO SBAGLIATO
--
-- Nella 046 ho scritto questa, per far vedere agli amministratori chi sta
-- aspettando di entrare:
--
--   create policy "profiles_select_pending_admin" on profiles for select
--     using (approved_at is null and exists (select 1 from profiles me ...));
--
-- Una policy SU profiles che legge DA profiles. Quella lettura interna riapplica
-- le policy di profiles, che riapplicano la lettura interna: Postgres se ne
-- accorge e risponde «infinite recursion detected in policy for relation
-- profiles». Non è un errore su quella riga: è un errore su OGNI lettura della
-- tabella, quindi anche su fetchMyProfile, che è la prima cosa che l'app fa
-- all'avvio. Da lì in poi non entra più nessuno — non solo il SuperAdmin.
--
-- Tutte le altre policy di questo database evitano il problema senza dirlo:
-- passano da funzioni SECURITY DEFINER — current_team_id(), my_role(),
-- is_admin() — che girano con i permessi del proprietario e quindi NON
-- riapplicano le policy. Questa era l'unica che leggeva la tabella a mano, ed
-- è l'unica che si è rotta.
--
-- La correzione è quella: la stessa condizione, dentro una funzione.

create or replace function sono_admin_della_societa(p_team uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles me
     where me.id = auth.uid()
       and me.active
       and me.approved_at is not null
       and me.team_id = p_team
       and me.role in ('admin', 'presidente')
  )
$$;

grant execute on function sono_admin_della_societa(uuid) to authenticated;

drop policy if exists "profiles_select_pending_admin" on profiles;
create policy "profiles_select_pending_admin" on profiles for select
  using (approved_at is null and sono_admin_della_societa(team_id));


-- ============================================================================
-- LA VERIFICA
-- ============================================================================
-- Deve rispondere senza errori. Se torna «infinite recursion», la policy
-- vecchia è ancora lì e la drop qui sopra non è passata.

select count(*) as profili_leggibili from profiles;

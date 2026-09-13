-- ============================================================================
-- SQUAD — migrazione 029
-- Partite amichevoli, e l'anagrafe delle società per il SuperAdmin
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor Supabase.
-- ============================================================================


-- ============================================================================
-- 1. CAMPIONATO O AMICHEVOLE
-- ============================================================================
-- Una colonna sola, con un default che dice la cosa giusta sul passato: tutte
-- le partite già archiviate sono di campionato, perché fino a ieri non c'era
-- modo di registrare un'amichevole e nessuno le stava segnando come tali.
--
-- Serve a leggere i numeri senza sbagliarsi: una sconfitta in amichevole di
-- agosto contro una squadra di categoria superiore non è una sconfitta in
-- classifica, e mescolarle rende la media punti una frase senza senso.

alter table games add column if not exists friendly boolean not null default false;


-- ============================================================================
-- 2. L'ANAGRAFE DELLE SOCIETÀ
-- ============================================================================
-- Chi amministra la piattaforma deve sapere QUALI società esistono. Non cosa
-- c'è dentro: quello resta di chi ne fa parte, ed è il motivo per cui le
-- policy sono scritte come sono — un SuperAdmin non è un superutente.
--
-- Quindi questa funzione restituisce l'anagrafe e nient'altro: nome, sport,
-- città, categoria, quando è nata, quante persone ci sono. NON restituisce il
-- codice società (è una credenziale), né rose, né documenti, né conti. Le
-- policy delle altre tabelle non vengono toccate: se un domani si volesse
-- vedere di più, bisognerebbe scriverlo qui dentro di proposito, e si
-- vedrebbe.

create or replace function list_societies()
returns table (
  id uuid,
  name text,
  city text,
  category text,
  sport text,
  created_at timestamptz,
  membri bigint,
  attivi bigint,
  categorie bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from platform_owners where user_id = auth.uid()) then
    raise exception 'Solo un amministratore della piattaforma può vedere l''elenco delle società.';
  end if;

  return query
    select
      t.id, t.name, t.city, t.category, t.sport, t.created_at,
      (select count(*) from profiles p where p.team_id = t.id),
      (select count(*) from profiles p where p.team_id = t.id and p.active),
      (select count(*) from sectors s where s.team_id = t.id)
    from teams t
    order by t.created_at desc;
end;
$$;

grant execute on function list_societies() to authenticated;

-- ============================================================================
-- Team Manager Basket — migrazione 006: modulo Finanza, schema core
-- ============================================================================
-- Esegui UNA VOLTA nel SQL Editor del progetto Supabase, dopo le migrazioni
-- precedenti. Si applica in più sullo schema esistente. Solo schema/RLS: le
-- schermate arrivano in una fase successiva.
--
-- Principio: competenza (finance_entries) ≠ movimento (finance_payments) ≠
-- documento (finance_documents). Stati e saldi non sono mai colonne scritte a
-- mano: sono derivati (viste finance_entries_status / finance_account_balances)
-- per evitare incoerenze.
-- ============================================================================

-- ============================================================================
-- RUOLO FINANZIARIO (separato dal ruolo sportivo esistente)
-- ============================================================================

alter table profiles add column finance_role text
  check (finance_role in ('admin', 'manager', 'viewer_team', 'viewer_sector'));
-- null = nessun accesso finanziario (default per allenatore/segnapunti/famiglia)

-- ============================================================================
-- TABELLE ANAGRAFICHE / CONFIGURAZIONE
-- ============================================================================

create table fiscal_years (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  start_date date not null,
  end_date date not null,
  closed boolean not null default false,
  closed_at timestamptz,
  closed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  constraint fiscal_years_dates check (end_date > start_date)
);
create index fiscal_years_team_idx on fiscal_years(team_id);

create table finance_categories (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  parent_id uuid references finance_categories(id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index finance_categories_team_idx on finance_categories(team_id);
create index finance_categories_parent_idx on finance_categories(parent_id);

create table cost_centers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid references sectors(id) on delete set null,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index cost_centers_team_idx on cost_centers(team_id);
create index cost_centers_sector_idx on cost_centers(sector_id);

create table finance_accounts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  type text not null check (type in ('bank', 'cash', 'card', 'paypal', 'other')),
  iban text,
  initial_balance numeric(12,2) not null default 0,
  initial_balance_date date not null default current_date,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
create index finance_accounts_team_idx on finance_accounts(team_id);

create table finance_suppliers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  name text not null,
  vat_number text,
  email text,
  phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index finance_suppliers_team_idx on finance_suppliers(team_id);

create table finance_sponsors (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid references sectors(id) on delete set null,
  name text not null,
  contract_value numeric(12,2),
  contract_start date,
  contract_end date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index finance_sponsors_team_idx on finance_sponsors(team_id);
create index finance_sponsors_sector_idx on finance_sponsors(sector_id);

create table finance_events (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  sector_id uuid references sectors(id) on delete set null,
  type text not null check (type in ('torneo', 'manifestazione', 'trasferta', 'altro')),
  name text not null,
  start_date date,
  end_date date,
  location text,
  notes text,
  created_at timestamptz not null default now()
);
create index finance_events_team_idx on finance_events(team_id);
create index finance_events_sector_idx on finance_events(sector_id);

-- ============================================================================
-- COMPETENZA / RIPARTIZIONE / MOVIMENTO / DOCUMENTO
-- ============================================================================

create table finance_entries (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  fiscal_year_id uuid references fiscal_years(id),
  kind text not null check (kind in ('income', 'expense')),
  category_id uuid not null references finance_categories(id),
  planned_amount numeric(12,2) not null check (planned_amount >= 0),
  accrual_date date not null,
  due_date date,
  description text not null,
  player_id uuid references players(id) on delete set null,
  sponsor_id uuid references finance_sponsors(id) on delete set null,
  supplier_id uuid references finance_suppliers(id) on delete set null,
  event_id uuid references finance_events(id) on delete set null,
  party_name text,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  notes text,
  constraint finance_entries_one_party check (
    (case when player_id is not null then 1 else 0 end
     + case when sponsor_id is not null then 1 else 0 end
     + case when supplier_id is not null then 1 else 0 end) <= 1
  )
);
create index finance_entries_team_idx on finance_entries(team_id);
create index finance_entries_fy_idx on finance_entries(fiscal_year_id);
create index finance_entries_category_idx on finance_entries(category_id);
create index finance_entries_player_idx on finance_entries(player_id);
create index finance_entries_sponsor_idx on finance_entries(sponsor_id);
create index finance_entries_supplier_idx on finance_entries(supplier_id);
create index finance_entries_event_idx on finance_entries(event_id);
create index finance_entries_due_date_idx on finance_entries(due_date);

create table finance_entry_allocations (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references finance_entries(id) on delete cascade,
  cost_center_id uuid not null references cost_centers(id),
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index finance_entry_allocations_entry_idx on finance_entry_allocations(entry_id);
create index finance_entry_allocations_cc_idx on finance_entry_allocations(cost_center_id);

create table finance_payments (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  entry_id uuid references finance_entries(id) on delete set null,
  account_id uuid not null references finance_accounts(id),
  kind text not null check (kind in ('income', 'expense')),
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null,
  method text not null check (method in ('contanti', 'bonifico', 'carta', 'assegno', 'paypal', 'altro')),
  reconciled boolean not null default false,
  cancelled_at timestamptz,
  cancelled_reason text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  notes text
);
create index finance_payments_team_idx on finance_payments(team_id);
create index finance_payments_entry_idx on finance_payments(entry_id);
create index finance_payments_account_idx on finance_payments(account_id);
create index finance_payments_paid_at_idx on finance_payments(paid_at);

create table finance_documents (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  entry_id uuid references finance_entries(id) on delete cascade,
  payment_id uuid references finance_payments(id) on delete cascade,
  file_path text not null,
  file_name text not null,
  mime_type text,
  doc_type text not null check (doc_type in (
    'fattura', 'ricevuta', 'nota_spese', 'ricevuta_pagamento',
    'documento_acquisto', 'contratto', 'documento_sponsor', 'altro'
  )),
  uploaded_by uuid references profiles(id),
  uploaded_at timestamptz not null default now(),
  constraint finance_documents_target check (entry_id is not null or payment_id is not null)
);
create index finance_documents_team_idx on finance_documents(team_id);
create index finance_documents_entry_idx on finance_documents(entry_id);
create index finance_documents_payment_idx on finance_documents(payment_id);

create table finance_audit_log (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  actor_id uuid references profiles(id),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index finance_audit_log_team_idx on finance_audit_log(team_id);
create index finance_audit_log_record_idx on finance_audit_log(table_name, record_id);

-- ============================================================================
-- FUNZIONI HELPER (stesso stile di has_sector_access/current_team_id)
-- ============================================================================

create or replace function has_finance_access()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and finance_role is not null)
$$;

create or replace function has_finance_manage_access()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager'))
$$;

create or replace function has_finance_sector_access(p_sector_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager', 'viewer_team'))
    or (
      p_sector_id is not null
      and exists (select 1 from profiles where id = auth.uid() and finance_role = 'viewer_sector')
      and has_sector_access(p_sector_id)
    )
$$;

create or replace function fiscal_year_for_date(p_team_id uuid, p_date date)
returns uuid language sql stable security definer set search_path = public as $$
  select id from fiscal_years
  where team_id = p_team_id and p_date between start_date and end_date
  order by start_date desc limit 1
$$;

create or replace function fiscal_year_closed_for_date(p_team_id uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(
    (select closed from fiscal_years
     where team_id = p_team_id and p_date between start_date and end_date
     order by start_date desc limit 1),
    false
  )
$$;

-- ============================================================================
-- TRIGGER DI INTEGRITÀ
-- ============================================================================

-- una categoria figlia deve avere lo stesso kind (entrata/uscita) del padre
create or replace function finance_categories_check_kind() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_parent_kind text;
begin
  if new.parent_id is not null then
    select kind into v_parent_kind from finance_categories where id = new.parent_id;
    if v_parent_kind is distinct from new.kind then
      raise exception 'La categoria figlia deve avere lo stesso tipo (entrata/uscita) della categoria padre';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_finance_categories_check_kind
before insert or update on finance_categories
for each row execute function finance_categories_check_kind();

-- risolve automaticamente l'esercizio dalla data di competenza, se non fornito
create or replace function finance_entries_set_fiscal_year() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.fiscal_year_id is null then
    new.fiscal_year_id := fiscal_year_for_date(new.team_id, new.accrual_date);
  end if;
  if new.fiscal_year_id is null then
    raise exception 'Nessun esercizio configurato per la data %', new.accrual_date;
  end if;
  return new;
end;
$$;
create trigger trg_finance_entries_set_fiscal_year
before insert on finance_entries
for each row execute function finance_entries_set_fiscal_year();

-- se si cambia l'importo di una competenza già ripartita, le ripartizioni
-- esistenti devono essere aggiornate prima (evita saldi incoerenti)
create or replace function finance_entries_check_allocation_sum() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sum numeric(12,2);
begin
  if tg_op = 'UPDATE' and new.planned_amount is distinct from old.planned_amount then
    select coalesce(sum(amount), 0) into v_sum from finance_entry_allocations where entry_id = new.id;
    if v_sum <> 0 and v_sum <> new.planned_amount then
      raise exception 'Aggiorna le ripartizioni prima di cambiare l''importo della competenza (attualmente ripartito: %)', v_sum;
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_finance_entries_check_allocation_sum
after update on finance_entries
for each row execute function finance_entries_check_allocation_sum();

-- la somma delle ripartizioni deve sempre coincidere con l'importo della competenza
-- (constraint trigger deferred a fine transazione: permette di inserire più righe
-- di ripartizione in un'unica chiamata senza fallire a metà)
create or replace function finance_entry_allocations_check_sum() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_entry_id uuid;
  v_planned numeric(12,2);
  v_sum numeric(12,2);
begin
  v_entry_id := coalesce(new.entry_id, old.entry_id);
  select planned_amount into v_planned from finance_entries where id = v_entry_id;
  select coalesce(sum(amount), 0) into v_sum from finance_entry_allocations where entry_id = v_entry_id;
  if v_planned is not null and v_sum <> v_planned then
    raise exception 'La somma delle ripartizioni (%) non corrisponde all''importo della competenza (%)', v_sum, v_planned;
  end if;
  return null;
end;
$$;
create constraint trigger trg_finance_entry_allocations_check_sum
after insert or update or delete on finance_entry_allocations
deferrable initially deferred
for each row execute function finance_entry_allocations_check_sum();

-- un pagamento collegato a una competenza deve avere lo stesso tipo (entrata/uscita)
create or replace function finance_payments_check_kind() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_entry_kind text;
begin
  if new.entry_id is not null then
    select kind into v_entry_kind from finance_entries where id = new.entry_id;
    if v_entry_kind is distinct from new.kind then
      raise exception 'Il tipo del pagamento deve corrispondere al tipo della competenza collegata';
    end if;
  end if;
  return new;
end;
$$;
create trigger trg_finance_payments_check_kind
before insert or update on finance_payments
for each row execute function finance_payments_check_kind();

-- ============================================================================
-- AUDIT LOG (append-only, popolato solo da trigger)
-- ============================================================================

create or replace function finance_audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_team_id uuid;
begin
  v_team_id := coalesce(new.team_id, old.team_id);
  insert into finance_audit_log (team_id, table_name, record_id, action, actor_id, old_data, new_data)
  values (
    v_team_id, tg_table_name, coalesce(new.id, old.id), lower(tg_op), auth.uid(),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );
  return coalesce(new, old);
end;
$$;

create trigger trg_finance_audit_entries
after insert or update or delete on finance_entries
for each row execute function finance_audit_trigger();

create trigger trg_finance_audit_payments
after insert or update or delete on finance_payments
for each row execute function finance_audit_trigger();

create trigger trg_finance_audit_documents
after insert or update or delete on finance_documents
for each row execute function finance_audit_trigger();

create trigger trg_finance_audit_fiscal_years
after insert or update or delete on fiscal_years
for each row execute function finance_audit_trigger();

-- ============================================================================
-- VISTE CALCOLATE (mai colonne duplicate per saldo/stato)
-- ============================================================================

create or replace view finance_account_balances
with (security_invoker = true) as
select
  a.id as account_id,
  a.team_id,
  (a.initial_balance + coalesce(sum(
    case when p.cancelled_at is null then
      case when p.kind = 'income' then p.amount else -p.amount end
    else 0 end
  ), 0))::numeric(12,2) as current_balance
from finance_accounts a
left join finance_payments p on p.account_id = a.id
group by a.id, a.team_id, a.initial_balance;

create or replace view finance_entries_status
with (security_invoker = true) as
select
  e.id as entry_id,
  e.team_id,
  e.planned_amount,
  coalesce(sum(case when p.cancelled_at is null then p.amount else 0 end), 0)::numeric(12,2) as paid_amount,
  (e.planned_amount - coalesce(sum(case when p.cancelled_at is null then p.amount else 0 end), 0))::numeric(12,2) as residual_amount,
  case
    when e.cancelled_at is not null then 'annullato'
    when coalesce(sum(case when p.cancelled_at is null then p.amount else 0 end), 0) = 0 then
      case when e.due_date is not null and e.due_date < current_date then 'scaduto' else 'previsto' end
    when coalesce(sum(case when p.cancelled_at is null then p.amount else 0 end), 0) >= e.planned_amount then
      case when e.kind = 'income' then 'incassato' else 'pagato' end
    else
      case when e.kind = 'income' then 'parzialmente_incassato' else 'parzialmente_pagato' end
  end as status
from finance_entries e
left join finance_payments p on p.entry_id = e.id
group by e.id;

-- ============================================================================
-- RLS
-- ============================================================================

alter table fiscal_years enable row level security;
alter table finance_categories enable row level security;
alter table cost_centers enable row level security;
alter table finance_accounts enable row level security;
alter table finance_suppliers enable row level security;
alter table finance_sponsors enable row level security;
alter table finance_events enable row level security;
alter table finance_entries enable row level security;
alter table finance_entry_allocations enable row level security;
alter table finance_payments enable row level security;
alter table finance_documents enable row level security;
alter table finance_audit_log enable row level security;

-- fiscal_years: la riapertura di un esercizio chiuso è riservata all'admin
create policy "fiscal_years_select" on fiscal_years for select
  using (team_id = current_team_id() and has_finance_access());
create policy "fiscal_years_insert" on fiscal_years for insert
  with check (team_id = current_team_id() and has_finance_manage_access());
create policy "fiscal_years_update" on fiscal_years for update
  using (
    team_id = current_team_id()
    and (
      exists (select 1 from profiles where id = auth.uid() and finance_role = 'admin')
      or (has_finance_manage_access() and not closed)
    )
  );

-- anagrafiche/configurazione: lettura a chiunque abbia accesso finanza, scrittura a admin/manager
create policy "finance_categories_select" on finance_categories for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_categories_write" on finance_categories for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

create policy "cost_centers_select" on cost_centers for select
  using (team_id = current_team_id() and has_finance_access());
create policy "cost_centers_write" on cost_centers for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

create policy "finance_accounts_select" on finance_accounts for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_accounts_write" on finance_accounts for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

create policy "finance_suppliers_select" on finance_suppliers for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_suppliers_write" on finance_suppliers for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

create policy "finance_sponsors_select" on finance_sponsors for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_sponsors_write" on finance_sponsors for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

create policy "finance_events_select" on finance_events for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_events_write" on finance_events for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

-- finance_entries: select filtrata per settore quando il ruolo è viewer_sector;
-- nessuna policy di delete (storno con cancelled_at, mai cancellazione reale)
create policy "finance_entries_select" on finance_entries for select
  using (
    team_id = current_team_id()
    and (
      exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager', 'viewer_team'))
      or (
        exists (select 1 from profiles where id = auth.uid() and finance_role = 'viewer_sector')
        and exists (
          select 1 from finance_entry_allocations fea
          join cost_centers cc on cc.id = fea.cost_center_id
          where fea.entry_id = finance_entries.id and cc.sector_id is not null and has_sector_access(cc.sector_id)
        )
      )
    )
  );
create policy "finance_entries_insert" on finance_entries for insert
  with check (
    team_id = current_team_id() and has_finance_manage_access()
    and not fiscal_year_closed_for_date(team_id, accrual_date)
  );
create policy "finance_entries_update" on finance_entries for update
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (
    team_id = current_team_id() and has_finance_manage_access()
    and not fiscal_year_closed_for_date(team_id, accrual_date)
  );

-- finance_entry_allocations: segue i permessi della entry collegata
create policy "finance_entry_allocations_select" on finance_entry_allocations for select
  using (
    exists (select 1 from finance_entries e where e.id = entry_id and e.team_id = current_team_id())
    and (
      exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager', 'viewer_team'))
      or (
        exists (select 1 from profiles where id = auth.uid() and finance_role = 'viewer_sector')
        and exists (
          select 1 from cost_centers cc
          where cc.id = finance_entry_allocations.cost_center_id and cc.sector_id is not null and has_sector_access(cc.sector_id)
        )
      )
    )
  );
create policy "finance_entry_allocations_write" on finance_entry_allocations for all
  using (
    exists (select 1 from finance_entries e where e.id = entry_id and e.team_id = current_team_id())
    and has_finance_manage_access()
  )
  with check (
    exists (select 1 from finance_entries e where e.id = entry_id and e.team_id = current_team_id())
    and has_finance_manage_access()
  );

-- finance_payments: stessa logica di visibilità per settore; nessuna policy di delete
create policy "finance_payments_select" on finance_payments for select
  using (
    team_id = current_team_id()
    and (
      exists (select 1 from profiles where id = auth.uid() and finance_role in ('admin', 'manager', 'viewer_team'))
      or (
        exists (select 1 from profiles where id = auth.uid() and finance_role = 'viewer_sector')
        and entry_id is not null
        and exists (
          select 1 from finance_entry_allocations fea
          join cost_centers cc on cc.id = fea.cost_center_id
          where fea.entry_id = finance_payments.entry_id and cc.sector_id is not null and has_sector_access(cc.sector_id)
        )
      )
    )
  );
create policy "finance_payments_insert" on finance_payments for insert
  with check (
    team_id = current_team_id() and has_finance_manage_access()
    and not fiscal_year_closed_for_date(team_id, paid_at)
  );
create policy "finance_payments_update" on finance_payments for update
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (
    team_id = current_team_id() and has_finance_manage_access()
    and not fiscal_year_closed_for_date(team_id, paid_at)
  );

-- finance_documents: visibilità base per chi ha accesso finanza (nessun filtro
-- di settore in questa fase — nessuna UI documenti ancora; da rivedere in Fase 4)
create policy "finance_documents_select" on finance_documents for select
  using (team_id = current_team_id() and has_finance_access());
create policy "finance_documents_write" on finance_documents for all
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());

-- finance_audit_log: sola lettura, nessuna policy di scrittura (solo trigger security definer)
create policy "finance_audit_log_select" on finance_audit_log for select
  using (team_id = current_team_id() and has_finance_access());

-- ============================================================================
-- STORAGE: bucket documenti finanziari (privato)
-- ============================================================================

insert into storage.buckets (id, name, public)
  values ('finance-documents', 'finance-documents', false)
  on conflict (id) do nothing;

create policy "finance_documents_storage_select" on storage.objects for select
  using (
    bucket_id = 'finance-documents' and has_finance_access()
    and (storage.foldername(name))[1] = current_team_id()::text
  );
create policy "finance_documents_storage_insert" on storage.objects for insert
  with check (
    bucket_id = 'finance-documents' and has_finance_manage_access()
    and (storage.foldername(name))[1] = current_team_id()::text
  );
create policy "finance_documents_storage_update" on storage.objects for update
  using (
    bucket_id = 'finance-documents' and has_finance_manage_access()
    and (storage.foldername(name))[1] = current_team_id()::text
  );
create policy "finance_documents_storage_delete" on storage.objects for delete
  using (
    bucket_id = 'finance-documents' and has_finance_manage_access()
    and (storage.foldername(name))[1] = current_team_id()::text
  );

-- ============================================================================
-- SQUAD — migrazione 045
-- «Ho pagato»: la famiglia lo dichiara, il tesoriere lo conferma
-- ============================================================================
--
-- I pagamenti li registra chi ha accesso gestionale alla finanza. La famiglia
-- vede quanto deve, ma non ha nessun modo di dire di aver pagato: il contante
-- passato al presidente in palestra esiste solo se il presidente si ricorda di
-- segnarlo, e a fine anno si discute.
--
-- UNA DICHIARAZIONE NON E' UN PAGAMENTO
--
-- E per questo non e' una riga di finance_payments. Un pagamento dice anche
-- SU QUALE CONTO e' entrato il denaro, e quello la famiglia non lo sa; e
-- soprattutto un pagamento entra nei saldi, mentre una dichiarazione no.
-- Finche' il tesoriere non conferma, la cassa non si muove di un euro.
--
-- Quello che la dichiarazione produce e' una traccia con una data e un nome:
-- ed e' esattamente il modo in cui si smette di discutere a maggio.
--
-- QUANDO IL TESORIERE SEGNA DA SE'
--
-- Se e' lui a registrare il pagamento — il percorso normale — la dichiarazione
-- che stava aspettando si chiude da sola: e' gia' confermata dal fatto che i
-- soldi sono stati contati. Lo fa un trigger e non l'applicazione, perche'
-- nessuno deve ricordarsene.

create table if not exists payment_claims (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams(id) on delete cascade,
  entry_id uuid not null references finance_entries(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null,
  method text not null check (method in ('contanti', 'bonifico', 'carta', 'assegno', 'paypal', 'altro')),
  note text,
  stato text not null default 'in_attesa' check (stato in ('in_attesa', 'confermata', 'rifiutata')),
  payment_id uuid references finance_payments(id) on delete set null,
  motivo_rifiuto text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  decided_by uuid references profiles(id),
  decided_at timestamptz
);

create index if not exists payment_claims_entry_idx on payment_claims(entry_id);
create index if not exists payment_claims_team_idx on payment_claims(team_id, stato);

alter table payment_claims enable row level security;

-- Chi la legge: chi ha accesso alla finanza, e la famiglia dell'atleta a cui
-- la quota si riferisce. Una dichiarazione che chi l'ha fatta non rivede e'
-- una dichiarazione che verra' rifatta tre volte.
drop policy if exists "payment_claims_select" on payment_claims;
create policy "payment_claims_select" on payment_claims for select
  using (
    team_id = current_team_id()
    and (
      has_finance_access()
      or exists (
        select 1 from finance_entries e
         where e.id = entry_id and has_family_access_to_entry(e.player_id)
      )
    )
  );

-- Chi la scrive: la famiglia, sulla propria quota, e solo «in attesa». Lo
-- stato non lo puo' decidere chi dichiara — sarebbe confermarsi da soli.
drop policy if exists "payment_claims_insert_family" on payment_claims;
create policy "payment_claims_insert_family" on payment_claims for insert
  with check (
    team_id = current_team_id()
    and stato = 'in_attesa'
    and created_by = auth.uid()
    and exists (
      select 1 from finance_entries e
       where e.id = entry_id and e.kind = 'income'
         and has_family_access_to_entry(e.player_id)
    )
  );

-- Ritirarla finche' nessuno l'ha guardata: si sbaglia un importo, e riscriverlo
-- non deve voler dire chiamare il tesoriere.
drop policy if exists "payment_claims_delete_family" on payment_claims;
create policy "payment_claims_delete_family" on payment_claims for delete
  using (stato = 'in_attesa' and created_by = auth.uid());

-- Decidere e' del tesoriere.
drop policy if exists "payment_claims_update_finance" on payment_claims;
create policy "payment_claims_update_finance" on payment_claims for update
  using (team_id = current_team_id() and has_finance_manage_access())
  with check (team_id = current_team_id() and has_finance_manage_access());


-- ============================================================================
-- CONFERMARE: UN GESTO SOLO
-- ============================================================================
-- Creare il pagamento e chiudere la dichiarazione sono due scritture, e se la
-- seconda fallisse resterebbe un incasso senza nessuno che l'ha chiesto —
-- oppure, al contrario, una dichiarazione confermata senza soldi. Qui sono
-- una transazione sola.
--
-- Il conto lo sceglie il tesoriere: e' l'unica informazione che la famiglia
-- non poteva dare, ed e' quella che fa muovere la cassa.

create or replace function conferma_dichiarazione(p_claim uuid, p_account uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  c record;
  v_payment uuid;
begin
  if not has_finance_manage_access() then
    raise exception 'Serve un ruolo di gestione della finanza.';
  end if;

  select * into c from payment_claims where id = p_claim;
  if c is null or c.team_id <> current_team_id() then
    raise exception 'Dichiarazione non trovata.';
  end if;
  if c.stato <> 'in_attesa' then
    raise exception 'Questa dichiarazione è già stata decisa.';
  end if;

  insert into finance_payments (team_id, entry_id, account_id, kind, amount, paid_at, method, created_by, notes)
    values (c.team_id, c.entry_id, p_account, 'income', c.amount, c.paid_at, c.method, auth.uid(),
            'Dichiarato dalla famiglia' || case when coalesce(trim(c.note), '') <> ''
                                                then ' — ' || trim(c.note) else '' end)
    returning id into v_payment;

  update payment_claims
     set stato = 'confermata', payment_id = v_payment,
         decided_by = auth.uid(), decided_at = now()
   where id = p_claim;

  return v_payment;
end;
$$;

grant execute on function conferma_dichiarazione(uuid, uuid) to authenticated;


-- ============================================================================
-- IL TESORIERE CHE SEGNA DA SE'
-- ============================================================================
-- «Se viene segnata la quota pagata dal tesoriere è confermata»: la
-- dichiarazione che stava aspettando su quella quota si chiude da sola.

create or replace function chiudi_dichiarazioni_pagate() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.entry_id is null or new.cancelled_at is not null then return new; end if;

  update payment_claims
     set stato = 'confermata', payment_id = new.id,
         decided_by = coalesce(new.created_by, auth.uid()), decided_at = now()
   where entry_id = new.entry_id
     and stato = 'in_attesa'
     and payment_id is null;

  return new;
end;
$$;

drop trigger if exists trg_dichiarazioni_pagate on finance_payments;
create trigger trg_dichiarazioni_pagate
  after insert on finance_payments
  for each row execute function chiudi_dichiarazioni_pagate();

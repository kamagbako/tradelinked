-- TradeLinked: deposits and profile fields for the user dashboard.
-- Run in the Supabase SQL editor AFTER supabase/schema.sql.

-- ---------------------------------------------------------------------------
-- Profile extras
-- ---------------------------------------------------------------------------
alter table profiles add column if not exists phone text;
alter table profiles add column if not exists country text;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type deposit_status as enum ('PENDING', 'APPROVED', 'REJECTED');

-- ---------------------------------------------------------------------------
-- Deposits: users report a transfer they made; an admin verifies and approves,
-- which credits their balance through the existing ledger.
-- ---------------------------------------------------------------------------
create table deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  method payout_method not null,
  reference text,
  status deposit_status not null default 'PENDING',
  rejection_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id)
);

create index deposits_status_idx on deposits (status, created_at desc);
create index deposits_user_id_idx on deposits (user_id, created_at desc);

create or replace function resolve_deposit(
  p_deposit_id uuid,
  p_status deposit_status,
  p_rejection_reason text
)
returns deposits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deposit deposits;
begin
  if not is_admin() then
    raise exception 'Only admins may resolve deposits';
  end if;

  select * into v_deposit from deposits where id = p_deposit_id for update;

  if v_deposit.id is null then
    raise exception 'Deposit not found';
  end if;

  if v_deposit.status != 'PENDING' then
    raise exception 'Deposit already resolved';
  end if;

  if p_status = 'APPROVED' then
    perform apply_ledger_entry(
      v_deposit.user_id, 'CREDIT', v_deposit.amount,
      'Deposit approved (' || v_deposit.method || ')', auth.uid()
    );
  end if;

  update deposits
  set status = p_status,
      rejection_reason = p_rejection_reason,
      resolved_at = now(),
      resolved_by = auth.uid()
  where id = p_deposit_id
  returning * into v_deposit;

  insert into audit_logs (actor_id, action, target_id, metadata)
  values (auth.uid(), 'DEPOSIT_' || p_status, p_deposit_id,
    jsonb_build_object('reason', p_rejection_reason));

  return v_deposit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table deposits enable row level security;

create policy "Users read own deposits" on deposits
  for select using (user_id = auth.uid() or is_admin());

create policy "Users insert own pending deposits" on deposits
  for insert with check (user_id = auth.uid() and status = 'PENDING');

create policy "Admins update deposits" on deposits
  for update using (is_admin()) with check (is_admin());

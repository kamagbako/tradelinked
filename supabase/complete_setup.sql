-- >>> Start of supabase/schema.sql <<<
-- TradeLinked database schema
-- Run against a fresh Supabase project (SQL Editor or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type user_role as enum ('USER', 'ADMIN');
create type ledger_entry_type as enum ('CREDIT', 'DEBIT', 'PROFIT_YIELD');
create type withdrawal_status as enum ('PENDING', 'COMPLETED', 'REJECTED');
create type payout_method as enum ('BANK_TRANSFER', 'BTC', 'USDT');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role user_role not null default 'USER',
  is_frozen boolean not null default false,
  active_plan text,
  created_at timestamptz not null default now()
);

create table balances (
  user_id uuid primary key references profiles (id) on delete cascade,
  available_balance numeric(14, 2) not null default 0,
  total_profit numeric(14, 2) not null default 0,
  total_deposited numeric(14, 2) not null default 0,
  updated_at timestamptz not null default now()
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type ledger_entry_type not null,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);

create table withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  payout_method payout_method not null,
  payout_details text not null,
  status withdrawal_status not null default 'PENDING',
  rejection_reason text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles (id)
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id),
  action text not null,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create table company_settings (
  id smallint primary key default 1,
  bank_name text,
  bank_account_name text,
  bank_account_number text,
  btc_address text,
  usdt_address text,
  whatsapp_support_url text,
  updated_at timestamptz not null default now(),
  constraint single_row check (id = 1)
);

insert into company_settings (id) values (1);

create index ledger_entries_user_id_idx on ledger_entries (user_id, created_at desc);
create index withdrawals_status_idx on withdrawals (status, created_at desc);
create index withdrawals_user_id_idx on withdrawals (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helper: is the current user an admin?
-- ---------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'ADMIN'
  );
$$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile + balance row
-- ---------------------------------------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name');

  insert into balances (user_id) values (new.id);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Atomic ledger entry application (admin manual ledger + withdrawal debits)
-- Locks the balance row for the duration of the transaction to prevent
-- concurrent double-submits from producing an inconsistent balance.
-- ---------------------------------------------------------------------------
create or replace function apply_ledger_entry(
  p_user_id uuid,
  p_type ledger_entry_type,
  p_amount numeric,
  p_note text,
  p_created_by uuid
)
returns ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry ledger_entries;
  v_delta numeric;
begin
  if not is_admin() then
    raise exception 'Only admins may apply ledger entries';
  end if;

  perform 1 from balances where user_id = p_user_id for update;

  v_delta := case when p_type = 'DEBIT' then -p_amount else p_amount end;

  if p_type = 'DEBIT' then
    if (select available_balance from balances where user_id = p_user_id) < p_amount then
      raise exception 'Insufficient balance for debit';
    end if;
  end if;

  insert into ledger_entries (user_id, type, amount, note, created_by)
  values (p_user_id, p_type, p_amount, p_note, p_created_by)
  returning * into v_entry;

  update balances
  set
    available_balance = available_balance + v_delta,
    total_profit = total_profit + case when p_type = 'PROFIT_YIELD' then p_amount else 0 end,
    total_deposited = total_deposited + case when p_type = 'CREDIT' then p_amount else 0 end,
    updated_at = now()
  where user_id = p_user_id;

  insert into audit_logs (actor_id, action, target_id, metadata)
  values (p_created_by, 'LEDGER_ENTRY_APPLIED', p_user_id,
    jsonb_build_object('type', p_type, 'amount', p_amount, 'note', p_note));

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- Withdrawal request: locks funds by moving them out of available_balance
-- immediately, so a user cannot request the same balance twice.
-- ---------------------------------------------------------------------------
create or replace function request_withdrawal(
  p_amount numeric,
  p_payout_method payout_method,
  p_payout_details text
)
returns withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal withdrawals;
begin
  perform 1 from balances where user_id = auth.uid() for update;

  if (select available_balance from balances where user_id = auth.uid()) < p_amount then
    raise exception 'Insufficient balance';
  end if;

  update balances
  set available_balance = available_balance - p_amount, updated_at = now()
  where user_id = auth.uid();

  insert into withdrawals (user_id, amount, payout_method, payout_details)
  values (auth.uid(), p_amount, p_payout_method, p_payout_details)
  returning * into v_withdrawal;

  insert into audit_logs (actor_id, action, target_id, metadata)
  values (auth.uid(), 'WITHDRAWAL_REQUESTED', v_withdrawal.id,
    jsonb_build_object('amount', p_amount, 'payout_method', p_payout_method));

  return v_withdrawal;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin resolves a withdrawal. Rejecting refunds the locked balance.
-- ---------------------------------------------------------------------------
create or replace function resolve_withdrawal(
  p_withdrawal_id uuid,
  p_status withdrawal_status,
  p_rejection_reason text
)
returns withdrawals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_withdrawal withdrawals;
begin
  if not is_admin() then
    raise exception 'Only admins may resolve withdrawals';
  end if;

  select * into v_withdrawal from withdrawals where id = p_withdrawal_id for update;

  if v_withdrawal.status != 'PENDING' then
    raise exception 'Withdrawal already resolved';
  end if;

  if p_status = 'REJECTED' then
    update balances
    set available_balance = available_balance + v_withdrawal.amount, updated_at = now()
    where user_id = v_withdrawal.user_id;
  end if;

  update withdrawals
  set status = p_status,
      rejection_reason = p_rejection_reason,
      resolved_at = now(),
      resolved_by = auth.uid()
  where id = p_withdrawal_id
  returning * into v_withdrawal;

  insert into audit_logs (actor_id, action, target_id, metadata)
  values (auth.uid(), 'WITHDRAWAL_' || p_status, p_withdrawal_id,
    jsonb_build_object('reason', p_rejection_reason));

  return v_withdrawal;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table balances enable row level security;
alter table ledger_entries enable row level security;
alter table withdrawals enable row level security;
alter table audit_logs enable row level security;
alter table company_settings enable row level security;

create policy "Users read own profile" on profiles
  for select using (id = auth.uid() or is_admin());

create policy "Users update own profile" on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Admins manage profiles" on profiles
  for all using (is_admin()) with check (is_admin());

create policy "Users read own balance" on balances
  for select using (user_id = auth.uid() or is_admin());

create policy "Admins manage balances" on balances
  for all using (is_admin()) with check (is_admin());

create policy "Users read own ledger" on ledger_entries
  for select using (user_id = auth.uid() or is_admin());

create policy "Admins insert ledger entries" on ledger_entries
  for insert with check (is_admin());

create policy "Users read own withdrawals" on withdrawals
  for select using (user_id = auth.uid() or is_admin());

create policy "Users insert own withdrawals" on withdrawals
  for insert with check (user_id = auth.uid());

create policy "Admins update withdrawals" on withdrawals
  for update using (is_admin()) with check (is_admin());

create policy "Admins read audit logs" on audit_logs
  for select using (is_admin());

create policy "Everyone reads company settings" on company_settings
  for select using (true);

create policy "Admins update company settings" on company_settings
  for update using (is_admin()) with check (is_admin());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table balances;
alter publication supabase_realtime add table ledger_entries;

-- >>> End of supabase/schema.sql <<<


-- >>> Start of supabase/migrations/002_dashboard_features.sql <<<
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

-- >>> End of supabase/migrations/002_dashboard_features.sql <<<


-- >>> Start of supabase/migrations/003_profile_fields.sql <<<
-- TradeLinked: fuller profile details (Profile Setting page).
-- Safe to run whether or not 002 has been applied.

alter table profiles add column if not exists phone text;
alter table profiles add column if not exists country text;
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists state text;
alter table profiles add column if not exists zip_code text;
alter table profiles add column if not exists city text;
alter table profiles add column if not exists address text;

-- >>> End of supabase/migrations/003_profile_fields.sql <<<


-- >>> Start of supabase/migrations/004_btc_only_deposits.sql <<<
-- TradeLinked: Bitcoin-only deposits with a configurable processing fee and deposit limits.
-- Run in the Supabase SQL editor after 002 and 003.

alter table company_settings add column if not exists deposit_fee_percent numeric(5, 2) not null default 0;
alter table company_settings add column if not exists deposit_fee_flat numeric(14, 2) not null default 0;
alter table company_settings add column if not exists deposit_min_usd numeric(14, 2) not null default 10;
alter table company_settings add column if not exists deposit_max_usd numeric(14, 2) not null default 1000000;

-- Fee/limits default to 0% / $0 / $10–$1,000,000 so behaviour is unchanged (no surprise charge) until
-- you set real numbers at /admin/settings — no redeploy needed, that page writes straight to this row.

-- The company's Bitcoin receiving address. Deposits are Bitcoin-only, so this is shown to every
-- depositing user; it's a public receive address, not a secret, so it's fine to seed here. Change it
-- any time from /admin/settings.
update company_settings set btc_address = 'bc1qhq9gdp96tln8axnz5je2cjqjxl2uaewuq3at0l' where id = 1;

-- >>> End of supabase/migrations/004_btc_only_deposits.sql <<<


-- >>> Start of supabase/migrations/005_messages.sql <<<
-- TradeLinked: direct messaging between an admin and an individual user.
-- Run in the Supabase SQL editor after 002, 003 and 004.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type message_sender as enum ('ADMIN', 'USER');
exception
  when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- Messages: one thread per user, shared with every admin. `user_id` identifies
-- the thread (the user it's about); `sender`/`sender_id` identify who wrote it.
-- ---------------------------------------------------------------------------
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  sender message_sender not null,
  sender_id uuid not null references profiles (id),
  body text not null check (char_length(body) between 1 and 4000),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_user_id_idx on messages (user_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table messages enable row level security;

drop policy if exists "Thread participants read messages" on messages;
create policy "Thread participants read messages" on messages
  for select using (user_id = auth.uid() or is_admin());

drop policy if exists "Users send messages in their own thread" on messages;
create policy "Users send messages in their own thread" on messages
  for insert with check (user_id = auth.uid() and sender = 'USER' and sender_id = auth.uid());

drop policy if exists "Admins send messages in any thread" on messages;
create policy "Admins send messages in any thread" on messages
  for insert with check (is_admin() and sender = 'ADMIN' and sender_id = auth.uid());

drop policy if exists "Thread participants mark messages read" on messages;
create policy "Thread participants mark messages read" on messages
  for update using (user_id = auth.uid() or is_admin()) with check (user_id = auth.uid() or is_admin());

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
end $$;

-- >>> End of supabase/migrations/005_messages.sql <<<


-- >>> Start of supabase/migrations/006_notifications.sql <<<
-- TradeLinked: deposit emails and an admin-configurable low-balance alert.
-- Run in the Supabase SQL editor after 002, 003, 004 and 005.

-- 0 means the alert is disabled (matches the "0 = off" convention already used for the deposit fee/limit columns).
alter table company_settings add column if not exists low_balance_threshold_usd numeric(14, 2) not null default 0;

-- Tracks whether this user is currently in a "low balance, already notified" state, so the alert fires
-- once per dip below the threshold rather than on every balance-changing action while they stay under it.
-- Cleared back to null once their balance rises back to or above the threshold.
alter table balances add column if not exists low_balance_notified_at timestamptz;

-- >>> End of supabase/migrations/006_notifications.sql <<<

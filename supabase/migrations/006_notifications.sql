-- TradeLinked: deposit emails and an admin-configurable low-balance alert.
-- Run in the Supabase SQL editor after 002, 003, 004 and 005.

-- 0 means the alert is disabled (matches the "0 = off" convention already used for the deposit fee/limit columns).
alter table company_settings add column if not exists low_balance_threshold_usd numeric(14, 2) not null default 0;

-- Tracks whether this user is currently in a "low balance, already notified" state, so the alert fires
-- once per dip below the threshold rather than on every balance-changing action while they stay under it.
-- Cleared back to null once their balance rises back to or above the threshold.
alter table balances add column if not exists low_balance_notified_at timestamptz;

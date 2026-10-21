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

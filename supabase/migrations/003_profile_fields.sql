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

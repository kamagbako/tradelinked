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

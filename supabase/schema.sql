-- Parsh CA Tracker: database schema for Supabase.
-- Run this whole file once in Supabase: SQL Editor -> New query -> paste -> Run. It is safe to run again.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Me',
  friend_code text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  created_at timestamptz not null default now()
);

-- Every piece of tracker data is one row: (owner, collection, id) -> JSON document.
create table if not exists public.records (
  user_id uuid not null references auth.users (id) on delete cascade,
  collection text not null check (collection in ('settings','subjects','chapters','sessions','days','tests','plans','snapshots')),
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

-- A link is stored in both directions so each side can read the other.
create table if not exists public.friend_links (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  tz text not null default 'Asia/Kolkata',
  reminders jsonb not null default '[]',
  sent jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.records enable row level security;
alter table public.friend_links enable row level security;
alter table public.push_subscriptions enable row level security;

create or replace function public.is_friend(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friend_links where user_id = auth.uid() and friend_id = other);
$$;

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id = auth.uid() or public.is_friend(id));
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Owners have full access to their rows; linked friends can only read.
drop policy if exists records_read on public.records;
create policy records_read on public.records for select to authenticated using (user_id = auth.uid() or public.is_friend(user_id));
drop policy if exists records_insert on public.records;
create policy records_insert on public.records for insert to authenticated with check (user_id = auth.uid());
drop policy if exists records_update on public.records;
create policy records_update on public.records for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists records_delete on public.records;
create policy records_delete on public.records for delete to authenticated using (user_id = auth.uid());

drop policy if exists links_read on public.friend_links;
create policy links_read on public.friend_links for select to authenticated using (user_id = auth.uid());

drop policy if exists push_all on public.push_subscriptions;
create policy push_all on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Friend codes cannot be changed from the client.
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Linking is done by code through these functions, so nobody can browse other users.
create or replace function public.link_friend(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare fid uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  select id into fid from public.profiles where friend_code = upper(trim(code));
  if fid is null then raise exception 'No account found with that friend code'; end if;
  if fid = auth.uid() then raise exception 'That is your own code'; end if;
  insert into public.friend_links (user_id, friend_id) values (auth.uid(), fid), (fid, auth.uid()) on conflict do nothing;
  return fid;
end $$;

create or replace function public.unlink_friend(fid uuid) returns void
language sql security definer set search_path = public as $$
  delete from public.friend_links where (user_id = auth.uid() and friend_id = fid) or (user_id = fid and friend_id = auth.uid());
$$;

revoke all on function public.link_friend(text) from public, anon;
revoke all on function public.unlink_friend(uuid) from public, anon;
grant execute on function public.link_friend(text) to authenticated;
grant execute on function public.unlink_friend(uuid) to authenticated;
grant execute on function public.is_friend(uuid) to authenticated;

-- Live comparison: broadcast record changes (row-level security still applies to who receives them).
do $$ begin
  alter publication supabase_realtime add table public.records;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Phone reminders are scheduled separately: see supabase/reminders.sql and supabase/functions/remind.

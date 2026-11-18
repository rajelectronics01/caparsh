-- Parsh CA Tracker: tell friends when someone studies.
-- Whenever a new study session is saved, the database calls the `notify-friends` Edge Function, which sends a push
-- notification to the saver's linked friends. Run after supabase/schema.sql and supabase/reminders.sql
-- (it reuses the Vault secret 'cron_secret' created there).

create table if not exists public.notify_log (
  sender_id uuid not null references auth.users (id) on delete cascade,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  sent_at timestamptz not null default now(),
  primary key (sender_id, recipient_id)
);
-- Only the Edge Function (service role) touches this table.
alter table public.notify_log enable row level security;

create or replace function public.notify_friends_on_session() returns trigger
language plpgsql security definer set search_path = public, extensions, vault, net as $fn$
declare
  secret text;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret';
  if secret is null then return new; end if;
  perform net.http_post(
    url := 'https://ektelxzuktmnbihwaglx.supabase.co/functions/v1/notify-friends',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || secret),
    body := jsonb_build_object('user_id', new.user_id, 'data', new.data)
  );
  return new;
exception when others then
  return new; -- an alert problem must never stop a study session from saving
end
$fn$;

drop trigger if exists notify_friends_after_session on public.records;
create trigger notify_friends_after_session
  after insert on public.records
  for each row when (new.collection = 'sessions')
  execute function public.notify_friends_on_session();

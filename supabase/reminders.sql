-- Parsh CA Tracker: schedule for phone reminders.
-- Every 5 minutes the database calls the `remind` Edge Function, which sends any reminder that has come due.
-- The function only answers requests carrying CRON_SECRET; the database reads that secret from Supabase Vault
-- (stored once under the name 'cron_secret'), so it never appears in this file or in the job definition.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'parsh-reminders';
select cron.schedule('parsh-reminders', '*/5 * * * *', $job$
  select net.http_post(
    url := 'https://ektelxzuktmnbihwaglx.supabase.co/functions/v1/remind',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$job$);

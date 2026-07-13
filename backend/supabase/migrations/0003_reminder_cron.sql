-- Calls send-reminders every 30 minutes so appointments ~24h out get a
-- reminder email exactly once (send-reminders itself is idempotent via
-- the reminder_sent flag).
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-appointment-reminders',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://cxcppaaddvriwcgtkbxk.supabase.co/functions/v1/send-reminders',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Enable automatic internal message cleanup.
-- Run this after 2026-06-01-internal-message-retention.sql.
--
-- It schedules a daily cleanup at 03:15 UTC, deleting messages older than 21 days.

create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-cleanup-old-internal-messages'
  ) then
    perform cron.unschedule('love-potion-cleanup-old-internal-messages');
  end if;
end;
$$;

select cron.schedule(
  'love-potion-cleanup-old-internal-messages',
  '15 3 * * *',
  $$select public.cleanup_old_internal_messages(interval '21 days');$$
);

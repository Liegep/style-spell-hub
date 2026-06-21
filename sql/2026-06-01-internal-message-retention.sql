-- Internal message retention.
-- Keeps the mailbox light by deleting messages older than 21 days.
-- Run this file once to create the cleanup function.

create or replace function public.cleanup_old_internal_messages(
  retention interval default interval '21 days'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  delete from public.internal_messages
  where created_at < now() - retention;

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on function public.cleanup_old_internal_messages(interval) from public;
grant execute on function public.cleanup_old_internal_messages(interval) to service_role;

-- Optional Supabase schedule, if pg_cron is enabled in your project.
-- This runs every day at 03:15 UTC and removes messages older than 21 days.
-- Uncomment only when you are ready for automatic cleanup.
--
-- create extension if not exists pg_cron with schema extensions;
--
-- select cron.schedule(
--   'love-potion-cleanup-old-internal-messages',
--   '15 3 * * *',
--   $$select public.cleanup_old_internal_messages(interval '21 days');$$
-- );

-- Audit log retention for Love Potion.
-- Keeps only the last 30 days of audit activity, then removes older rows daily.

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_old_audit_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.audit_logs
  where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.cleanup_old_audit_logs() from public;
grant execute on function public.cleanup_old_audit_logs() to service_role;

do $$
declare
  existing_jobid bigint;
begin
  select jobid
  into existing_jobid
  from cron.job
  where jobname = 'cleanup-old-audit-logs'
  limit 1;

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'cleanup-old-audit-logs',
  '15 4 * * *',
  $$select public.cleanup_old_audit_logs();$$
);


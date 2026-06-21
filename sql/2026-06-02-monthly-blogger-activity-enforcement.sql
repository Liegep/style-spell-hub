-- Monthly blogger activity enforcement.
-- Blocks active bloggers who did not have at least one approved post in the previous calendar month.
-- Bloggers marked as "vacation" are skipped.

create or replace function public.enforce_monthly_blogger_activity()
returns table (
  blocked_profile_id uuid,
  blocked_display_name text,
  checked_month_start date,
  checked_month_end date
)
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now()) - interval '1 month';
  month_end timestamptz := date_trunc('month', now());
begin
  return query
  with inactive_bloggers as (
    select
      p.id,
      coalesce(p.display_name, p.full_name, p.email) as display_name
    from public.profiles p
    where p.role = 'blogger'
      and p.account_status = 'active'
      and coalesce(p.availability_status, 'available') <> 'vacation'
      and not exists (
        select 1
        from public.blog_submissions bs
        where bs.blogger_id = p.id
          and bs.status = 'approved'
          and bs.submitted_at >= month_start
          and bs.submitted_at < month_end
      )
  ),
  blocked as (
    update public.profiles p
    set
      account_status = 'blocked',
      updated_at = now()
    from inactive_bloggers ib
    where p.id = ib.id
    returning p.id, ib.display_name
  )
  select
    blocked.id,
    blocked.display_name,
    month_start::date,
    (month_end::date - 1)
  from blocked;
end;
$$;

revoke all on function public.enforce_monthly_blogger_activity() from public;
grant execute on function public.enforce_monthly_blogger_activity() to service_role;

-- Automatic schedule, if pg_cron is enabled in the Supabase project.
-- Runs on the first day of every month at 04:20 UTC, after the previous month has closed.
create extension if not exists pg_cron with schema extensions;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-enforce-monthly-blogger-activity'
  ) then
    perform cron.unschedule('love-potion-enforce-monthly-blogger-activity');
  end if;
end;
$$;

select cron.schedule(
  'love-potion-enforce-monthly-blogger-activity',
  '20 4 1 * *',
  $$select * from public.enforce_monthly_blogger_activity();$$
);

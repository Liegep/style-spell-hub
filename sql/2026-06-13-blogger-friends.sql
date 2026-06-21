-- Love Potion blogger friends / honor guests.
-- Friends are bloggers exempt from the monthly posting minimum.

alter table public.profiles
  add column if not exists blogger_tier text not null default 'standard';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_blogger_tier_check'
  ) then
    alter table public.profiles
      add constraint profiles_blogger_tier_check
      check (blogger_tier in ('standard', 'friend'));
  end if;
end $$;

create index if not exists profiles_blogger_tier_idx
  on public.profiles(blogger_tier);

comment on column public.profiles.blogger_tier is
  'standard bloggers follow the monthly rule; friend bloggers are honor guests exempt from the monthly posting minimum.';

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
      and coalesce(p.blogger_tier, 'standard') <> 'friend'
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
    set account_status = 'blocked', updated_at = now()
    from inactive_bloggers ib
    where p.id = ib.id
    returning p.id, ib.display_name
  )
  select blocked.id, blocked.display_name, month_start::date, (month_end::date - 1)
  from blocked;
end;
$$;

revoke all on function public.enforce_monthly_blogger_activity() from public;
grant execute on function public.enforce_monthly_blogger_activity() to service_role;

create or replace function public.queue_monthly_post_warnings()
returns table (
  queued_profile_id uuid,
  queued_display_name text,
  days_left int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  month_start timestamptz := date_trunc('month', now());
  next_month_start timestamptz := date_trunc('month', now()) + interval '1 month';
  days_until_month_end int := greatest(0, (date_trunc('month', now()) + interval '1 month')::date - current_date - 1);
  month_key text := to_char(now(), 'YYYY-MM');
begin
  if days_until_month_end > 7 then
    return;
  end if;

  return query
  with bloggers_to_warn as (
    select
      p.id,
      coalesce(p.display_name, p.full_name, p.sl_avatar_name, p.email) as display_name,
      p.sl_avatar_uuid,
      'monthly-post-warning:' || month_key || ':' || p.id::text as warning_key
    from public.profiles p
    where p.role = 'blogger'
      and p.account_status = 'active'
      and coalesce(p.availability_status, 'available') <> 'vacation'
      and coalesce(p.blogger_tier, 'standard') <> 'friend'
      and p.sl_avatar_uuid is not null
      and not exists (
        select 1
        from public.blog_submissions bs
        where bs.blogger_id = p.id
          and bs.status = 'approved'
          and bs.submitted_at >= month_start
          and bs.submitted_at < next_month_start
      )
      and not exists (
        select 1
        from public.notification_queue nq
        where nq.metadata->>'warning_key' = 'monthly-post-warning:' || month_key || ':' || p.id::text
      )
  ),
  inserted as (
    insert into public.notification_queue (
      recipient_id,
      recipient_sl_uuid,
      channel,
      type,
      title,
      body,
      metadata,
      scheduled_at,
      status
    )
    select
      btw.id,
      btw.sl_avatar_uuid,
      'second_life',
      'deadline_soon',
      'Monthly post reminder',
      case
        when days_until_month_end = 0 then
          'Love Potion reminder: today is the last day of the month. Submit one approved post to keep your blogger account active.'
        when days_until_month_end = 1 then
          'Love Potion reminder: 1 day left to submit one approved post and keep your blogger account active.'
        else
          'Love Potion reminder: ' || days_until_month_end || ' days left to submit one approved post and keep your blogger account active.'
      end,
      jsonb_build_object(
        'warning_key', btw.warning_key,
        'kind', 'monthly_post_warning',
        'month', month_key,
        'days_left', days_until_month_end
      ),
      now(),
      'pending'
    from bloggers_to_warn btw
    returning recipient_id
  )
  select btw.id, btw.display_name, days_until_month_end
  from bloggers_to_warn btw
  join inserted i on i.recipient_id = btw.id;
end;
$$;

revoke all on function public.queue_monthly_post_warnings() from public;
grant execute on function public.queue_monthly_post_warnings() to service_role;

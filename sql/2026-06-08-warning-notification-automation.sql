-- Automatic warning notifications for Love Potion.
-- 1. Monthly post reminders before the account block rule runs.
-- 2. Product deadline reminders for claimed products without a submitted post.
-- 3. Cron processor for due Second Life notification_queue rows.
--
-- Before running this file, replace PASTE_NOTIFICATION_CRON_SECRET_HERE with
-- the same value you set in the Edge Function secret NOTIFICATION_CRON_SECRET.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;

create table if not exists private.app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

revoke all on private.app_secrets from public;
revoke all on private.app_secrets from anon;
revoke all on private.app_secrets from authenticated;

insert into private.app_secrets (key, value)
values ('notification_cron_secret', 'PASTE_NOTIFICATION_CRON_SECRET_HERE')
on conflict (key) do update
set
  value = excluded.value,
  updated_at = now();

create unique index if not exists notification_queue_warning_key_uidx
  on public.notification_queue ((metadata->>'warning_key'))
  where metadata ? 'warning_key';

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
  select
    btw.id,
    btw.display_name,
    days_until_month_end
  from bloggers_to_warn btw
  join inserted i on i.recipient_id = btw.id;
end;
$$;

revoke all on function public.queue_monthly_post_warnings() from public;
grant execute on function public.queue_monthly_post_warnings() to service_role;

create or replace function public.queue_product_deadline_warnings()
returns table (
  queued_profile_id uuid,
  queued_product_id uuid,
  queued_product_name text,
  days_left int
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed_products_to_warn as (
    select
      p.id as profile_id,
      p.sl_avatar_uuid,
      pr.id as product_id,
      pr.name as product_name,
      greatest(0, pr.deadline_at::date - current_date) as product_days_left,
      'product-deadline-warning:' || pr.id::text || ':' || p.id::text || ':' || pr.deadline_at::date::text as warning_key
    from public.product_claims pc
    join public.product_releases pr on pr.id = pc.product_id
    join public.profiles p on p.id = pc.blogger_id
    where pr.status = 'available'
      and pr.deadline_at is not null
      and pr.deadline_at::date between current_date and current_date + 3
      and pc.status in ('claimed', 'delivered')
      and p.role = 'blogger'
      and p.account_status = 'active'
      and coalesce(p.availability_status, 'available') <> 'vacation'
      and p.sl_avatar_uuid is not null
      and not exists (
        select 1
        from public.blog_submissions bs
        where bs.product_id = pr.id
          and bs.blogger_id = p.id
          and bs.status in ('pending', 'approved')
      )
      and not exists (
        select 1
        from public.notification_queue nq
        where nq.metadata->>'warning_key' =
          'product-deadline-warning:' || pr.id::text || ':' || p.id::text || ':' || pr.deadline_at::date::text
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
      cptw.profile_id,
      cptw.sl_avatar_uuid,
      'second_life',
      'deadline_soon',
      'Deadline soon: ' || cptw.product_name,
      case
        when cptw.product_days_left = 0 then
          'Love Potion deadline alert: ' || cptw.product_name || ' is due today. Submit your links in the dashboard.'
        when cptw.product_days_left = 1 then
          'Love Potion deadline alert: ' || cptw.product_name || ' is due tomorrow. Submit your links in the dashboard.'
        else
          'Love Potion deadline alert: ' || cptw.product_name || ' is due in ' || cptw.product_days_left || ' days. Submit your links in the dashboard.'
      end,
      jsonb_build_object(
        'warning_key', cptw.warning_key,
        'kind', 'product_deadline_warning',
        'product_id', cptw.product_id,
        'product_name', cptw.product_name,
        'days_left', cptw.product_days_left
      ),
      now(),
      'pending'
    from claimed_products_to_warn cptw
    returning recipient_id, metadata
  )
  select
    cptw.profile_id,
    cptw.product_id,
    cptw.product_name,
    cptw.product_days_left
  from claimed_products_to_warn cptw
  join inserted i
    on i.recipient_id = cptw.profile_id
   and i.metadata->>'warning_key' = cptw.warning_key;
end;
$$;

revoke all on function public.queue_product_deadline_warnings() from public;
grant execute on function public.queue_product_deadline_warnings() to service_role;

create or replace function public.queue_warning_notifications()
returns table (
  warning_kind text,
  queued_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  monthly_count int;
  product_count int;
begin
  select count(*) into monthly_count from public.queue_monthly_post_warnings();
  select count(*) into product_count from public.queue_product_deadline_warnings();

  return query values
    ('monthly_post_warning'::text, monthly_count),
    ('product_deadline_warning'::text, product_count);
end;
$$;

revoke all on function public.queue_warning_notifications() from public;
grant execute on function public.queue_warning_notifications() to service_role;

create or replace function public.process_due_second_life_notifications()
returns bigint
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  project_url text := 'https://dvhrisqlybqsrzsfoyfx.supabase.co';
  cron_secret text;
  request_id bigint;
begin
  select value
  into cron_secret
  from private.app_secrets
  where key = 'notification_cron_secret';

  if cron_secret is null or cron_secret = 'PASTE_NOTIFICATION_CRON_SECRET_HERE' then
    raise exception 'Set private.app_secrets.notification_cron_secret before enabling notification processing.';
  end if;

  select net.http_post(
    url := project_url || '/functions/v1/send-sl-notification',
    headers := jsonb_build_object(
      'content-type', 'application/json',
      'x-love-potion-cron-secret', cron_secret
    ),
    body := jsonb_build_object('processDue', true),
    timeout_milliseconds := 10000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.process_due_second_life_notifications() from public;
grant execute on function public.process_due_second_life_notifications() to service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-queue-warning-notifications'
  ) then
    perform cron.unschedule('love-potion-queue-warning-notifications');
  end if;

  if exists (
    select 1
    from cron.job
    where jobname = 'love-potion-process-second-life-notifications'
  ) then
    perform cron.unschedule('love-potion-process-second-life-notifications');
  end if;
end;
$$;

select cron.schedule(
  'love-potion-queue-warning-notifications',
  '10 9 * * *',
  $$select * from public.queue_warning_notifications();$$
);

select cron.schedule(
  'love-potion-process-second-life-notifications',
  '*/10 * * * *',
  $$select public.process_due_second_life_notifications();$$
);

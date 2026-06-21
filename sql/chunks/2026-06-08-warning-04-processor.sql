-- 04 - Queue wrapper and Second Life notification processor.

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

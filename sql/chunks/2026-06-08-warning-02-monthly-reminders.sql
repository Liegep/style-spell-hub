-- 02 - Queue monthly post reminders for active bloggers.

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

-- Chunk 3/5: product deadline reminders.

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

alter table public.product_releases
  add column if not exists blogging_deadline_days int;

alter table public.product_releases
  drop constraint if exists product_releases_blogging_deadline_days_check;

alter table public.product_releases
  add constraint product_releases_blogging_deadline_days_check
  check (
    blogging_deadline_days is null
    or blogging_deadline_days in (10, 15, 30)
  );

alter table public.product_claims
  add column if not exists due_at timestamptz;

create index if not exists product_claims_due_at_idx
  on public.product_claims(due_at)
  where due_at is not null;

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
      greatest(0, pc.due_at::date - current_date) as product_days_left,
      'product-deadline-warning:' || pc.id::text || ':' || pc.due_at::date::text as warning_key
    from public.product_claims pc
    join public.product_releases pr on pr.id = pc.product_id
    join public.profiles p on p.id = pc.blogger_id
    where pr.status = 'available'
      and pc.due_at is not null
      and pc.due_at::date between current_date and current_date + 3
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
          'product-deadline-warning:' || pc.id::text || ':' || pc.due_at::date::text
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

create or replace function public.block_overdue_product_claims()
returns table (
  blocked_profile_id uuid,
  blocked_product_id uuid,
  blocked_product_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with overdue_claims as (
    select
      pc.id as claim_id,
      p.id as profile_id,
      p.sl_avatar_uuid,
      coalesce(p.display_name, p.full_name, p.email) as profile_name,
      pr.id as product_id,
      pr.name as product_name
    from public.product_claims pc
    join public.product_releases pr on pr.id = pc.product_id
    join public.profiles p on p.id = pc.blogger_id
    where pr.status = 'available'
      and pc.due_at is not null
      and pc.due_at::date < current_date
      and pc.status in ('claimed', 'delivered')
      and p.role = 'blogger'
      and p.account_status = 'active'
      and coalesce(p.availability_status, 'available') <> 'vacation'
      and not exists (
        select 1
        from public.blog_submissions bs
        where bs.product_id = pr.id
          and bs.blogger_id = p.id
          and bs.status in ('pending', 'approved')
      )
  ),
  updated_profiles as (
    update public.profiles p
    set
      account_status = 'blocked',
      updated_at = now()
    from overdue_claims oc
    where p.id = oc.profile_id
    returning oc.claim_id, oc.profile_id, oc.sl_avatar_uuid, oc.profile_name, oc.product_id, oc.product_name
  ),
  inserted_notifications as (
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
      up.profile_id,
      up.sl_avatar_uuid,
      'second_life',
      'account_blocked',
      'Love Potion account paused',
      'Your Love Potion blogger access was paused because the deadline passed for ' || up.product_name || '. Please contact Love Potion HQ if you need help.',
      jsonb_build_object(
        'kind', 'product_deadline_block',
        'claim_id', up.claim_id,
        'product_id', up.product_id,
        'product_name', up.product_name
      ),
      now(),
      'pending'
    from updated_profiles up
    where up.sl_avatar_uuid is not null
    returning recipient_id
  ),
  inserted_audit as (
    insert into public.audit_logs (
      actor_name,
      actor_role,
      action,
      target_type,
      target_id,
      target_name,
      metadata
    )
    select
      'Love Potion automation',
      'super_admin',
      'Blocked blogger after missed product deadline',
      'profile',
      up.profile_id::text,
      up.profile_name,
      jsonb_build_object(
        'claim_id', up.claim_id,
        'product_id', up.product_id,
        'product_name', up.product_name
      )
    from updated_profiles up
    returning target_id
  )
  select
    up.profile_id,
    up.product_id,
    up.product_name
  from updated_profiles up;
end;
$$;

revoke all on function public.block_overdue_product_claims() from public;
grant execute on function public.block_overdue_product_claims() to service_role;

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
  blocked_count int;
begin
  select count(*) into monthly_count from public.queue_monthly_post_warnings();
  select count(*) into product_count from public.queue_product_deadline_warnings();
  select count(*) into blocked_count from public.block_overdue_product_claims();

  return query values
    ('monthly_post_warning'::text, monthly_count),
    ('product_deadline_warning'::text, product_count),
    ('product_deadline_block'::text, blocked_count);
end;
$$;

revoke all on function public.queue_warning_notifications() from public;
grant execute on function public.queue_warning_notifications() to service_role;

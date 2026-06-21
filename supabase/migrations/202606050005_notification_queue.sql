-- Notification queue for Love Potion.
-- Stores notification jobs before they are sent to Second Life, email, or future channels.

do $$
begin
  create type public.notification_channel as enum ('in_app', 'second_life', 'email');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_type as enum (
    'new_product',
    'new_message',
    'post_approved',
    'post_rejected',
    'needs_revision',
    'deadline_soon',
    'account_blocked',
    'account_reactivated',
    'manual'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.notification_status as enum ('pending', 'sent', 'failed', 'cancelled');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_sl_uuid text,
  delivery_server_url text,
  channel public.notification_channel not null default 'second_life',
  type public.notification_type not null default 'manual',
  title text not null,
  body text,
  action_url text,
  metadata jsonb not null default '{}'::jsonb,
  status public.notification_status not null default 'pending',
  attempts int not null default 0,
  last_error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_queue_recipient_check
    check (recipient_id is not null or recipient_sl_uuid is not null)
);

alter table public.notification_queue
  add column if not exists delivery_server_url text;

create index if not exists notification_queue_status_scheduled_idx
  on public.notification_queue (status, scheduled_at);

create index if not exists notification_queue_recipient_created_idx
  on public.notification_queue (recipient_id, created_at desc);

create index if not exists notification_queue_channel_status_idx
  on public.notification_queue (channel, status, scheduled_at);

create index if not exists notification_queue_sl_uuid_created_idx
  on public.notification_queue (recipient_sl_uuid, created_at desc);

drop trigger if exists touch_notification_queue_updated_at on public.notification_queue;
create trigger touch_notification_queue_updated_at
before update on public.notification_queue
for each row execute function public.touch_updated_at();

alter table public.notification_queue enable row level security;

drop policy if exists "Staff can read notification queue" on public.notification_queue;
create policy "Staff can read notification queue"
  on public.notification_queue for select
  using (public.current_app_role() in ('admin', 'super_admin'));

drop policy if exists "Users can read own notification queue" on public.notification_queue;
create policy "Users can read own notification queue"
  on public.notification_queue for select
  using (recipient_id = auth.uid());

drop policy if exists "Staff can create notification queue entries" on public.notification_queue;
create policy "Staff can create notification queue entries"
  on public.notification_queue for insert
  with check (public.current_app_role() in ('admin', 'super_admin'));

drop policy if exists "Staff can update notification queue entries" on public.notification_queue;
create policy "Staff can update notification queue entries"
  on public.notification_queue for update
  using (public.current_app_role() in ('admin', 'super_admin'))
  with check (public.current_app_role() in ('admin', 'super_admin'));

grant select, insert, update on public.notification_queue to authenticated;

create extension if not exists pg_cron with schema extensions;

create or replace function public.cleanup_old_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notification_queue
  where status in ('sent', 'failed', 'cancelled')
    and created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.cleanup_old_notifications() from public;
grant execute on function public.cleanup_old_notifications() to service_role;

do $$
declare
  existing_jobid bigint;
begin
  select jobid
  into existing_jobid
  from cron.job
  where jobname = 'cleanup-old-notifications'
  limit 1;

  if existing_jobid is not null then
    perform cron.unschedule(existing_jobid);
  end if;
end $$;

select cron.schedule(
  'cleanup-old-notifications',
  '35 4 * * *',
  $$select public.cleanup_old_notifications();$$
);

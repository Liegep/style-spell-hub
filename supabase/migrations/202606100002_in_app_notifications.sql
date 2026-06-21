-- In-app notification read state for Love Potion.
-- Lets bloggers and staff see counters and mark notifications as read.

alter table public.notification_queue
  add column if not exists read_at timestamptz;

create index if not exists notification_queue_recipient_read_created_idx
  on public.notification_queue (recipient_id, read_at, created_at desc);

create or replace function public.mark_my_notification_read(target_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_queue
  set read_at = coalesce(read_at, now()),
      updated_at = now()
  where id = target_notification_id
    and recipient_id = auth.uid();
end;
$$;

revoke all on function public.mark_my_notification_read(uuid) from public;
grant execute on function public.mark_my_notification_read(uuid) to authenticated;

create or replace function public.mark_my_notifications_read()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_queue
  set read_at = coalesce(read_at, now()),
      updated_at = now()
  where recipient_id = auth.uid()
    and read_at is null;
end;
$$;

revoke all on function public.mark_my_notifications_read() from public;
grant execute on function public.mark_my_notifications_read() to authenticated;

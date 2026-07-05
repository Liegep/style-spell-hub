drop function if exists public.get_my_unread_notification_count();

create function public.get_my_unread_notification_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.notification_queue
  where recipient_id = auth.uid()
    and channel = 'in_app'
    and read_at is null
$$;

revoke all on function public.get_my_unread_notification_count() from public;
grant execute on function public.get_my_unread_notification_count() to authenticated;

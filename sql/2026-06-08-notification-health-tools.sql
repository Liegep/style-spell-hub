-- Staff-safe helpers for the Audit Log automation health panel.
-- Run this once in Supabase SQL editor.

create or replace function public.staff_process_due_second_life_notifications()
returns bigint
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Only staff can process the Second Life notification queue.';
  end if;

  return public.process_due_second_life_notifications();
end;
$$;

revoke all on function public.staff_process_due_second_life_notifications() from public;
grant execute on function public.staff_process_due_second_life_notifications() to authenticated;

create or replace function public.staff_queue_warning_notifications()
returns table(warning_kind text, queued_count int)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_app_role() not in ('admin', 'super_admin') then
    raise exception 'Only staff can queue warning notifications.';
  end if;

  return query
  select 'monthly_post'::text, count(*)::int
  from public.queue_monthly_post_warning_notifications()
  union all
  select 'product_deadline'::text, count(*)::int
  from public.queue_product_deadline_warning_notifications();
end;
$$;

revoke all on function public.staff_queue_warning_notifications() from public;
grant execute on function public.staff_queue_warning_notifications() to authenticated;

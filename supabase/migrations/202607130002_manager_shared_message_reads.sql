alter table public.internal_messages
  add column if not exists staff_message_group_id uuid,
  add column if not exists staff_read_at timestamptz,
  add column if not exists staff_read_by uuid references public.profiles(id) on delete set null;

create index if not exists internal_messages_staff_group_idx
  on public.internal_messages (staff_message_group_id);

create or replace function public.mark_staff_message_groups_read(target_message_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_staff_id uuid := auth.uid();
begin
  if current_staff_id is null or not public.is_staff() then
    raise exception 'Only active staff can mark these messages as read.';
  end if;

  with selected as (
    select id, staff_message_group_id
    from public.internal_messages
    where id = any(target_message_ids)
      and recipient_id = current_staff_id
  )
  update public.internal_messages as message
  set
    staff_read_at = coalesce(message.staff_read_at, now()),
    staff_read_by = coalesce(message.staff_read_by, current_staff_id)
  where
    message.id in (
      select id
      from selected
      where staff_message_group_id is null
    )
    or message.staff_message_group_id in (
      select staff_message_group_id
      from selected
      where staff_message_group_id is not null
    );
end;
$$;

grant execute on function public.mark_staff_message_groups_read(uuid[]) to authenticated;

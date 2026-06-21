-- Allow each blogger to mark their own personal mailbox messages as read.
-- Broadcast read receipts need a per-user read table later, so this keeps broadcasts untouched.

create or replace function public.mark_my_internal_messages_read()
returns void
language sql
security definer
set search_path = public
as $$
  update public.internal_messages
  set read_at = coalesce(read_at, now())
  where recipient_id = auth.uid()
    and scope = 'personal'
    and read_at is null;
$$;

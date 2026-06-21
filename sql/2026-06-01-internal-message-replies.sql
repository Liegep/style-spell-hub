-- Let bloggers reply to personal staff messages.
-- Broadcasts stay one-way announcements.

create or replace function public.profile_has_any_role(
  target_profile_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = target_profile_id
      and role::text = any(allowed_roles)
      and coalesce(account_status, 'active') = 'active'
  );
$$;

grant execute on function public.profile_has_any_role(uuid, text[]) to authenticated;

create or replace function public.send_internal_reply(
  target_recipient_id uuid,
  reply_subject text,
  reply_body text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_message_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(trim(reply_body), '') is null then
    raise exception 'Reply body is required';
  end if;

  if not public.profile_has_any_role(auth.uid(), array['blogger']) then
    raise exception 'Only active bloggers can reply';
  end if;

  if not public.profile_has_any_role(target_recipient_id, array['admin', 'super_admin']) then
    raise exception 'Replies can only be sent to staff';
  end if;

  insert into public.internal_messages (
    scope,
    sender_id,
    recipient_id,
    subject,
    body
  )
  values (
    'personal',
    auth.uid(),
    target_recipient_id,
    coalesce(nullif(trim(reply_subject), ''), 'Re: message'),
    trim(reply_body)
  )
  returning id into new_message_id;

  return new_message_id;
end;
$$;

grant execute on function public.send_internal_reply(uuid, text, text) to authenticated;

drop policy if exists "bloggers can reply to staff messages" on public.internal_messages;
create policy "bloggers can reply to staff messages"
on public.internal_messages
for insert
with check (
  auth.role() = 'authenticated'
  and scope = 'personal'
  and sender_id = auth.uid()
  and recipient_id is not null
  and public.profile_has_any_role(auth.uid(), array['blogger'])
  and public.profile_has_any_role(recipient_id, array['admin', 'super_admin'])
);

drop policy if exists "users can read messages they sent" on public.internal_messages;
create policy "users can read messages they sent"
on public.internal_messages
for select
using (
  auth.role() = 'authenticated'
  and sender_id = auth.uid()
);

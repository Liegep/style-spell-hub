create or replace function public.send_message_to_staff(
  message_subject text,
  message_body text
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_profile public.profiles%rowtype;
  recipient record;
  recipient_ids uuid[] := '{}';
  shared_group_id uuid := gen_random_uuid();
  clean_subject text := nullif(trim(message_subject), '');
  clean_body text := nullif(trim(message_body), '');
begin
  if auth.uid() is null then
    raise exception 'You must be logged in to send a message.';
  end if;

  select *
  into sender_profile
  from public.profiles
  where id = auth.uid();

  if sender_profile.id is null or sender_profile.role <> 'blogger' then
    raise exception 'Only blogger accounts can contact staff from this form.';
  end if;

  if clean_subject is null or clean_body is null then
    raise exception 'Subject and message are required.';
  end if;

  for recipient in
    select id
    from public.profiles
    where role in ('admin', 'super_admin')
      and account_status = 'active'
  loop
    insert into public.internal_messages (
      sender_id,
      scope,
      recipient_id,
      staff_message_group_id,
      subject,
      body
    )
    values (
      sender_profile.id,
      'personal',
      recipient.id,
      shared_group_id,
      clean_subject,
      clean_body
    );

    insert into public.notification_queue (
      recipient_id,
      recipient_sl_uuid,
      channel,
      type,
      title,
      body,
      action_url,
      metadata,
      status,
      scheduled_at,
      sent_at
    )
    values (
      recipient.id,
      null,
      'in_app',
      'new_message',
      clean_subject,
      clean_body,
      '/app/admin?section=inbox',
      jsonb_build_object('source', 'blogger_staff_message'),
      'sent',
      now(),
      now()
    );

    recipient_ids := array_append(recipient_ids, recipient.id);
  end loop;

  if coalesce(array_length(recipient_ids, 1), 0) = 0 then
    raise exception 'No active managers are available right now.';
  end if;

  return recipient_ids;
end;
$$;

grant execute on function public.send_message_to_staff(text, text) to authenticated;

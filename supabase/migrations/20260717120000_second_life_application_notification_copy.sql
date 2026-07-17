create or replace function public.queue_staff_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_name text;
  in_app_body text;
  second_life_body text := 'There''s a new blogger application in Love Potion HQ. Login to view it.';
begin
  applicant_name := coalesce(
    nullif(new.display_name, ''),
    nullif(new.sl_avatar_name, ''),
    nullif(new.answers->>'displayName', ''),
    nullif(new.answers->>'slAvatarName', ''),
    nullif(new.answers->>'display_name', ''),
    nullif(new.answers->>'sl_avatar_name', ''),
    nullif(new.email, ''),
    'a new applicant'
  );

  in_app_body := 'New application: ' || applicant_name || '. Open Applications in Love Potion HQ.';

  insert into public.notification_queue (
    recipient_id,
    recipient_sl_uuid,
    channel,
    type,
    title,
    body,
    action_url,
    metadata,
    scheduled_at,
    status,
    sent_at
  )
  select
    p.id,
    null,
    'in_app'::public.notification_channel,
    'new_message'::public.notification_type,
    'New blogger application',
    in_app_body,
    '/app/applications',
    jsonb_build_object(
      'event', 'blogger_application_created',
      'application_id', new.id,
      'applicant_name', applicant_name
    ),
    now(),
    'sent'::public.notification_status,
    now()
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and p.account_status <> 'left';

  insert into public.notification_queue (
    recipient_id,
    recipient_sl_uuid,
    channel,
    type,
    title,
    body,
    action_url,
    metadata,
    scheduled_at,
    status
  )
  select
    p.id,
    p.sl_avatar_uuid,
    'second_life'::public.notification_channel,
    'new_message'::public.notification_type,
    'New blogger application',
    second_life_body,
    null,
    jsonb_build_object(
      'event', 'blogger_application_created',
      'application_id', new.id,
      'applicant_name', applicant_name
    ),
    now(),
    'pending'::public.notification_status
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and p.account_status = 'active'
    and nullif(p.sl_avatar_uuid, '') is not null;

  return new;
end;
$$;

revoke all on function public.queue_staff_application_notification() from public;

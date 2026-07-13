-- Ensure new blogger applications notify all staff in-app,
-- while still queueing Second Life pings for staff accounts with SL UUIDs.

create or replace function public.queue_staff_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_name text;
begin
  applicant_name :=
    coalesce(nullif(new.display_name, ''), nullif(new.sl_avatar_name, ''), new.email);

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
    'New application from ' || applicant_name || '. Open Applications in Love Potion HQ.',
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
    'New application from ' || applicant_name || '. Open Applications in Love Potion HQ.',
    '/app/applications',
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

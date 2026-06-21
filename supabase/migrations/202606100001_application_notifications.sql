-- Application notifications for Love Potion.
-- When someone applies, active staff with a Second Life UUID receive a queued SL ping.

create or replace function public.queue_staff_application_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_queue (
    recipient_id,
    recipient_sl_uuid,
    channel,
    type,
    title,
    body,
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
    'New application from '
      || coalesce(nullif(new.display_name, ''), nullif(new.sl_avatar_name, ''), new.email)
      || '. Open Applications in Love Potion HQ.',
    jsonb_build_object(
      'event', 'blogger_application_created',
      'application_id', new.id,
      'applicant_name', coalesce(nullif(new.display_name, ''), nullif(new.sl_avatar_name, ''), new.email)
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

drop trigger if exists queue_staff_application_notification on public.blogger_applications;
create trigger queue_staff_application_notification
after insert on public.blogger_applications
for each row execute function public.queue_staff_application_notification();

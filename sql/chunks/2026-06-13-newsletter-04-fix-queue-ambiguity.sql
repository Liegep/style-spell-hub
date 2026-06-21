-- Fix newsletter queue function ambiguity.
-- Run this if sending a newsletter says:
-- column reference "queued_count" is ambiguous

create or replace function public.queue_newsletter_campaign(target_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_title text;
  campaign_body text;
  campaign_image_url text;
  campaign_texture_item_name text;
  queued_total integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Only staff can queue newsletters.';
  end if;

  select title, body, image_url, sl_texture_item_name
  into campaign_title, campaign_body, campaign_image_url, campaign_texture_item_name
  from public.newsletter_campaigns
  where id = target_campaign_id;

  if campaign_title is null then
    raise exception 'Newsletter campaign not found.';
  end if;

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
    null,
    ns.sl_avatar_uuid,
    'second_life',
    'manual',
    campaign_title,
    case
      when campaign_texture_item_name is not null and campaign_texture_item_name <> '' then campaign_body
      when campaign_image_url is null or campaign_image_url = '' then campaign_body
      else campaign_body || E'\n\nPhoto: ' || campaign_image_url
    end,
    nullif(campaign_image_url, ''),
    jsonb_build_object(
      'source', 'newsletter',
      'campaign_id', target_campaign_id,
      'subscriber_id', ns.id,
      'image_url', nullif(campaign_image_url, ''),
      'fallback_url', nullif(campaign_image_url, ''),
      'texture_item_name', nullif(campaign_texture_item_name, '')
    ),
    now(),
    'pending'
  from public.newsletter_subscribers ns
  where coalesce(ns.is_active, true) = true
    and ns.unsubscribed_at is null
    and ns.sl_avatar_uuid is not null
    and ns.sl_avatar_uuid <> '';

  get diagnostics queued_total = row_count;

  update public.newsletter_campaigns nc
  set status = 'queued',
      recipient_count = queued_total,
      queued_count = queued_total,
      sent_at = now()
  where nc.id = target_campaign_id;

  return queued_total;
end;
$$;

revoke all on function public.queue_newsletter_campaign(uuid) from public;
grant execute on function public.queue_newsletter_campaign(uuid) to authenticated;

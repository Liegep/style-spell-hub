-- Preview newsletter test history before deleting it.
-- This keeps newsletter_subscribers intact.

select
  id,
  title,
  status,
  recipient_count,
  queued_count,
  sent_at,
  created_at
from public.newsletter_campaigns
order by created_at desc;

select
  'newsletter_campaigns' as table_name,
  count(*) as rows_to_delete
from public.newsletter_campaigns
union all
select
  'newsletter_notification_queue',
  count(*)
from public.notification_queue
where metadata @> '{"source":"newsletter"}'::jsonb
union all
select
  'newsletter_audit_logs',
  count(*)
from public.audit_logs
where target_type in ('newsletter', 'newsletter_campaign', 'newsletter_subscriber')
   or action ilike 'newsletter_%';

select
  id,
  channel,
  type,
  status,
  title,
  metadata ->> 'campaign_id' as campaign_id,
  created_at
from public.notification_queue
where metadata @> '{"source":"newsletter"}'::jsonb
order by created_at desc
limit 50;

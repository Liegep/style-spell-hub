-- Preview counts before resetting Notifications + Atelier activity.
-- This does not delete users, products, assets, site content, or subscribers.

select 'notification_queue' as table_name, count(*) as rows_to_delete from public.notification_queue
union all
select 'internal_messages', count(*) from public.internal_messages
union all
select 'audit_logs', count(*) from public.audit_logs
union all
select 'blog_submission_links', count(*) from public.blog_submission_links
union all
select 'blog_submissions', count(*) from public.blog_submissions
union all
select 'product_claims', count(*) from public.product_claims;

-- Recent notification rows that will disappear from Notifications / health widgets.
select
  id,
  channel,
  type,
  status,
  title,
  created_at
from public.notification_queue
order by created_at desc
limit 25;

-- Recent Atelier activity that will disappear from review queue / delivery desk.
select
  'submission' as kind,
  id,
  product_id::text,
  blogger_id::text,
  status::text,
  submitted_at as created_at
from public.blog_submissions
union all
select
  'claim' as kind,
  id,
  product_id::text,
  blogger_id::text,
  status::text,
  claimed_at as created_at
from public.product_claims
order by created_at desc
limit 25;

-- Preview bloggers that will be removed from the "Blocked / Removed" tab.
-- This does not delete anything.

select
  p.id,
  p.email,
  coalesce(p.display_name, p.full_name, p.sl_avatar_name, 'No name') as name,
  p.account_status,
  p.created_at,
  p.updated_at
from public.profiles p
where p.role = 'blogger'
  and p.account_status in ('blocked', 'left')
order by p.updated_at desc nulls last, p.created_at desc;

-- Related rows that will be deleted by profile/auth cascade.
with target_bloggers as (
  select id
  from public.profiles
  where role = 'blogger'
    and account_status in ('blocked', 'left')
)
select 'bloggers_to_remove' as table_name, count(*) as rows_to_delete from target_bloggers
union all
select 'product_claims', count(*) from public.product_claims where blogger_id in (select id from target_bloggers)
union all
select 'blog_submissions', count(*) from public.blog_submissions where blogger_id in (select id from target_bloggers)
union all
select 'internal_messages_received', count(*) from public.internal_messages where recipient_id in (select id from target_bloggers)
union all
select 'notification_queue', count(*) from public.notification_queue where recipient_id in (select id from target_bloggers);

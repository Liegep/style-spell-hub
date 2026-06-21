-- Preview before deleting test users.
-- Replace this email with the one account you want to keep.
with settings as (
  select lower('YOUR_EMAIL_HERE') as keep_email
),
target_users as (
  select
    u.id,
    u.email,
    p.display_name,
    p.full_name,
    p.role,
    p.account_status,
    u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  cross join settings s
  where lower(u.email) <> s.keep_email
)
select
  id,
  email,
  coalesce(display_name, full_name, 'No profile name') as name,
  coalesce(role::text, 'no profile') as role,
  coalesce(account_status::text, 'no profile') as account_status,
  created_at
from target_users
order by created_at desc;

-- Optional counts of related platform records that will be removed or detached
-- when the auth users are deleted.
with settings as (
  select lower('YOUR_EMAIL_HERE') as keep_email
),
target_users as (
  select u.id
  from auth.users u
  cross join settings s
  where lower(u.email) <> s.keep_email
)
select 'profiles' as table_name, count(*) from public.profiles where id in (select id from target_users)
union all
select 'product_claims', count(*) from public.product_claims where blogger_id in (select id from target_users)
union all
select 'blog_submissions', count(*) from public.blog_submissions where blogger_id in (select id from target_users)
union all
select 'internal_messages_received', count(*) from public.internal_messages where recipient_id in (select id from target_users)
union all
select 'notification_queue', count(*) from public.notification_queue where recipient_id in (select id from target_users);

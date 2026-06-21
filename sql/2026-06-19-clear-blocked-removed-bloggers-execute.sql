-- Remove every blogger shown in the "Blocked / Removed" tab.
-- IMPORTANT:
-- 1. Run sql/2026-06-19-clear-blocked-removed-bloggers-preview.sql first.
-- 2. Run this only if the preview shows exactly the bloggers you want to remove.
--
-- This deletes auth.users rows for bloggers whose profile is blocked/left.
-- Because public.profiles references auth.users with ON DELETE CASCADE,
-- their profile rows and related blogger activity are removed too.

begin;

do $$
declare
  delete_count int;
begin
  select count(*)
  into delete_count
  from public.profiles
  where role = 'blogger'
    and account_status in ('blocked', 'left');

  raise notice 'Deleting % blocked/removed blogger auth user(s).', delete_count;
end $$;

delete from auth.users u
using public.profiles p
where p.id = u.id
  and p.role = 'blogger'
  and p.account_status in ('blocked', 'left');

commit;

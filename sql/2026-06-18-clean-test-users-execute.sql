-- Delete test users from Supabase Auth and the platform.
-- IMPORTANT:
-- 1. Run sql/2026-06-18-clean-test-users-preview.sql first.
-- 2. Replace this email with the one account you want to keep.
-- 3. Run this only after the preview shows the correct users.

begin;

do $$
declare
  keep_email text := lower('YOUR_EMAIL_HERE');
  keep_count int;
  delete_count int;
begin
  select count(*)
  into keep_count
  from auth.users
  where lower(email) = keep_email;

  if keep_count <> 1 then
    raise exception 'Expected exactly one auth user for %, found %.', keep_email, keep_count;
  end if;

  select count(*)
  into delete_count
  from auth.users
  where lower(email) <> keep_email;

  raise notice 'Deleting % auth user(s), keeping %.', delete_count, keep_email;
end $$;

delete from auth.users
where lower(email) <> lower('YOUR_EMAIL_HERE');

commit;

-- The profile rows are linked to auth.users with ON DELETE CASCADE.
-- Related blogger claims, submissions, personal inbox rows, and notification queue rows
-- cascade from profiles. Created/reviewed/audit references are preserved as null.

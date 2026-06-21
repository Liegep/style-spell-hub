-- Fix old admin removals that were saved as "left".
-- "left" is now reserved for bloggers who leave by themselves through Danger Zone.
-- Staff/admin removals should be "blocked" so rejoin warnings do not confuse the two cases.

update public.profiles as p
set
  account_status = 'blocked',
  updated_at = now()
where p.role = 'blogger'
  and p.account_status = 'left'
  and exists (
    select 1
    from public.audit_logs as a
    where a.target_type = 'profile'
      and a.target_id = p.id::text
      and a.action = 'Removed blogger account'
  );

-- Keep "left" only for bloggers who actually left through their own Danger Zone.
-- Any other blogger currently marked as "left" becomes "blocked", which means
-- removed/blocked by Love Potion instead of voluntarily leaving the program.

alter table public.profiles disable trigger protect_profiles_privileged_fields;

update public.profiles as p
set
  account_status = 'blocked',
  updated_at = now()
where p.role = 'blogger'
  and p.account_status = 'left'
  and not exists (
    select 1
    from public.audit_logs as a
    where a.target_type = 'profile'
      and a.target_id = p.id::text
      and a.action = 'Blogger left platform'
  );

alter table public.profiles enable trigger protect_profiles_privileged_fields;

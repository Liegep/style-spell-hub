-- Allow bloggers to mark their own profile as "left" without allowing self-reactivation.
-- Run this once in Supabase SQL Editor.

create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.id = auth.uid() and not public.is_super_admin() then
      new.role = 'blogger';
      new.account_status = 'pending';
    end if;
    return new;
  end if;

  if not public.is_super_admin() then
    new.role = old.role;
  end if;

  if auth.uid() is not null and not public.is_staff() then
    if old.id = auth.uid()
      and old.role = 'blogger'
      and new.account_status = 'left'
      and old.account_status <> 'left'
    then
      new.account_status = 'left';
    else
      new.account_status = old.account_status;
    end if;
  end if;

  return new;
end;
$$;

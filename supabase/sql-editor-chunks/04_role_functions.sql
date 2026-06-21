create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() in ('admin', 'super_admin'), false)
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_app_role() = 'super_admin', false)
$$;

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

  if not public.is_staff() then
    new.account_status = old.account_status;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profiles_privileged_fields on public.profiles;
create trigger protect_profiles_privileged_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_privileged_fields();

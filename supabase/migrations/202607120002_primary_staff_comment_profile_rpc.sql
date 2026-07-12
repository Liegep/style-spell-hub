drop function if exists public.get_primary_staff_comment_profile();

create function public.get_primary_staff_comment_profile()
returns table (
  id uuid,
  display_name text,
  full_name text,
  email text,
  avatar_url text,
  status_message text,
  availability_status public.availability_status
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.full_name,
    p.email,
    p.avatar_url,
    p.status_message,
    p.availability_status
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and coalesce(p.account_status, 'active') <> 'left'
  order by
    case
      when lower(coalesce(p.display_name, '')) like '%marie%' then 0
      when lower(coalesce(p.full_name, '')) like '%marie%' then 0
      when lower(coalesce(p.email, '')) like '%marie%' then 0
      when p.role = 'super_admin' then 1
      else 2
    end,
    p.updated_at desc nulls last,
    p.created_at desc nulls last
  limit 1;
end;
$$;

revoke all on function public.get_primary_staff_comment_profile() from public;
grant execute on function public.get_primary_staff_comment_profile() to authenticated;

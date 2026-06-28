-- Super-admin view of registered Second Life dropboxes / delivery prims.

create or replace function public.list_second_life_dropboxes()
returns table (
  id text,
  object_name text,
  object_key text,
  region_name text,
  owner_key text,
  server_url text,
  active boolean,
  last_seen_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    s.id,
    s.object_name,
    s.object_key,
    s.region_name,
    s.owner_key,
    s.server_url,
    s.active,
    s.last_seen_at,
    s.created_at,
    s.updated_at
  from public.second_life_delivery_servers s
  where public.is_super_admin()
  order by s.active desc, s.last_seen_at desc;
$$;

revoke all on function public.list_second_life_dropboxes() from public;
grant execute on function public.list_second_life_dropboxes() to authenticated;

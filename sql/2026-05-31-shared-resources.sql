-- Shared resources for "Bag of goodies" (bloggers) and "Files & Links" (admin/super admin)

create table if not exists public.shared_resources (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('link', 'image')),
  title text not null,
  url text not null,
  description text,
  sort_order int not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.shared_resources enable row level security;

drop policy if exists "shared resources are readable by authenticated users" on public.shared_resources;
create policy "shared resources are readable by authenticated users"
on public.shared_resources
for select
using (auth.role() = 'authenticated');

drop policy if exists "shared links writable by admin and super admin" on public.shared_resources;
create policy "shared links writable by admin and super admin"
on public.shared_resources
for insert
with check (
  kind = 'link'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);

drop policy if exists "shared images writable by super admin" on public.shared_resources;
create policy "shared images writable by super admin"
on public.shared_resources
for insert
with check (
  kind = 'image'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

drop policy if exists "shared resources deletable by super admin" on public.shared_resources;
create policy "shared resources deletable by super admin"
on public.shared_resources
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

insert into storage.buckets (id, name, public)
values ('goodies', 'goodies', true)
on conflict (id) do nothing;

drop policy if exists "goodies public read" on storage.objects;
create policy "goodies public read"
on storage.objects
for select
using (bucket_id = 'goodies');

drop policy if exists "goodies upload by super admin" on storage.objects;
create policy "goodies upload by super admin"
on storage.objects
for insert
with check (
  bucket_id = 'goodies'
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'super_admin'
  )
);

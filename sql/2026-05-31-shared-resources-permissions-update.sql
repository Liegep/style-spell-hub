-- Align "Files & Links" with the app rules:
-- bloggers and admins can read; only super admins can create, edit, and delete.

alter table public.shared_resources enable row level security;

drop policy if exists "shared resources are readable by authenticated users" on public.shared_resources;
create policy "shared resources are readable by authenticated users"
on public.shared_resources
for select
using (auth.role() = 'authenticated');

drop policy if exists "shared links writable by admin and super admin" on public.shared_resources;
drop policy if exists "shared images writable by super admin" on public.shared_resources;
drop policy if exists "shared resources writable by super admin" on public.shared_resources;
create policy "shared resources writable by super admin"
on public.shared_resources
for insert
with check (public.is_super_admin());

drop policy if exists "shared resources editable by super admin" on public.shared_resources;
create policy "shared resources editable by super admin"
on public.shared_resources
for update
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "shared resources deletable by super admin" on public.shared_resources;
create policy "shared resources deletable by super admin"
on public.shared_resources
for delete
using (public.is_super_admin());

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
with check (bucket_id = 'goodies' and public.is_super_admin());

drop policy if exists "goodies update by super admin" on storage.objects;
create policy "goodies update by super admin"
on storage.objects
for update
using (bucket_id = 'goodies' and public.is_super_admin())
with check (bucket_id = 'goodies' and public.is_super_admin());

drop policy if exists "goodies delete by super admin" on storage.objects;
create policy "goodies delete by super admin"
on storage.objects
for delete
using (bucket_id = 'goodies' and public.is_super_admin());

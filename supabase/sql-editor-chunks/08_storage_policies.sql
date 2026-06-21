drop policy if exists "Public read avatars" on storage.objects;
create policy "Public read avatars"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'avatars');

drop policy if exists "Users upload own avatars" on storage.objects;
create policy "Users upload own avatars"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users update own avatars" on storage.objects;
create policy "Users update own avatars"
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Users delete own avatars" on storage.objects;
create policy "Users delete own avatars"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
on storage.objects for select
to anon, authenticated
using (bucket_id in ('product-images', 'content-assets'));

drop policy if exists "Super admins manage product images" on storage.objects;
create policy "Super admins manage product images"
on storage.objects for all
to authenticated
using (bucket_id in ('product-images', 'content-assets') and public.is_super_admin())
with check (bucket_id in ('product-images', 'content-assets') and public.is_super_admin());

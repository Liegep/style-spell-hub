alter table public.profiles enable row level security;
alter table public.product_releases enable row level security;
alter table public.product_release_images enable row level security;
alter table public.product_claims enable row level security;
alter table public.blog_submissions enable row level security;
alter table public.blog_submission_links enable row level security;
alter table public.internal_messages enable row level security;
alter table public.blogger_applications enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "Profiles are visible to owner and staff" on public.profiles;
create policy "Profiles are visible to owner and staff"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_staff());

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles for insert
to authenticated
with check (
  (id = auth.uid() and role = 'blogger')
  or public.is_super_admin()
);

drop policy if exists "Users and staff can update profiles" on public.profiles;
create policy "Users and staff can update profiles"
on public.profiles for update
to authenticated
using (id = auth.uid() or public.is_staff())
with check (id = auth.uid() or public.is_staff());

drop policy if exists "Anyone can read available releases" on public.product_releases;
create policy "Anyone can read available releases"
on public.product_releases for select
to anon, authenticated
using (status = 'available' or public.is_staff());

drop policy if exists "Super admins manage product releases" on public.product_releases;
create policy "Super admins manage product releases"
on public.product_releases for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Anyone can read available product images" on public.product_release_images;
create policy "Anyone can read available product images"
on public.product_release_images for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_releases pr
    where pr.id = product_id
      and (pr.status = 'available' or public.is_staff())
  )
);

drop policy if exists "Super admins manage product images" on public.product_release_images;
create policy "Super admins manage product images"
on public.product_release_images for all
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

drop policy if exists "Claims visible to owner and staff" on public.product_claims;
create policy "Claims visible to owner and staff"
on public.product_claims for select
to authenticated
using (blogger_id = auth.uid() or public.is_staff());

drop policy if exists "Bloggers claim available products" on public.product_claims;
create policy "Bloggers claim available products"
on public.product_claims for insert
to authenticated
with check (
  blogger_id = auth.uid()
  and exists (
    select 1
    from public.product_releases pr
    where pr.id = product_id
      and pr.status = 'available'
  )
);

drop policy if exists "Staff update claims" on public.product_claims;
create policy "Staff update claims"
on public.product_claims for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Anyone creates blogger applications" on public.blogger_applications;
create policy "Anyone creates blogger applications"
on public.blogger_applications for insert
to anon, authenticated
with check (true);

drop policy if exists "Staff read blogger applications" on public.blogger_applications;
create policy "Staff read blogger applications"
on public.blogger_applications for select
to authenticated
using (public.is_staff());

drop policy if exists "Staff review blogger applications" on public.blogger_applications;
create policy "Staff review blogger applications"
on public.blogger_applications for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Anyone subscribes to newsletter" on public.newsletter_subscribers;
create policy "Anyone subscribes to newsletter"
on public.newsletter_subscribers for insert
to anon, authenticated
with check (true);

drop policy if exists "Staff read newsletter subscribers" on public.newsletter_subscribers;
create policy "Staff read newsletter subscribers"
on public.newsletter_subscribers for select
to authenticated
using (public.is_staff());

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('product-images', 'product-images', true),
  ('content-assets', 'content-assets', true)
on conflict (id) do update
set public = excluded.public;

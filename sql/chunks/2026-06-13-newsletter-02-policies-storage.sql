-- Love Potion Second Life newsletter: staff policies + image bucket.
-- Run after 2026-06-13-newsletter-01-schema.sql.

insert into storage.buckets (id, name, public)
values ('newsletter-images', 'newsletter-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Anyone subscribes to newsletter" on public.newsletter_subscribers;
drop policy if exists "Staff read newsletter subscribers" on public.newsletter_subscribers;
drop policy if exists "Staff can read newsletter subscribers" on public.newsletter_subscribers;
drop policy if exists "Staff can manage newsletter subscribers" on public.newsletter_subscribers;

create policy "Staff can read newsletter subscribers"
on public.newsletter_subscribers for select
to authenticated
using (public.is_staff());

create policy "Staff can manage newsletter subscribers"
on public.newsletter_subscribers for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Staff can read newsletter campaigns" on public.newsletter_campaigns;
drop policy if exists "Staff can manage newsletter campaigns" on public.newsletter_campaigns;

create policy "Staff can read newsletter campaigns"
on public.newsletter_campaigns for select
to authenticated
using (public.is_staff());

create policy "Staff can manage newsletter campaigns"
on public.newsletter_campaigns for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Public Read Newsletter Images" on storage.objects;
drop policy if exists "Staff Upload Newsletter Images" on storage.objects;
drop policy if exists "Staff Update Newsletter Images" on storage.objects;
drop policy if exists "Staff Delete Newsletter Images" on storage.objects;

create policy "Public Read Newsletter Images"
on storage.objects for select
using (bucket_id = 'newsletter-images');

create policy "Staff Upload Newsletter Images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'newsletter-images' and public.is_staff());

create policy "Staff Update Newsletter Images"
on storage.objects for update
to authenticated
using (bucket_id = 'newsletter-images' and public.is_staff())
with check (bucket_id = 'newsletter-images' and public.is_staff());

create policy "Staff Delete Newsletter Images"
on storage.objects for delete
to authenticated
using (bucket_id = 'newsletter-images' and public.is_staff());

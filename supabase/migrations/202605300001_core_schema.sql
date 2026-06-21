-- Love Potion core platform schema
-- Run this in Supabase SQL Editor or with Supabase CLI.

create extension if not exists pgcrypto;

do $$
begin
  create type public.app_role as enum ('blogger', 'admin', 'super_admin');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.account_status as enum ('pending', 'active', 'blocked', 'left');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.availability_status as enum ('available', 'vacation', 'busy', 'offline');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.product_status as enum ('draft', 'available', 'archived');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_status as enum ('claimed', 'delivered', 'failed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.submission_status as enum ('pending', 'approved', 'rejected', 'needs_revision');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.message_scope as enum ('personal', 'broadcast');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  display_name text,
  sl_avatar_name text,
  sl_legacy_name text,
  sl_display_name text,
  sl_avatar_uuid text unique,
  avatar_url text,
  role public.app_role not null default 'blogger',
  account_status public.account_status not null default 'pending',
  availability_status public.availability_status not null default 'available',
  status_message text check (char_length(status_message) <= 60),
  language_preference text not null default 'en' check (language_preference in ('en', 'es')),
  flickr_url text,
  instagram_url text,
  facebook_url text,
  blog_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_releases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  category text,
  short_description text,
  long_description text,
  handwritten_note text,
  blogging_recommendations text,
  editorial_image_url text,
  image_url text,
  vendor_poster_url text,
  second_life_link text,
  marketplace_link text,
  release_date date,
  deadline_at timestamptz,
  status public.product_status not null default 'draft',
  featured_on_landing boolean not null default false,
  display_order int not null default 0,
  delivery_item_key text,
  auto_archive_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_claims (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_releases(id) on delete cascade,
  blogger_id uuid not null references public.profiles(id) on delete cascade,
  status public.claim_status not null default 'claimed',
  delivery_response text,
  claimed_at timestamptz not null default now(),
  delivered_at timestamptz,
  unique (product_id, blogger_id)
);

create table if not exists public.blog_submissions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product_releases(id) on delete restrict,
  blogger_id uuid not null references public.profiles(id) on delete cascade,
  claim_id uuid references public.product_claims(id) on delete set null,
  status public.submission_status not null default 'pending',
  blogger_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_comment text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.blog_submission_links (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.blog_submissions(id) on delete cascade,
  platform text not null default 'other',
  url text not null,
  note text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.internal_messages (
  id uuid primary key default gen_random_uuid(),
  scope public.message_scope not null default 'personal',
  sender_id uuid references public.profiles(id) on delete set null,
  recipient_id uuid references public.profiles(id) on delete cascade,
  subject text not null,
  body text,
  image_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (scope = 'broadcast' and recipient_id is null)
    or (scope = 'personal' and recipient_id is not null)
  )
);

create table if not exists public.blogger_applications (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  email text not null,
  sl_avatar_name text,
  sl_avatar_uuid text,
  language_preference text not null default 'en' check (language_preference in ('en', 'es')),
  flickr_url text,
  instagram_url text,
  blog_url text,
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  review_comment text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  sl_avatar_name text,
  sl_avatar_uuid text unique,
  language_preference text not null default 'en' check (language_preference in ('en', 'es')),
  source text not null default 'web',
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row execute function public.touch_updated_at();

drop trigger if exists touch_product_releases_updated_at on public.product_releases;
create trigger touch_product_releases_updated_at
before update on public.product_releases
for each row execute function public.touch_updated_at();

drop trigger if exists touch_blog_submissions_updated_at on public.blog_submissions;
create trigger touch_blog_submissions_updated_at
before update on public.blog_submissions
for each row execute function public.touch_updated_at();

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_account_status_idx on public.profiles(account_status);
create index if not exists profiles_sl_avatar_uuid_idx on public.profiles(sl_avatar_uuid);
create index if not exists product_releases_status_idx on public.product_releases(status);
create index if not exists product_releases_landing_idx
  on public.product_releases(featured_on_landing, display_order, release_date desc);
create index if not exists product_releases_auto_archive_idx
  on public.product_releases(auto_archive_at)
  where status = 'available';
create index if not exists product_claims_blogger_idx on public.product_claims(blogger_id);
create index if not exists blog_submissions_status_idx on public.blog_submissions(status);
create index if not exists blog_submissions_blogger_idx on public.blog_submissions(blogger_id);
create index if not exists blog_submission_links_submission_idx on public.blog_submission_links(submission_id);
create index if not exists internal_messages_recipient_idx on public.internal_messages(recipient_id, created_at desc);

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

alter table public.profiles enable row level security;
alter table public.product_releases enable row level security;
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

drop policy if exists "Submissions visible to owner and staff" on public.blog_submissions;
create policy "Submissions visible to owner and staff"
on public.blog_submissions for select
to authenticated
using (blogger_id = auth.uid() or public.is_staff());

drop policy if exists "Bloggers create their own submissions" on public.blog_submissions;
create policy "Bloggers create their own submissions"
on public.blog_submissions for insert
to authenticated
with check (blogger_id = auth.uid());

drop policy if exists "Bloggers update pending own submissions" on public.blog_submissions;
create policy "Bloggers update pending own submissions"
on public.blog_submissions for update
to authenticated
using (blogger_id = auth.uid() and status in ('pending', 'needs_revision'))
with check (blogger_id = auth.uid() and status in ('pending', 'needs_revision'));

drop policy if exists "Staff review submissions" on public.blog_submissions;
create policy "Staff review submissions"
on public.blog_submissions for update
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Submission links visible to owner and staff" on public.blog_submission_links;
create policy "Submission links visible to owner and staff"
on public.blog_submission_links for select
to authenticated
using (
  public.is_staff()
  or exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
  )
);

drop policy if exists "Bloggers manage own submission links" on public.blog_submission_links;
create policy "Bloggers manage own submission links"
on public.blog_submission_links for all
to authenticated
using (
  exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
      and bs.status in ('pending', 'needs_revision')
  )
)
with check (
  exists (
    select 1
    from public.blog_submissions bs
    where bs.id = submission_id
      and bs.blogger_id = auth.uid()
      and bs.status in ('pending', 'needs_revision')
  )
);

drop policy if exists "Staff manage submission links" on public.blog_submission_links;
create policy "Staff manage submission links"
on public.blog_submission_links for all
to authenticated
using (public.is_staff())
with check (public.is_staff());

drop policy if exists "Messages visible to recipient broadcast and staff" on public.internal_messages;
create policy "Messages visible to recipient broadcast and staff"
on public.internal_messages for select
to authenticated
using (scope = 'broadcast' or recipient_id = auth.uid() or sender_id = auth.uid() or public.is_staff());

drop policy if exists "Staff create messages" on public.internal_messages;
create policy "Staff create messages"
on public.internal_messages for insert
to authenticated
with check (public.is_staff());

drop policy if exists "Users mark own messages read" on public.internal_messages;
create policy "Users mark own messages read"
on public.internal_messages for update
to authenticated
using (recipient_id = auth.uid() or public.is_staff())
with check (recipient_id = auth.uid() or public.is_staff());

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

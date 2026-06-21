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

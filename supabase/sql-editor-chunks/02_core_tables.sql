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

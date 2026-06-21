-- Love Potion Second Life newsletter: subscribers + campaigns.
-- Run this first.

alter table public.newsletter_subscribers
  add column if not exists display_name text,
  add column if not exists is_active boolean not null default true,
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

update public.newsletter_subscribers
set is_active = (unsubscribed_at is null)
where is_active is distinct from (unsubscribed_at is null);

create unique index if not exists newsletter_subscribers_sl_avatar_uuid_uidx
on public.newsletter_subscribers (sl_avatar_uuid)
where sl_avatar_uuid is not null;

create table if not exists public.newsletter_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null,
  image_url text,
  sl_texture_item_name text,
  status text not null default 'draft' check (status in ('draft', 'queued', 'sent')),
  recipient_count integer not null default 0,
  queued_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists touch_newsletter_subscribers_updated_at on public.newsletter_subscribers;
create trigger touch_newsletter_subscribers_updated_at
before update on public.newsletter_subscribers
for each row execute function public.touch_updated_at();

drop trigger if exists touch_newsletter_campaigns_updated_at on public.newsletter_campaigns;
create trigger touch_newsletter_campaigns_updated_at
before update on public.newsletter_campaigns
for each row execute function public.touch_updated_at();

alter table public.newsletter_subscribers enable row level security;
alter table public.newsletter_campaigns enable row level security;

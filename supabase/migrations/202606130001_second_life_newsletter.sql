-- Love Potion Second Life newsletter.
-- This migration mirrors the SQL chunks in /sql/chunks/2026-06-13-newsletter-*.sql.

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

create or replace function public.queue_newsletter_campaign(target_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  campaign_title text;
  campaign_body text;
  campaign_image_url text;
  campaign_texture_item_name text;
  queued_total integer := 0;
begin
  if not public.is_staff() then
    raise exception 'Only staff can queue newsletters.';
  end if;

  select title, body, image_url, sl_texture_item_name
  into campaign_title, campaign_body, campaign_image_url, campaign_texture_item_name
  from public.newsletter_campaigns
  where id = target_campaign_id;

  if campaign_title is null then
    raise exception 'Newsletter campaign not found.';
  end if;

  insert into public.notification_queue (
    recipient_id,
    recipient_sl_uuid,
    channel,
    type,
    title,
    body,
    action_url,
    metadata,
    scheduled_at,
    status
  )
  select
    null,
    ns.sl_avatar_uuid,
    'second_life',
    'manual',
    campaign_title,
    case
      when campaign_texture_item_name is not null and campaign_texture_item_name <> '' then campaign_body
      when campaign_image_url is null or campaign_image_url = '' then campaign_body
      else campaign_body || E'\n\nPhoto: ' || campaign_image_url
    end,
    nullif(campaign_image_url, ''),
    jsonb_build_object(
      'source', 'newsletter',
      'campaign_id', target_campaign_id,
      'subscriber_id', ns.id,
      'image_url', nullif(campaign_image_url, ''),
      'fallback_url', nullif(campaign_image_url, ''),
      'texture_item_name', nullif(campaign_texture_item_name, '')
    ),
    now(),
    'pending'
  from public.newsletter_subscribers ns
  where coalesce(ns.is_active, true) = true
    and ns.unsubscribed_at is null
    and ns.sl_avatar_uuid is not null
    and ns.sl_avatar_uuid <> '';

  get diagnostics queued_total = row_count;

  update public.newsletter_campaigns
  set status = 'queued',
      recipient_count = queued_total,
      queued_count = queued_total,
      sent_at = now()
  where id = target_campaign_id;

  return queued_total;
end;
$$;

revoke all on function public.queue_newsletter_campaign(uuid) from public;
grant execute on function public.queue_newsletter_campaign(uuid) to authenticated;
